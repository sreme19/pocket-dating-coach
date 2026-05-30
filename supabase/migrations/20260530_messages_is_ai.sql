-- Migration: Mark AI Bestie messages
-- Adds an is_ai column to verified_vibe_messages so both sides of the chat
-- can style AI-sent messages differently.

ALTER TABLE verified_vibe_messages
  ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT FALSE;
