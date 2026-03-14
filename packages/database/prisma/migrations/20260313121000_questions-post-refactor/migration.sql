-- DropForeignKey
ALTER TABLE "ai_answers" DROP CONSTRAINT "ai_answers_question_id_fkey";

-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT "answers_post_id_fkey";

-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT "answers_question_id_fkey";

-- DropForeignKey
ALTER TABLE "bookmarks" DROP CONSTRAINT "bookmarks_post_id_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_post_id_fkey";

-- DropForeignKey
ALTER TABLE "post_views" DROP CONSTRAINT "post_views_post_id_fkey";

-- DropForeignKey
ALTER TABLE "question_tags" DROP CONSTRAINT "question_tags_question_id_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_accepted_answer_id_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_post_id_fkey";

-- DropForeignKey
ALTER TABLE "votes" DROP CONSTRAINT "votes_post_id_fkey";

-- DropIndex
DROP INDEX "idx_ai_answers_question";

-- AlterTable
ALTER TABLE "ai_answers" ADD COLUMN "post_id" INTEGER;

-- AlterTable
ALTER TABLE "post_views" DROP COLUMN "ip_address";

-- AlterTable
ALTER TABLE "question_tags" ADD COLUMN "post_id" INTEGER;

-- Backfill ai_answers.post_id from questions.post_id before dropping questions
UPDATE "ai_answers" aa
SET "post_id" = q."post_id"
FROM "questions" q
WHERE aa."question_id" = q."id"
  AND aa."post_id" IS NULL;

-- Backfill question_tags.post_id from questions.post_id before dropping questions
UPDATE "question_tags" qt
SET "post_id" = q."post_id"
FROM "questions" q
WHERE qt."question_id" = q."id"
  AND qt."post_id" IS NULL;

-- Finalize ai_answers migration after backfill
ALTER TABLE "ai_answers"
ALTER COLUMN "post_id" SET NOT NULL,
DROP COLUMN "question_id";

-- Finalize question_tags key migration after backfill
ALTER TABLE "question_tags"
DROP CONSTRAINT "question_tags_pkey",
DROP COLUMN "question_id",
ALTER COLUMN "post_id" SET NOT NULL,
ADD CONSTRAINT "question_tags_pkey" PRIMARY KEY ("post_id", "tag_id");

-- DropTable
DROP TABLE "answers";

-- DropTable
DROP TABLE "questions";

-- CreateIndex
CREATE INDEX "idx_ai_answers_post" ON "ai_answers"("post_id");

-- AddForeignKey
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_tags" ADD CONSTRAINT "question_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_answers" ADD CONSTRAINT "ai_answers_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

