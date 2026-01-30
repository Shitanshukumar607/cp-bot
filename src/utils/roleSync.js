/**
 * Role Sync Utility
 *
 * Automatically syncs Discord roles with current Codeforces ranks.
 * Runs periodically to update roles when users' ratings change.
 */

import { getUserInfo } from "../services/codeforces.service.js";
import {
  getAllLinkedAccounts,
  updateLinkedAccountRank,
  getGuildConfig,
} from "../services/supabase.client.ts";
import { assignRankRole } from "./roleManager.js";

// Delay between Codeforces API calls to avoid rate limiting (in ms)
const API_DELAY = 500;

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sync roles for all linked users across all guilds
 * @param {Client} client - Discord.js client instance
 * @returns {Promise<Object>} Sync results summary
 */
export async function syncAllRoles(client) {
  const results = {
    totalProcessed: 0,
    rolesUpdated: 0,
    errors: [],
    skipped: 0,
  };

  console.log("[RoleSync] Starting role sync job...");

  try {
    // Get all linked accounts from database
    const allAccounts = await getAllLinkedAccounts();

    if (!allAccounts || allAccounts.length === 0) {
      console.log("[RoleSync] No linked accounts found.");
      return results;
    }

    console.log(
      `[RoleSync] Found ${allAccounts.length} linked accounts to process.`,
    );

    // Group accounts by guild for efficient processing
    const accountsByGuild = new Map();
    for (const account of allAccounts) {
      if (!accountsByGuild.has(account.guild_id)) {
        accountsByGuild.set(account.guild_id, []);
      }
      accountsByGuild.get(account.guild_id).push(account);
    }

    // Process each guild
    for (const [guildId, accounts] of accountsByGuild) {
      // Check if guild has rank roles configured
      const config = await getGuildConfig(guildId);
      if (
        !config ||
        !config.rank_role_map ||
        Object.keys(config.rank_role_map).length === 0
      ) {
        console.log(
          `[RoleSync] Guild ${guildId} has no rank roles configured, skipping.`,
        );
        results.skipped += accounts.length;
        continue;
      }

      // Get the Discord guild
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        console.log(
          `[RoleSync] Guild ${guildId} not found in cache, skipping.`,
        );
        results.skipped += accounts.length;
        continue;
      }

      // Process each account in this guild
      for (const account of accounts) {
        results.totalProcessed++;

        try {
          // Add delay to avoid Codeforces rate limiting
          await sleep(API_DELAY);

          // Fetch current rank from Codeforces
          const cfUserInfo = await getUserInfo(account.username);
          const currentRank = cfUserInfo.rank?.toLowerCase() || null;
          const storedRank = account.rank?.toLowerCase() || null;

          // Check if rank has changed
          if (currentRank && currentRank !== storedRank) {
            console.log(
              `[RoleSync] User ${account.username} rank changed: ${storedRank || "none"} -> ${currentRank}`,
            );

            // Update rank in database
            await updateLinkedAccountRank(account.id, currentRank);

            // Try to get the Discord member
            try {
              const member = await guild.members.fetch(account.discord_user_id);

              if (member) {
                // Update Discord role
                const roleAssigned = await assignRankRole(
                  member,
                  guildId,
                  currentRank,
                );

                if (roleAssigned) {
                  console.log(
                    `[RoleSync] Updated role for ${member.user.tag} to ${currentRank}`,
                  );
                  results.rolesUpdated++;
                }
              }
            } catch (memberError) {
              // Member might have left the server
              if (memberError.code === 10007) {
                console.log(
                  `[RoleSync] User ${account.discord_user_id} not found in guild ${guildId}`,
                );
              } else {
                throw memberError;
              }
            }
          }
        } catch (error) {
          const errorMsg = `Failed to sync ${account.username} in guild ${guildId}: ${error.message}`;
          console.error(`[RoleSync] ${errorMsg}`);
          results.errors.push(errorMsg);
          // Continue with other users even if one fails
        }
      }
    }
  } catch (error) {
    console.error("[RoleSync] Critical error during role sync:", error);
    results.errors.push(`Critical error: ${error.message}`);
  }

  console.log(
    `[RoleSync] Sync complete. Processed: ${results.totalProcessed}, Updated: ${results.rolesUpdated}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`,
  );

  return results;
}

/**
 * Start the periodic role sync job
 * @param {Client} client - Discord.js client instance
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 * @returns {NodeJS.Timeout} The interval timer
 */
export function startRoleSyncJob(client, intervalMs = 60 * 60 * 1000) {
  console.log(
    `[RoleSync] Role sync job scheduled to run every ${intervalMs / 1000 / 60} minutes.`,
  );

  // Run immediately on start, then every interval
  syncAllRoles(client).catch((err) => {
    console.error("[RoleSync] Error in initial sync:", err);
  });

  return setInterval(async () => {
    try {
      await syncAllRoles(client);
    } catch (error) {
      console.error("[RoleSync] Error in scheduled sync:", error);
    }
  }, intervalMs);
}

export default {
  syncAllRoles,
  startRoleSyncJob,
};
