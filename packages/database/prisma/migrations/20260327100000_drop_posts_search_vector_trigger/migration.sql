-- search_vector was dropped in 20260327085437_init, but the BEFORE INSERT/UPDATE
-- trigger from 20260321120000_search_optimization was left on posts. Inserts then
-- failed inside the trigger when assigning NEW.search_vector.
DROP TRIGGER IF EXISTS posts_search_vector_update ON posts;
DROP FUNCTION IF EXISTS update_post_search_vector();
