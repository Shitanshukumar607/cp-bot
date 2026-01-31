/**
 * Admin-only command to configure the bot for a guild:
 * - Set the verified role
 * - Map Codeforces ranks to Discord roles
 */

import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import {
  getGuildConfig,
  setRankRole,
  setVerifiedRole,
} from "../services/supabase.client.js";
import type { CodeforcesRank } from "../types/types.js";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configure the CP-Bot bot (Admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("verified-role")
      .setDescription("Set the role given to verified users")
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("The role to assign to verified users")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rank-role")
      .setDescription("Map a Codeforces rank to a Discord role")
      .addStringOption((option) =>
        option
          .setName("rank")
          .setDescription("Codeforces rank")
          .setRequired(true)
          .addChoices(
            { name: "Newbie", value: "newbie" },
            { name: "Pupil", value: "pupil" },
            { name: "Specialist", value: "specialist" },
            { name: "Expert", value: "expert" },
            { name: "Candidate Master", value: "candidate master" },
            { name: "Master", value: "master" },
            { name: "International Master", value: "international master" },
            { name: "Grandmaster", value: "grandmaster" },
            {
              name: "International Grandmaster",
              value: "international grandmaster",
            },
            { name: "Legendary Grandmaster", value: "legendary grandmaster" },
          ),
      )
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("The Discord role to assign for this rank")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("view").setDescription("View current bot configuration"),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "verified-role":
        await handleVerifiedRole(interaction);
        break;
      case "rank-role":
        await handleRankRole(interaction);
        break;
      case "view":
        await handleViewConfig(interaction);
        break;
      default:
        await interaction.reply({
          content: "❌ Unknown subcommand.",
        });
    }
  } catch (error) {
    console.error("Setup command error:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "An error occurred while updating settings.";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: `❌ Error: ${errorMessage}`,
      });
    } else {
      await interaction.reply({
        content: `❌ Error: ${errorMessage}`,
      });
    }
  }
}

/** Handle setting the verified role */
async function handleVerifiedRole(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole("role", true);
  const guildId = interaction.guildId;

  if (!guildId || !interaction.guild) {
    await interaction.reply({
      content: "❌ This command can only be used in a server.",
    });
    return;
  }

  // Validate role can be assigned by the bot
  const botMember = interaction.guild.members.me;
  if (!botMember) {
    await interaction.reply({
      content: "❌ Could not find bot member in this server.",
    });
    return;
  }

  if (role.position >= botMember.roles.highest.position) {
    await interaction.reply({
      content: `❌ I cannot assign the role ${role} because it's higher than or equal to my highest role. Please move my role above this role in the server settings.`,
    });
    return;
  }

  // Save to database
  await setVerifiedRole(guildId, role.id);

  await interaction.reply({
    content: `✅ Verified role has been set to ${role}.\n\nUsers who successfully verify their CP accounts will receive this role.`,
  });
}

/** Handle mapping a Codeforces rank to a Discord role */
async function handleRankRole(interaction: ChatInputCommandInteraction) {
  const rank = interaction.options.getString("rank", true) as CodeforcesRank;
  const role = interaction.options.getRole("role", true);
  const guildId = interaction.guildId;

  if (!guildId || !interaction.guild) {
    await interaction.reply({
      content: "❌ This command can only be used in a server.",
    });
    return;
  }

  // Validate role can be assigned by the bot
  const botMember = interaction.guild.members.me;
  if (!botMember) {
    await interaction.reply({
      content: "❌ Could not find bot member in this server.",
    });
    return;
  }

  if (role.position >= botMember.roles.highest.position) {
    await interaction.reply({
      content: `❌ I cannot assign the role ${role} because it's higher than or equal to my highest role. Please move my role above this role in the server settings.`,
    });
    return;
  }

  // Save to database
  await setRankRole(guildId, rank, role.id);

  // Capitalize rank for display
  const displayRank = rank
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  await interaction.reply({
    content: `✅ Rank role mapping updated!\n\n**${displayRank}** → ${role}\n\nUsers with this Codeforces rank will receive this role upon verification.`,
  });
}

/** Handle viewing current configuration */
async function handleViewConfig(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const guildId = interaction.guildId;

  if (!guildId || !interaction.guild) {
    await interaction.editReply({
      content: "❌ This command can only be used in a server.",
    });
    return;
  }

  const config = await getGuildConfig(guildId);

  if (!config) {
    await interaction.editReply({
      content:
        "📋 **Bot Configuration**\n\nNo configuration found for this server. Use `/setup verified-role` and `/setup rank-role` to configure the bot.",
    });
    return;
  }

  // Build configuration display
  let configText = "📋 **Bot Configuration**\n\n";

  // Verified role
  if (config.verified_role_id) {
    const role = interaction.guild.roles.cache.get(config.verified_role_id);
    configText += `**Verified Role:** ${
      role ? role.toString() : `ID: ${config.verified_role_id} (not found)`
    }\n\n`;
  } else {
    configText += "**Verified Role:** Not set\n\n";
  }

  // Rank role mappings
  configText += "**Rank Role Mappings:**\n";

  if (config.rank_role_map && Object.keys(config.rank_role_map).length > 0) {
    for (const [rank, roleId] of Object.entries(
      config.rank_role_map as Record<string, string>,
    )) {
      const role = interaction.guild.roles.cache.get(roleId);
      const displayRank = rank
        .split(" ")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      configText += `• **${displayRank}** → ${
        role ? role.toString() : `ID: ${roleId} (not found)`
      }\n`;
    }
  } else {
    configText += "• No rank roles configured\n";
  }

  await interaction.editReply({ content: configText });
}

export default { data, execute };
