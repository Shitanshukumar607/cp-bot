import { GuildMember, Role, Collection } from "discord.js";
import { getGuildConfig } from "../services/supabase.client.js";
import type { CodeforcesRank } from "../types/types.js";

export interface RoleAssignmentResults {
  verifiedRole: boolean;
  rankRole: boolean;
  errors: string[];
}

export async function assignVerifiedRole(
  member: GuildMember,
  guildId: string,
): Promise<boolean> {
  try {
    const config = await getGuildConfig(guildId);

    if (!config || !config.verified_role_id) {
      console.log(`No verified role configured for guild ${guildId}`);
      return false;
    }

    const role = member.guild.roles.cache.get(config.verified_role_id);

    if (!role) {
      console.error(
        `Verified role ${config.verified_role_id} not found in guild ${guildId}`,
      );
      return false;
    }

    if (member.roles.cache.has(role.id)) {
      console.log(`User ${member.user.tag} already has verified role`);
      return true;
    }

    await member.roles.add(role, "CP Account Verified");
    console.log(`Assigned verified role to ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error("Error assigning verified role:", error);
    return false;
  }
}

export async function assignRankRole(
  member: GuildMember,
  guildId: string,
  rank: string,
): Promise<boolean> {
  try {
    if (!rank) {
      console.log("No rank provided, skipping rank role assignment");
      return false;
    }

    const config = await getGuildConfig(guildId);

    if (!config || !config.rank_role_map) {
      console.log(`No rank roles configured for guild ${guildId}`);
      return false;
    }

    const normalizedRank = rank.toLowerCase();
    const rankRoleMap = config.rank_role_map as Record<string, string>;
    const roleId = rankRoleMap[normalizedRank];

    if (!roleId) {
      console.log(`No role mapped for rank "${rank}" in guild ${guildId}`);
      return false;
    }

    const role = member.guild.roles.cache.get(roleId);

    if (!role) {
      console.error(
        `Rank role ${roleId} for "${rank}" not found in guild ${guildId}`,
      );
      return false;
    }

    const allRankRoleIds = Object.values(rankRoleMap);
    const rolesToRemove: Collection<string, Role> = member.roles.cache.filter(
      (r): r is Role => allRankRoleIds.includes(r.id) && r.id !== roleId,
    );

    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove, "Updating Codeforces rank role");
    }

    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role, `Codeforces rank: ${rank}`);
      console.log(`Assigned ${rank} role to ${member.user.tag}`);
    }

    return true;
  } catch (error) {
    console.error("Error assigning rank role:", error);
    return false;
  }
}

/** Assign all applicable roles for a verified user */
export async function assignVerificationRoles(
  member: GuildMember,
  guildId: string,
  rank: CodeforcesRank | null = null,
): Promise<RoleAssignmentResults> {
  const results: RoleAssignmentResults = {
    verifiedRole: false,
    rankRole: false,
    errors: [],
  };

  try {
    results.verifiedRole = await assignVerifiedRole(member, guildId);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    results.errors.push(`Failed to assign verified role: ${errorMessage}`);
  }

  if (rank) {
    try {
      results.rankRole = await assignRankRole(member, guildId, rank);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`Failed to assign rank role: ${errorMessage}`);
    }
  }

  return results;
}

export default {
  assignVerifiedRole,
  assignRankRole,
  assignVerificationRoles,
};
