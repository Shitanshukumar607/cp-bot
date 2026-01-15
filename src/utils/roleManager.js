/**
 * Role Manager Utility
 *
 * Handles Discord role assignments for verified users
 * including verified role and Codeforces rank-based roles.
 */

import { getGuildConfig } from "../services/supabase.client.js";

/**
 * Assign the verified role to a user
 * @param {GuildMember} member - Discord guild member
 * @param {string} guildId - Guild ID
 * @returns {Promise<boolean>} True if role was assigned
 */
export async function assignVerifiedRole(member, guildId) {
  try {
    const config = await getGuildConfig(guildId);

    if (!config || !config.verified_role_id) {
      console.log(`No verified role configured for guild ${guildId}`);
      return false;
    }

    const role = member.guild.roles.cache.get(config.verified_role_id);

    if (!role) {
      console.error(
        `Verified role ${config.verified_role_id} not found in guild ${guildId}`
      );
      return false;
    }

    // Check if member already has the role
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

/**
 * Assign Codeforces rank-based role to a user
 * @param {GuildMember} member - Discord guild member
 * @param {string} guildId - Guild ID
 * @param {string} rank - Codeforces rank (e.g., 'newbie', 'pupil')
 * @returns {Promise<boolean>} True if role was assigned
 */
export async function assignRankRole(member, guildId, rank) {
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
    const roleId = config.rank_role_map[normalizedRank];

    if (!roleId) {
      console.log(`No role mapped for rank "${rank}" in guild ${guildId}`);
      return false;
    }

    const role = member.guild.roles.cache.get(roleId);

    if (!role) {
      console.error(
        `Rank role ${roleId} for "${rank}" not found in guild ${guildId}`
      );
      return false;
    }

    // Remove other rank roles first (user should only have one rank role)
    const allRankRoleIds = Object.values(config.rank_role_map);
    const rolesToRemove = member.roles.cache.filter(
      (r) => allRankRoleIds.includes(r.id) && r.id !== roleId
    );

    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove, "Updating Codeforces rank role");
    }

    // Add the new rank role if not already assigned
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

/**
 * Assign all applicable roles for a verified user
 * @param {GuildMember} member - Discord guild member
 * @param {string} guildId - Guild ID
 * @param {string} platform - Platform name ('codeforces')
 * @param {string|null} rank - Codeforces rank
 * @returns {Promise<Object>} Object with assignment results
 */
export async function assignVerificationRoles(
  member,
  guildId,
  platform,
  rank = null
) {
  const results = {
    verifiedRole: false,
    rankRole: false,
    errors: [],
  };

  // Assign verified role
  try {
    results.verifiedRole = await assignVerifiedRole(member, guildId);
  } catch (error) {
    results.errors.push(`Failed to assign verified role: ${error.message}`);
  }

  // Assign rank role for Codeforces
  if (platform === "codeforces" && rank) {
    try {
      results.rankRole = await assignRankRole(member, guildId, rank);
    } catch (error) {
      results.errors.push(`Failed to assign rank role: ${error.message}`);
    }
  }

  return results;
}

/**
 * Get a list of all Codeforces ranks
 * @returns {Array<string>} Array of rank names
 */
export function getCodeforcesRanks() {
  return [
    "newbie",
    "pupil",
    "specialist",
    "expert",
    "candidate master",
    "master",
    "international master",
    "grandmaster",
    "international grandmaster",
    "legendary grandmaster",
  ];
}

/**
 * Validate if a string is a valid Codeforces rank
 * @param {string} rank - Rank to validate
 * @returns {boolean} True if valid
 */
export function isValidCodeforcesRank(rank) {
  return getCodeforcesRanks().includes(rank.toLowerCase());
}

export default {
  assignVerifiedRole,
  assignRankRole,
  assignVerificationRoles,
  getCodeforcesRanks,
  isValidCodeforcesRank,
};
