import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import * as codeforcesService from "../services/codeforces.service.js";
import {
	createLinkedAccount,
	deletePendingVerification,
	getPendingVerifications,
} from "../services/supabase.client.js";
import { assignVerificationRoles } from "../utils/roleManager.js";
import { getRemainingTime, isExpired } from "../utils/time.js";

export const data = new SlashCommandBuilder()
  .setName("verify")
  .setDescription("Complete your Codeforces account verification");

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    let pendingVerifications = await getPendingVerifications(userId, guildId);

    // Check if there are any pending verifications
    if (!pendingVerifications || pendingVerifications.length === 0) {
      return await interaction.editReply({
        content:
          "You have no pending verifications.\n\nUse `/link codeforces <username>` to start the verification process.",
      });
    }

    const results = [];

    for (const pending of pendingVerifications) {
      // Check if verification has expired
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
      let userRank = null;

      try {
        const { contestId, index } = parseCodeforcesProblemId(
          pending.problem_id,
        );

        verificationResult =
          await codeforcesService.checkCompilationErrorSubmission(
            pending.username,
            contestId,
            index,
            pending.started_at,
          );

        // Get user rank for role assignment
        if (verificationResult.verified) {
          try {
            userRank = await codeforcesService.getUserRank(pending.username);
          } catch {
            console.log("Could not fetch user rank, continuing without it");
          }
        }
      } catch (error) {
        console.error(`Error verifying:`, error);
        results.push({
          username: pending.username,
          success: false,
          message: `Failed to check submissions: ${error.message}`,
        });
        continue;
      }

      // Process verification result
      if (verificationResult && verificationResult.verified) {
        // SUCCESS! Create linked account and assign roles
        try {
          // Save to database
          await createLinkedAccount({
            discord_user_id: userId,
            guild_id: guildId,
            username: pending.username,
            rank: userRank,
          });

          // Delete pending verification
          await deletePendingVerification(pending.id);

          // Assign roles
          const member = interaction.member;
          const roleResults = await assignVerificationRoles(
            member,
            guildId,
            userRank,
          );

          results.push({
            username: pending.username,
            success: true,
            message: "Account verified successfully!",
            rank: userRank,
            rolesAssigned: roleResults,
          });
        } catch (error) {
          console.error("Error saving verified account:", error);
          results.push({
            username: pending.username,
            success: false,
            message: `Verification successful but failed to save: ${error.message}`,
          });
        }
      } else {
        // Verification not complete
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

    // Step 3: Build response
    await sendVerificationResults(interaction, results);
  } catch (error) {
    console.error("Verify command error:", error);
    await interaction.editReply({
      content: `❌ An error occurred during verification: ${error.message}`,
    });
  }
}

function parseCodeforcesProblemId(problemId) {
  const match = problemId.match(/^(\d+)([A-Za-z]\d*)$/);

  if (!match) {
    throw new Error(`Invalid problem ID format: ${problemId}`);
  }

  return {
    contestId: parseInt(match[1]),
    index: match[2].toUpperCase(),
  };
}

/**
 * Send formatted verification results to user
 * @param {Interaction} interaction - Discord interaction
 * @param {Array} results - Array of verification results
 */
async function sendVerificationResults(interaction, results) {
  const embeds = [];

  // Count successes and failures
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

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
        value += `\n\n**Problem:** [${result.problemName || "Click here"}](${
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
