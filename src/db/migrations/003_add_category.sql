-- Migration 003: Add editorial category column to articles
ALTER TABLE articles ADD COLUMN category TEXT;
CREATE INDEX idx_articles_category ON articles(category);
