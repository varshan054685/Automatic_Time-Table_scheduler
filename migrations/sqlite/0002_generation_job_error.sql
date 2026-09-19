-- ============================================================================
-- Migration 0002: generation job failure reporting.
-- Adds a human-readable failure reason to generation jobs so Generation History
-- can explain what went wrong without re-running the solver (spec §9).
-- Additive only — existing data is untouched.
-- ============================================================================

ALTER TABLE generation_jobs ADD COLUMN error_message TEXT;
