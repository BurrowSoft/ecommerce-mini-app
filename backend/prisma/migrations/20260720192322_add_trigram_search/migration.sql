-- Trigram search: chosen over plain ILIKE (can't use an index, O(n) scan) and over
-- tsvector full-text search (better relevance ranking, but weaker on partial/typo
-- matches, which matter more for a product search box). See README "Search" section.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX products_name_trgm_idx ON products USING gin (name gin_trgm_ops);
CREATE INDEX products_description_trgm_idx ON products USING gin (description gin_trgm_ops);
