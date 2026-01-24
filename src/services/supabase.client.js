/**
 * Supabase Client Configuration
 *
 * This module initializes and exports the Supabase client
 * for database operations throughout the bot.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file.",
  );
}

// Create Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// Guild Configuration Operations
// =====================================================

/**
 * Get guild configuration by guild ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object|null>} Guild config or null if not found
 */
export async function getGuildConfig(guildId) {
  const { data, error } = await supabase
    .from("guild_config")
    .select("*")
    .eq("guild_id", guildId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = not found
    console.error("Error fetching guild config:", error);
    throw error;
  }

  return data;
}

/**
 * Set or update the verified role for a guild
 * @param {string} guildId - Discord guild ID
 * @param {string} roleId - Discord role ID
 */
export async function setVerifiedRole(guildId, roleId) {
  const { error } = await supabase.from("guild_config").upsert(
    {
      guild_id: guildId,
      verified_role_id: roleId,
    },
    {
      onConflict: "guild_id",
    },
  );

  if (error) {
    console.error("Error setting verified role:", error);
    throw error;
  }
}

/**
 * Set or update a rank-to-role mapping for a guild
 * @param {string} guildId - Discord guild ID
 * @param {string} rank - Codeforces rank (e.g., 'newbie', 'pupil')
 * @param {string} roleId - Discord role ID
 */
export async function setRankRole(guildId, rank, roleId) {
  // First, get existing config
  const existing = await getGuildConfig(guildId);
  const currentMap = existing?.rank_role_map || {};

  // Update the rank mapping
  const newMap = { ...currentMap, [rank.toLowerCase()]: roleId };

  const { error } = await supabase.from("guild_config").upsert(
    {
      guild_id: guildId,
      rank_role_map: newMap,
    },
    {
      onConflict: "guild_id",
    },
  );

  if (error) {
    console.error("Error setting rank role:", error);
    throw error;
  }
}

// =====================================================
// Pending Verification Operations
// =====================================================

/**
 * Create a new pending verification session
 * @param {Object} verification - Verification details
 * @returns {Promise<Object>} Created verification record
 */
export async function createPendingVerification(verification) {
  const {
    discord_user_id,
    guild_id,
    platform,
    username,
    problem_id,
    problem_url,
    problem_name,
    expires_at,
  } = verification;

  // First, delete any existing pending verification for this user/platform/username
  await supabase
    .from("pending_verifications")
    .delete()
    .eq("discord_user_id", discord_user_id)
    .eq("guild_id", guild_id)
    .eq("platform", platform)
    .eq("username", username);

  // Create new pending verification
  const { data, error } = await supabase
    .from("pending_verifications")
    .insert({
      discord_user_id,
      guild_id,
      platform,
      username,
      problem_id,
      problem_url,
      problem_name,
      expires_at,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating pending verification:", error);
    throw error;
  }

  return data;
}

/**
 * Get all pending verifications for a user in a guild
 * @param {string} discordUserId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Array>} Array of pending verifications
 */
export async function getPendingVerifications(discordUserId, guildId) {
  const { data, error } = await supabase
    .from("pending_verifications")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .eq("guild_id", guildId)
    .gt("expires_at", new Date().toISOString()); // Only non-expired

  if (error) {
    console.error("Error fetching pending verifications:", error);
    throw error;
  }

  return data || [];
}

/**
 * Delete a pending verification by ID
 * @param {string} verificationId - UUID of the verification
 */
export async function deletePendingVerification(verificationId) {
  const { error } = await supabase
    .from("pending_verifications")
    .delete()
    .eq("id", verificationId);

  if (error) {
    console.error("Error deleting pending verification:", error);
    throw error;
  }
}

/**
 * Clean up expired pending verifications
 * @returns {Promise<number>} Number of deleted records
 */
export async function cleanupExpiredVerifications() {
  const { data, error } = await supabase
    .from("pending_verifications")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select();

  if (error) {
    console.error("Error cleaning up expired verifications:", error);
    throw error;
  }

  return data?.length || 0;
}

// =====================================================
// Linked Accounts Operations
// =====================================================

/**
 * Create a verified linked account
 * @param {Object} account - Account details
 * @returns {Promise<Object>} Created account record
 */
export async function createLinkedAccount(account) {
  const { discord_user_id, guild_id, platform, username, rank } = account;

  const { data, error } = await supabase
    .from("linked_accounts")
    .upsert(
      {
        discord_user_id,
        guild_id,
        platform,
        username,
        verified: true,
        verified_at: new Date().toISOString(),
        rank,
      },
      {
        onConflict: "discord_user_id,guild_id,platform,username",
      },
    )
    .select()
    .single();

  if (error) {
    console.error("Error creating linked account:", error);
    throw error;
  }

  return data;
}

/**
 * Get all linked accounts for a user in a guild
 * @param {string} discordUserId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Array>} Array of linked accounts
 */
export async function getLinkedAccounts(discordUserId, guildId) {
  const { data, error } = await supabase
    .from("linked_accounts")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .eq("guild_id", guildId)
    .eq("verified", true);

  if (error) {
    console.error("Error fetching linked accounts:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get all linked accounts for a guild (for leaderboard)
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Array>} Array of all linked accounts in the guild
 */
export async function getAllGuildLinkedAccounts(guildId) {
  const { data, error } = await supabase
    .from("linked_accounts")
    .select("*")
    .eq("guild_id", guildId)
    .eq("platform", "codeforces")
    .eq("verified", true);

  if (error) {
    console.error("Error fetching guild linked accounts:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get all linked accounts across all guilds (for role sync)
 * @returns {Promise<Array>} Array of all linked accounts
 */
export async function getAllLinkedAccounts() {
  const { data, error } = await supabase
    .from("linked_accounts")
    .select("*")
    .eq("verified", true);

  if (error) {
    console.error("Error fetching all linked accounts:", error);
    throw error;
  }

  return data || [];
}

/**
 * Update the rank of a linked account
 * @param {string} accountId - UUID of the linked account
 * @param {string} newRank - New Codeforces rank
 * @returns {Promise<Object>} Updated account record
 */
export async function updateLinkedAccountRank(accountId, newRank) {
  const { data, error } = await supabase
    .from("linked_accounts")
    .update({ rank: newRank })
    .eq("id", accountId)
    .select()
    .single();

  if (error) {
    console.error("Error updating linked account rank:", error);
    throw error;
  }

  return data;
}

/**
 * Check if an account is already linked by another user in the guild
 * @param {string} guildId - Discord guild ID
 * @param {string} platform - Platform name
 * @param {string} username - CP username
 * @param {string} excludeUserId - User ID to exclude from check
 * @returns {Promise<boolean>} True if account is already linked
 */
export async function isAccountLinkedByOther(
  guildId,
  platform,
  username,
  excludeUserId,
) {
  const { data, error } = await supabase
    .from("linked_accounts")
    .select("discord_user_id")
    .eq("guild_id", guildId)
    .eq("platform", platform)
    .ilike("username", username)
    .eq("verified", true)
    .neq("discord_user_id", excludeUserId)
    .limit(1);

  if (error) {
    console.error("Error checking account linkage:", error);
    throw error;
  }

  return data && data.length > 0;
}

export default supabase;
