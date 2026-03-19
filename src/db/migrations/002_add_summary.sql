-- Migration 002: Add summary column to articles
ALTER TABLE articles ADD COLUMN summary TEXT;
