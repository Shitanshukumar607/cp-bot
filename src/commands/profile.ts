import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { getLinkedAccounts } from "../services/supabase.ts";

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View linked competitive programming accounts")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription(
        "The user whose profile you want to view (leave empty for your own)",
      )
      .setRequired(false),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const userId = targetUser.id;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.editReply({
      content: "❌ This command can only be used in a server.",
    });
    return;
  }

  try {
    const accounts = await getLinkedAccounts(userId, guildId);

    if (!accounts || accounts.length === 0) {
      const isOwnProfile = targetUser.id === interaction.user.id;
      const message = isOwnProfile
        ? "📋 You have no linked competitive programming accounts.\n\nUse `/link codeforces <username>` to link your accounts."
        : `📋 **${targetUser.displayName}** has no linked competitive programming accounts.`;

      await interaction.editReply({
        content: message,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔗 ${targetUser.displayName}'s Linked Accounts`)
      .setColor(0x00ff00)
      .setThumbnail(targetUser.displayAvatarURL())
      .setDescription("Verified competitive programming accounts:");

    if (accounts.length > 0) {
      const cfList = accounts
        .map((a) => {
          const rank = a.rank ? ` (${a.rank})` : "";
          return `• **${a.username}**${rank}`;
        })
        .join("\n");

      embed.addFields({
        name: "🟦 Codeforces",
        value: cfList,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Profile command error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";

    await interaction.editReply({
      content: `❌ Error: ${errorMessage}`,
    });
  }
}

export default { data, execute };
