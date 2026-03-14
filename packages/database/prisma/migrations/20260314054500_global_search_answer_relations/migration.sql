-- AlterTable
ALTER TABLE "posts" ADD COLUMN "parent_question_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_posts_parent_question" ON "posts"("parent_question_id", "type");

-- AddForeignKey
ALTER TABLE "posts"
ADD CONSTRAINT "posts_parent_question_id_fkey"
FOREIGN KEY ("parent_question_id") REFERENCES "posts"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
