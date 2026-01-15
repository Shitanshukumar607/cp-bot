-- =====================================================
-- Supabase Database Schema for CP Verification Bot
-- =====================================================
-- Run this SQL in your Supabase SQL Editor to create
-- all necessary tables for the Discord bot.
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Table: guild_config
-- Stores per-server (guild) configuration including
-- verified role and rank-to-role mappings
-- =====================================================
CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    verified_role_id TEXT,
    rank_role_map JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guild_config_guild_id ON guild_config(guild_id);

-- =====================================================
-- Table: linked_accounts
-- Stores verified CP accounts linked to Discord users
-- Supports multiple accounts per user per platform
-- =====================================================
CREATE TABLE IF NOT EXISTS linked_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('codeforces')),
    username TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    rank TEXT, -- Stores Codeforces rank (newbie, pupil, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique account per platform per guild
    UNIQUE(discord_user_id, guild_id, platform, username)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_linked_accounts_user ON linked_accounts(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_platform ON linked_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_guild ON linked_accounts(guild_id);

-- =====================================================
-- Table: pending_verifications
-- Stores active verification sessions
-- Sessions expire after VERIFICATION_TIMEOUT minutes
-- =====================================================
CREATE TABLE IF NOT EXISTS pending_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('codeforces')),
    username TEXT NOT NULL,
    problem_id TEXT NOT NULL,
    problem_url TEXT NOT NULL,
    problem_name TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Prevent duplicate pending verifications for same account
    UNIQUE(discord_user_id, guild_id, platform, username)
);

-- Index for finding user's pending verifications
CREATE INDEX IF NOT EXISTS idx_pending_user ON pending_verifications(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_expires ON pending_verifications(expires_at);

-- =====================================================
-- Function: Automatically update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for guild_config
DROP TRIGGER IF EXISTS update_guild_config_updated_at ON guild_config;
CREATE TRIGGER update_guild_config_updated_at
    BEFORE UPDATE ON guild_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Function: Clean up expired pending verifications
-- Run this periodically via Supabase cron or manually
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM pending_verifications
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Row Level Security (RLS) Policies
-- Enable RLS for security (optional but recommended)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE guild_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all operations for service role
-- (Since bot uses service role, these allow full access)
CREATE POLICY "Allow all for service role" ON guild_config
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON linked_accounts
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON pending_verifications
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- Sample data for testing (optional - remove in production)
-- =====================================================
-- INSERT INTO guild_config (guild_id, verified_role_id, rank_role_map)
-- VALUES (
--     '123456789',
--     '987654321',
--     '{"newbie": "111", "pupil": "222", "specialist": "333", "expert": "444"}'::jsonb
-- );
