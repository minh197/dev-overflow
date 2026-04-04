import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const SEARCH_COLLECTION_QUESTIONS = 'search_questions';
export const SEARCH_COLLECTION_ANSWERS = 'search_answers';
export const SEARCH_COLLECTION_USERS = 'search_users';
export const SEARCH_COLLECTION_TAGS = 'search_tags';

export const searchQuestionsSchema: CollectionCreateSchema = {
  name: SEARCH_COLLECTION_QUESTIONS,
  fields: [
    { name: 'title', type: 'string' },
    { name: 'body_mdx', type: 'string', optional: true },
    { name: 'tag_display_names', type: 'string[]', optional: true },
    { name: 'author_username', type: 'string' },
    { name: 'author_full_name', type: 'string', optional: true },
    { name: 'up_vote_count', type: 'int32' },
    { name: 'created_at', type: 'int64' },
    { name: 'status', type: 'string', facet: true },
  ],
};

export const searchAnswersSchema: CollectionCreateSchema = {
  name: SEARCH_COLLECTION_ANSWERS,
  fields: [
    { name: 'body_mdx', type: 'string' },
    { name: 'parent_question_id', type: 'int32' },
    { name: 'parent_title', type: 'string', optional: true },
    { name: 'author_username', type: 'string' },
    { name: 'author_full_name', type: 'string', optional: true },
    { name: 'up_vote_count', type: 'int32' },
    { name: 'created_at', type: 'int64' },
    { name: 'status', type: 'string', facet: true },
  ],
};

export const searchUsersSchema: CollectionCreateSchema = {
  name: SEARCH_COLLECTION_USERS,
  fields: [
    { name: 'username', type: 'string' },
    { name: 'full_name', type: 'string', optional: true },
    { name: 'reputation', type: 'int32' },
    { name: 'status', type: 'string', facet: true },
  ],
};

export const searchTagsSchema: CollectionCreateSchema = {
  name: SEARCH_COLLECTION_TAGS,
  fields: [
    { name: 'slug', type: 'string' },
    { name: 'display_name', type: 'string' },
    { name: 'question_count', type: 'int32' },
  ],
};

export const ALL_SEARCH_COLLECTION_SCHEMAS: CollectionCreateSchema[] = [
  searchQuestionsSchema,
  searchAnswersSchema,
  searchUsersSchema,
  searchTagsSchema,
];
