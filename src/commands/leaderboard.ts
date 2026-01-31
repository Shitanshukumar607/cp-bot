import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { getAllGuildLinkedAccounts } from "../services/supabase.client.js";
import { getUserInfo } from "../services/codeforces.service.js";

interface LeaderboardEntry {
  discordUserId: string;
  username: string;
  rating: number;
  maxRating: number;
  rank: string;
}

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the Codeforces leaderboard for this server");

function getPositionDisplay(position: number): string {
  switch (position) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return ` **${position}.**`;
  }
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.editReply({
      content: "This command can only be used in a server.",
    });
    return;
  }

  try {
    const linkedAccounts = await getAllGuildLinkedAccounts(guildId);

    if (!linkedAccounts || linkedAccounts.length === 0) {
      await interaction.editReply({
        content:
          "No users have linked their Codeforces accounts yet.\n\nUse `/link codeforces <username>` to link your account and appear on the leaderboard!",
      });
      return;
    }

    const leaderboardData: LeaderboardEntry[] = [];

    for (const account of linkedAccounts) {
      try {
        const userInfo = await getUserInfo(account.username);
        leaderboardData.push({
          discordUserId: account.discord_user_id,
          username: userInfo.handle,
          rating: userInfo.rating || 0,
          maxRating: userInfo.maxRating || 0,
          rank: userInfo.rank || "unrated",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.warn(
          `Could not fetch info for ${account.username}:`,
          errorMessage,
        );
      }
    }

    if (leaderboardData.length === 0) {
      await interaction.editReply({
        content:
          "Could not fetch Codeforces data for any linked users. Please try again later.",
      });
      return;
    }

    leaderboardData.sort((a, b) => b.rating - a.rating);

    const embed = new EmbedBuilder()
      .setTitle("Codeforces Leaderboard")
      .setColor(0x1f8b4c)
      .setDescription(
        `Showing top ${Math.min(leaderboardData.length, 25)} users in this server`,
      )
      .setTimestamp()
      .setFooter({ text: "Ratings are fetched live from Codeforces" });

    const entries = leaderboardData.slice(0, 25).map((user, index) => {
      const position = getPositionDisplay(index + 1);
      const ratingDisplay = user.rating > 0 ? user.rating : "Unrated";
      const maxRatingDisplay =
        user.maxRating > 0 ? ` (max: ${user.maxRating})` : "";

      return `${position} **${user.username}** - ${ratingDisplay}${maxRatingDisplay}`;
    });

    const chunkSize = 10;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const fieldName = i === 0 ? "Rankings" : "Rankings (continued)";
      embed.addFields({
        name: fieldName,
        value: chunk.join("\n"),
        inline: false,
      });
    }

    const totalUsers = leaderboardData.length;
    const avgRating =
      leaderboardData.reduce((sum, u) => sum + u.rating, 0) / totalUsers;

    embed.addFields({
      name: "Server Stats",
      value: `**Total Users:** ${totalUsers}\n**Average Rating:** ${Math.round(avgRating)}`,
      inline: false,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Leaderboard command error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    await interaction.editReply({
      content: `Error fetching leaderboard: ${errorMessage}`,
    });
  }
}

export default { data, execute };
