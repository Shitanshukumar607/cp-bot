import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "../types/db.types.js";
import type {
  CodeforcesRank,
  GuildConfig,
  LinkedAccounts,
  PendingVerification,
} from "../types/types.js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/** Get guild configuration by guild ID */
export async function getGuildConfig(
  guildId: string,
): Promise<GuildConfig | null> {
  const { data, error } = await supabase
    .from("guild_config")
    .select("*")
    .eq("guild_id", guildId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching guild config:", error);
    throw error;
  }

  return data;
}

/** Set or update the verified role for a guild */
export async function setVerifiedRole(guildId: string, roleId: string) {
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

/** Set or update the rank role mapping for a guild */
export async function setRankRole(
  guildId: string,
  rank: CodeforcesRank,
  roleId: string,
) {
  const existing = await getGuildConfig(guildId);
  const currentMap = (existing?.rank_role_map || {}) as Record<string, string>;

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

/** Create a new pending verification session */
export async function createPendingVerification(
  verification: PendingVerification,
): Promise<PendingVerification> {
  const {
    discord_user_id,
    guild_id,
    username,
    problem_id,
    problem_url,
    problem_name,
    expires_at,
  } = verification;

  await supabase
    .from("pending_verifications")
    .delete()
    .eq("discord_user_id", discord_user_id)
    .eq("guild_id", guild_id)
    .eq("username", username);

  const { data, error } = await supabase
    .from("pending_verifications")
    .insert({
      discord_user_id,
      guild_id,
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

/** Get all pending verifications for a user in a guild */
export async function getPendingVerifications(
  discordUserId: string,
  guildId: string,
): Promise<Array<PendingVerification>> {
  const { data, error } = await supabase
    .from("pending_verifications")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .eq("guild_id", guildId)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    console.error("Error fetching pending verifications:", error);
    throw error;
  }

  return data || [];
}

/** Delete a pending verification by ID */
export async function deletePendingVerification(
  verificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("pending_verifications")
    .delete()
    .eq("id", verificationId);

  if (error) {
    console.error("Error deleting pending verification:", error);
    throw error;
  }
}

/** Clean up expired pending verifications */
export async function cleanupExpiredVerifications(): Promise<number> {
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

/** Create a verified linked account */
export async function createLinkedAccount(account: {
  discord_user_id: string;
  guild_id: string;
  username: string;
  rank: CodeforcesRank | null;
}): Promise<LinkedAccounts> {
  const { discord_user_id, guild_id, username, rank } = account;

  const { data, error } = await supabase
    .from("linked_accounts")
    .upsert(
      {
        discord_user_id,
        guild_id,
        username,
        verified: true,
        verified_at: new Date().toISOString(),
        rank,
      },
      {
        onConflict: "discord_user_id,guild_id,username",
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

/** Get all linked accounts for a user in a guild */
export async function getLinkedAccounts(
  discordUserId: string,
  guildId: string,
): Promise<Array<LinkedAccounts>> {
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

/** Get all linked accounts for a guild */
export async function getAllGuildLinkedAccounts(
  guildId: string,
): Promise<Array<LinkedAccounts>> {
  const { data, error } = await supabase
    .from("linked_accounts")
    .select("*")
    .eq("guild_id", guildId)
    .eq("verified", true);

  if (error) {
    console.error("Error fetching guild linked accounts:", error);
    throw error;
  }

  return data || [];
}

/** Get all linked accounts across all guilds */
export async function getAllLinkedAccounts(): Promise<Array<LinkedAccounts>> {
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

/** Update the rank of a linked account */
export async function updateLinkedAccountRank(
  accountId: string,
  newRank: string,
): Promise<LinkedAccounts> {
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

/** Check if an account is already linked by another user in the guild */
export async function isAccountLinkedByOther(
  guildId: string,
  username: string,
  excludeUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("linked_accounts")
    .select("discord_user_id")
    .eq("guild_id", guildId)
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
