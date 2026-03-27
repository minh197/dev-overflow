-- ============================================================
-- Phase 1B: pg_trgm extension and trigram GIN indexes
--
-- Existing ILIKE '%...%' queries benefit automatically — no
-- query-layer changes required.  Write overhead note: GIN
-- trigram indexes on title and body_mdx will add latency to
-- every posts INSERT/UPDATE.  Benchmark p95 write latency
-- before and after deploying this migration in production.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for posts title (body covered by FTS vector below)
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm
  ON posts USING GIN (title gin_trgm_ops);

-- Trigram indexes for user identity fields
CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON users USING GIN (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
  ON users USING GIN (full_name gin_trgm_ops);

-- Trigram indexes for tag fields
CREATE INDEX IF NOT EXISTS idx_tags_display_name_trgm
  ON tags USING GIN (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tags_slug_trgm
  ON tags USING GIN (slug gin_trgm_ops);

-- B-tree index: prunes the users scan before the text match.
-- posts(type, status, created_at) already exists as idx_posts_listing.
CREATE INDEX IF NOT EXISTS idx_users_status
  ON users (status);

-- ============================================================
-- Phase 2: Full-text search — trigger-maintained tsvector
--
-- Composite ranking formula used in search.service.ts:
--   rank = ts_rank_cd(search_vector, query) * 0.6
--        + LEAST(up_vote_count, 1000)::float / 1000.0 * 0.25
--        + EXTRACT(EPOCH FROM created_at)::float
--          / EXTRACT(EPOCH FROM NOW())::float * 0.15
--
-- Weights:
--   A = title (questions) or parent question title (answers)
--   B = body_mdx
--
-- Parent question title is embedded at write time (not at query
-- time) via the trigger so no cross-row join occurs at search.
-- ============================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- GIN index — primary index for @@ operator (FTS path)
CREATE INDEX IF NOT EXISTS idx_posts_search_vector
  ON posts USING GIN (search_vector);

-- Bulk-populate search_vector for all existing rows
UPDATE posts
SET search_vector = CASE
  WHEN type = 'QUESTION' THEN
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body_mdx, '')), 'B')
  WHEN type = 'ANSWER' THEN
    setweight(
      to_tsvector('english', coalesce(
        (SELECT p2.title FROM posts p2 WHERE p2.id = posts.parent_question_id),
        ''
      )),
      'A'
    ) ||
    setweight(to_tsvector('english', coalesce(body_mdx, '')), 'B')
  ELSE
    to_tsvector('english', coalesce(body_mdx, ''))
END;

-- Trigger function: fires BEFORE INSERT OR UPDATE on relevant columns.
-- For ANSWER rows the parent question must already exist (FK constraint),
-- so the SELECT inside the trigger is safe.
CREATE OR REPLACE FUNCTION update_post_search_vector()
RETURNS trigger AS $$
DECLARE
  parent_title TEXT := '';
BEGIN
  IF NEW.type = 'QUESTION' THEN
    NEW.search_vector :=
      setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(NEW.body_mdx, '')), 'B');

  ELSIF NEW.type = 'ANSWER' THEN
    SELECT coalesce(title, '') INTO parent_title
    FROM posts
    WHERE id = NEW.parent_question_id;

    NEW.search_vector :=
      setweight(to_tsvector('english', parent_title), 'A') ||
      setweight(to_tsvector('english', coalesce(NEW.body_mdx, '')), 'B');

  ELSE
    NEW.search_vector :=
      to_tsvector('english', coalesce(NEW.body_mdx, ''));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop before recreating to make this migration idempotent
DROP TRIGGER IF EXISTS posts_search_vector_update ON posts;

CREATE TRIGGER posts_search_vector_update
  BEFORE INSERT OR UPDATE OF title, body_mdx, type, parent_question_id
  ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_post_search_vector();
