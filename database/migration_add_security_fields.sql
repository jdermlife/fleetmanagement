-- Migration: Add enterprise security fields to users table
-- Date: 2026-06-22
-- Purpose: Support account lockout, password reset, and failed login tracking

-- For SQLite
BEGIN TRANSACTION;

-- Add columns if they don't exist (SQLite doesn't support IF NOT EXISTS for ALTER TABLE in older versions)
-- We'll check in Python and create if needed

PRAGMA table_info(users);

-- These columns should be added to the users table:
-- - failed_login_attempts INTEGER DEFAULT 0
-- - locked_until TEXT (ISO format datetime, nullable)
-- - password_reset_token TEXT (nullable)
-- - password_reset_token_expires TEXT (ISO format datetime, nullable)

COMMIT;
