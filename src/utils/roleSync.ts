import { Client } from "discord.js";
import { getUserInfo } from "../services/codeforces.service.js";
import {
  getAllLinkedAccounts,
  updateLinkedAccountRank,
  getGuildConfig,
} from "../services/supabase.client.js";
import { assignRankRole } from "./roleManager.js";

const API_DELAY = 500;

interface SyncResults {
  totalProcessed: number;
  rolesUpdated: number;
  errors: string[];
  skipped: number;
}

/** Sleep for a specified duration */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sync roles for all linked users across all guilds */
export async function syncAllRoles(client: Client): Promise<SyncResults> {
  const results: SyncResults = {
    totalProcessed: 0,
    rolesUpdated: 0,
    errors: [],
    skipped: 0,
  };

  console.log("[RoleSync] Starting role sync job...");

  try {
    const allAccounts = await getAllLinkedAccounts();

    if (!allAccounts || allAccounts.length === 0) {
      console.log("[RoleSync] No linked accounts found.");
      return results;
    }

    console.log(
      `[RoleSync] Found ${allAccounts.length} linked accounts to process.`,
    );

    const accountsByGuild = new Map<string, typeof allAccounts>();
    for (const account of allAccounts) {
      const existing = accountsByGuild.get(account.guild_id);
      if (!existing) {
        accountsByGuild.set(account.guild_id, []);
      }
      accountsByGuild.get(account.guild_id)!.push(account);
    }

    for (const [guildId, accounts] of accountsByGuild) {
      const config = await getGuildConfig(guildId);
      if (
        !config ||
        !config.rank_role_map ||
        Object.keys(config.rank_role_map as object).length === 0
      ) {
        console.log(
          `[RoleSync] Guild ${guildId} has no rank roles configured, skipping.`,
        );
        results.skipped += accounts.length;
        continue;
      }

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        console.log(
          `[RoleSync] Guild ${guildId} not found in cache, skipping.`,
        );
        results.skipped += accounts.length;
        continue;
      }

      for (const account of accounts) {
        results.totalProcessed++;

        try {
          await sleep(API_DELAY);

          const cfUserInfo = await getUserInfo(account.username);
          const currentRank = cfUserInfo.rank?.toLowerCase() ?? null;
          const storedRank = account.rank?.toLowerCase() ?? null;

          if (currentRank && currentRank !== storedRank) {
            console.log(
              `[RoleSync] User ${account.username} rank changed: ${storedRank ?? "none"} -> ${currentRank}`,
            );

            await updateLinkedAccountRank(account.id, currentRank);

            try {
              const member = await guild.members.fetch(account.discord_user_id);

              if (member) {
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
              if (
                memberError instanceof Error &&
                "code" in memberError &&
                memberError.code === 10007
              ) {
                console.log(
                  `[RoleSync] User ${account.discord_user_id} not found in guild ${guildId}`,
                );
              } else {
                throw memberError;
              }
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const errorMsg = `Failed to sync ${account.username} in guild ${guildId}: ${errorMessage}`;
          console.error(`[RoleSync] ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[RoleSync] Critical error during role sync:", error);
    results.errors.push(`Critical error: ${errorMessage}`);
  }

  console.log(
    `[RoleSync] Sync complete. Processed: ${results.totalProcessed}, Updated: ${results.rolesUpdated}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`,
  );

  return results;
}

/** Start the periodic role sync job */
export function startRoleSyncJob(
  client: Client,
  intervalMs: number = 60 * 60 * 1000,
): NodeJS.Timeout {
  console.log(
    `[RoleSync] Role sync job scheduled to run every ${intervalMs / 1000 / 60} minutes.`,
  );

  syncAllRoles(client).catch((err: unknown) => {
    console.error("[RoleSync] Error in initial sync:", err);
  });

  return setInterval(() => {
    syncAllRoles(client).catch((error: unknown) => {
      console.error("[RoleSync] Error in scheduled sync:", error);
    });
  }, intervalMs);
}

export default {
  syncAllRoles,
  startRoleSyncJob,
};
