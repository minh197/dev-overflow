/*
  Warnings:

  - You are about to drop the column `search_vector` on the `posts` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_posts_search_vector";

-- DropIndex
DROP INDEX "idx_posts_title_trgm";

-- DropIndex
DROP INDEX "idx_tags_display_name_trgm";

-- DropIndex
DROP INDEX "idx_tags_slug_trgm";

-- DropIndex
DROP INDEX "idx_users_full_name_trgm";

-- DropIndex
DROP INDEX "idx_users_username_trgm";

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "search_vector";
