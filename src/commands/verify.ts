import {
  EmbedBuilder,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import * as codeforcesService from "../services/codeforces.service.js";
import {
  createLinkedAccount,
  deletePendingVerification,
  getPendingVerifications,
} from "../services/supabase.client.js";
import {
  assignVerificationRoles,
  type RoleAssignmentResults,
} from "../utils/roleManager.js";
import { getRemainingTime, isExpired } from "../utils/time.js";
import type { CodeforcesRank } from "../types/types.js";

interface VerificationResultSuccess {}

interface VerificationResultSuccess {
  username: string;
  success: true;
  message: string;
  rank: string | null;
  rolesAssigned: RoleAssignmentResults;
}

interface VerificationResultFailure {
  username: string;
  success: false;
  message: string;
  problemUrl?: string;
  problemName?: string | null;
  timeRemaining?: string;
}

type VerificationResult = VerificationResultSuccess | VerificationResultFailure;

interface ParsedProblemId {
  contestId: number;
  index: string;
}

export const data = new SlashCommandBuilder()
  .setName("verify")
  .setDescription("Complete your Codeforces account verification");

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  try {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply({
        content: "❌ This command can only be used in a server.",
      });
      return;
    }

    const pendingVerifications = await getPendingVerifications(userId, guildId);

    if (!pendingVerifications || pendingVerifications.length === 0) {
      await interaction.editReply({
        content:
          "You have no pending verifications.\n\nUse `/link codeforces <username>` to start the verification process.",
      });
      return;
    }

    const results: VerificationResult[] = [];

    for (const pending of pendingVerifications) {
      if (isExpired(pending.expires_at)) {
        await deletePendingVerification(pending.id);
        results.push({
          username: pending.username,
          success: false,
          message:
            "Verification expired. Please start a new verification with `/link`.",
        });
        continue;
      }

      let verificationResult;
      let userRank: CodeforcesRank | null = null;

      try {
        const { contestId, index } = parseCodeforcesProblemId(
          pending.problem_id,
        );

        verificationResult =
          await codeforcesService.checkCompilationErrorSubmission(
            pending.username,
            contestId,
            index,
            pending.started_at ?? new Date().toISOString(),
          );

        if (verificationResult.verified) {
          try {
            const rank = await codeforcesService.getUserRank(pending.username);
            userRank = rank.toLowerCase() as CodeforcesRank;
          } catch {
            console.log("Could not fetch user rank, continuing without it");
          }
        }
      } catch (error) {
        console.error(`Error verifying:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.push({
          username: pending.username,
          success: false,
          message: `Failed to check submissions: ${errorMessage}`,
        });
        continue;
      }

      if (verificationResult && verificationResult.verified) {
        try {
          await createLinkedAccount({
            discord_user_id: userId,
            guild_id: guildId,
            username: pending.username,
            rank: userRank,
          });

          await deletePendingVerification(pending.id);

          const member = interaction.member as GuildMember;
          const roleResults = (await assignVerificationRoles(
            member,
            guildId,
            userRank,
          )) as RoleAssignmentResults;

          results.push({
            username: pending.username,
            success: true,
            message: "Account verified successfully!",
            rank: userRank,
            rolesAssigned: roleResults,
          });
        } catch (error) {
          console.error("Error saving verified account:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          results.push({
            username: pending.username,
            success: false,
            message: `Verification successful but failed to save: ${errorMessage}`,
          });
        }
      } else {
        const remaining = getRemainingTime(pending.expires_at);
        results.push({
          username: pending.username,
          success: false,
          message:
            verificationResult?.message ||
            "No valid Compilation Error submission found.",
          problemUrl: pending.problem_url,
          problemName: pending.problem_name,
          timeRemaining: remaining,
        });
      }
    }

    await sendVerificationResults(interaction, results);
  } catch (error) {
    console.error("Verify command error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await interaction.editReply({
      content: `❌ An error occurred during verification: ${errorMessage}`,
    });
  }
}

function parseCodeforcesProblemId(problemId: string): ParsedProblemId {
  const match = problemId.match(/^(\d+)([A-Za-z]\d*)$/);

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid problem ID format: ${problemId}`);
  }

  return {
    contestId: parseInt(match[1]),
    index: match[2].toUpperCase(),
  };
}

/** Send formatted verification results to user */
async function sendVerificationResults(
  interaction: ChatInputCommandInteraction,
  results: VerificationResult[],
): Promise<void> {
  const embeds: EmbedBuilder[] = [];

  const successes = results.filter(
    (r): r is VerificationResultSuccess => r.success,
  );
  const failures = results.filter(
    (r): r is VerificationResultFailure => !r.success,
  );

  if (successes.length > 0) {
    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Verification Successful!")
      .setColor(0x00ff00)
      .setDescription("The following accounts have been verified:");

    for (const result of successes) {
      let value = "Account verified!";
      if (result.rank) {
        value += `\n**Rank:** ${result.rank}`;
      }
      if (result.rolesAssigned?.verifiedRole) {
        value += "\n✓ Verified role assigned";
      }
      if (result.rolesAssigned?.rankRole) {
        value += "\n✓ Rank role assigned";
      }

      successEmbed.addFields({
        name: `🟦 Codeforces: ${result.username}`,
        value: value,
        inline: false,
      });
    }

    embeds.push(successEmbed);
  }

  if (failures.length > 0) {
    const failureEmbed = new EmbedBuilder()
      .setTitle("⚠️ Verification Incomplete")
      .setColor(0xffa500)
      .setDescription("The following verifications could not be completed:");

    for (const result of failures) {
      let value = result.message;

      if (result.problemUrl) {
        value += `\n\n**Problem:** [${result.problemName ?? "Click here"}](${
          result.problemUrl
        })`;
      }
      if (result.timeRemaining && result.timeRemaining !== "Expired") {
        value += `\n**Time remaining:** ${result.timeRemaining}`;
      }

      failureEmbed.addFields({
        name: `🟦 Codeforces: ${result.username}`,
        value: value,
        inline: false,
      });
    }

    if (
      failures.some((f) => f.timeRemaining && f.timeRemaining !== "Expired")
    ) {
      failureEmbed.setFooter({
        text: "💡 Submit a Compilation Error to the problem, then run /verify again",
      });
    }

    embeds.push(failureEmbed);
  }

  await interaction.editReply({ embeds });
}

export default { data, execute };
