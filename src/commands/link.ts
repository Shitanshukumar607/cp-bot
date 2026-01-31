import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { validateUser, getUserInfo } from "../services/codeforces.service.js";
import {
  createPendingVerification,
  isAccountLinkedByOther,
} from "../services/supabase.client.js";
import {
  getRandomCodeforcesProblem,
  type RandomProblem,
} from "../utils/randomProblem.js";
import { getExpirationTime, getRemainingTime } from "../utils/time.js";
import type { UserInfo } from "../types/types.js";

export const data = new SlashCommandBuilder()
  .setName("link")
  .setDescription("Link your Codeforces account")
  .addStringOption((option) =>
    option
      .setName("username")
      .setDescription("Your Codeforces handle/username")
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(24),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    await handleLinkCodeforces(interaction);
  } catch (error) {
    console.error("Link command error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";

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

/** Handle Codeforces account linking */
async function handleLinkCodeforces(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const username = interaction.options.getString("username", true);
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.editReply({
      content: "❌ This command can only be used in a server.",
    });
    return;
  }

  const userExists = await validateUser(username);
  if (!userExists) {
    await interaction.editReply({
      content: `❌ Codeforces user **${username}** not found.\n\nPlease check the username and try again.`,
    });
    return;
  }

  const isLinkedByOther = await isAccountLinkedByOther(
    guildId,
    username,
    userId,
  );
  if (isLinkedByOther) {
    await interaction.editReply({
      content: `❌ The Codeforces account **${username}** is already linked to another Discord user in this server.`,
    });
    return;
  }

  let userInfo: UserInfo;
  try {
    userInfo = await getUserInfo(username);
  } catch {
    userInfo = {
      handle: username,
      rank: "unknown",
      rating: 0,
      maxRank: "unknown",
      maxRating: 0,
    };
  }

  const problem: RandomProblem = await getRandomCodeforcesProblem();

  const expiresAt = getExpirationTime();
  const remaining = getRemainingTime(expiresAt.toISOString());

  await createPendingVerification({
    id: "",
    discord_user_id: userId,
    guild_id: guildId,
    username: userInfo.handle,
    problem_id: problem.id,
    problem_url: problem.url,
    problem_name: problem.name,
    expires_at: expiresAt.toISOString(),
    started_at: null,
  });

  const embed = new EmbedBuilder()
    .setTitle("🔗 Codeforces Verification")
    .setColor(0x1f8acb) 
    .setDescription(
      `To verify you own the Codeforces account **${userInfo.handle}**, you need to submit a **Compilation Error** to the problem below.`,
    )
    .addFields(
      {
        name: "📝 Problem",
        value: `[${problem.name}](${problem.url})`,
        inline: true,
      },
      {
        name: "⭐ Difficulty",
        value: `${problem.rating}`,
        inline: true,
      },
      {
        name: "⏱️ Time Limit",
        value: remaining,
        inline: true,
      },
      {
        name: "📊 Your Current Stats",
        value: `**Rank:** ${userInfo.rank}\n**Rating:** ${userInfo.rating}`,
        inline: false,
      },
      {
        name: "📋 Instructions",
        value: `1. Go to the problem: [Click Here](${problem.url})\n2. Submit any code that causes a **Compilation Error**\n   (e.g., \`int main( { }\` or just \`error\`)\n3. Run \`/verify\` to complete verification`,
        inline: false,
      },
    )
    .setFooter({
      text: `Verification expires in ${remaining}`,
    })
    .setTimestamp(expiresAt);

  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
