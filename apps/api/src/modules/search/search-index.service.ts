import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { PostType } from '@prisma/client';
import Typesense, { type Client } from 'typesense';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchIndexDocumentBuilderService } from './search-index-document-builder.service';
import {
  getSearchIndexFlushIntervalMs,
  getTypesenseConfigurationOptions,
} from './search-env';
import {
  SEARCH_COLLECTION_ANSWERS,
  SEARCH_COLLECTION_QUESTIONS,
  SEARCH_COLLECTION_TAGS,
  SEARCH_COLLECTION_USERS,
} from './typesense.collections';
import { TYPESENSE_CLIENT } from './typesense.constants';

type QueuedOp =
  | { kind: 'qUpsert' | 'qDelete'; id: number }
  | { kind: 'aUpsert' | 'aDelete'; id: number }
  | { kind: 'uUpsert' | 'uDelete'; id: number }
  | { kind: 'tUpsert' | 'tDelete'; id: number }
  | { kind: 'answersFilterDelete'; parentQuestionId: number }
  | { kind: 'patchParentTitle'; questionId: number };

const IMPORT_BATCH_SIZE = 200;
const DELETE_CONCURRENCY = 20;

@Injectable()
export class SearchIndexService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchIndexService.name);
  private pending = new Map<string, QueuedOp>();
  private flushing = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly docBuilder: SearchIndexDocumentBuilderService,
    @Optional()
    @Inject(TYPESENSE_CLIENT)
    private readonly typesense: Client | null,
  ) {}

  private get client(): Client | null {
    return this.typesense ?? null;
  }

  /** True when Typesense client is wired (env had host + API key). */
  isConfigured(): boolean {
    return this.client !== null;
  }

  onModuleInit(): void {
    if (!this.client) return;
    const ms = getSearchIndexFlushIntervalMs();
    this.timer = setInterval(() => {
      void this.flush();
    }, ms);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Best-effort final drain so graceful shutdown does not lose ops.
    await this.flush();
  }

  // -------------------------------------------------------------------------
  // Public API (call-sites unchanged). All synchronous enqueues.
  // -------------------------------------------------------------------------

  syncQuestionById(postId: number): void {
    this.enqueue(`q:${postId}`, { kind: 'qUpsert', id: postId });
  }

  removeQuestionDocument(postId: number): void {
    this.enqueue(`q:${postId}`, { kind: 'qDelete', id: postId });
  }

  deleteAnswersForQuestion(parentQuestionId: number): void {
    this.enqueue(`af:${parentQuestionId}`, {
      kind: 'answersFilterDelete',
      parentQuestionId,
    });
  }

  syncAnswerById(answerPostId: number): void {
    this.enqueue(`a:${answerPostId}`, { kind: 'aUpsert', id: answerPostId });
  }

  removeAnswerDocument(answerPostId: number): void {
    this.enqueue(`a:${answerPostId}`, { kind: 'aDelete', id: answerPostId });
  }

  syncPostVoteCounts(postId: number): void {
    if (!this.client) return;
    void this.prisma.post
      .findUnique({ where: { id: postId }, select: { type: true } })
      .then((p) => {
        if (!p) return;
        if (p.type === PostType.QUESTION) {
          this.syncQuestionById(postId);
        } else if (p.type === PostType.ANSWER) {
          this.syncAnswerById(postId);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Vote-count enqueue failed (${postId}): ${msg}`);
      });
  }

  syncUserById(userId: number): void {
    this.enqueue(`u:${userId}`, { kind: 'uUpsert', id: userId });
  }

  removeUserDocument(userId: number): void {
    this.enqueue(`u:${userId}`, { kind: 'uDelete', id: userId });
  }

  syncTagById(tagId: number): void {
    this.enqueue(`t:${tagId}`, { kind: 'tUpsert', id: tagId });
  }

  syncTagsByIds(tagIds: number[]): void {
    for (const id of new Set(tagIds)) {
      if (id > 0) this.syncTagById(id);
    }
  }

  updateAnswersParentTitle(questionId: number, _parentTitle: string): void {
    void _parentTitle;
    // Title is re-fetched from Postgres at flush time via buildAnswerDocs,
    // so we only need to remember which question's answers must be re-imported.
    this.enqueue(`pt:${questionId}`, {
      kind: 'patchParentTitle',
      questionId,
    });
  }

  // -------------------------------------------------------------------------
  // Queue + flush internals
  // -------------------------------------------------------------------------

  private enqueue(key: string, op: QueuedOp): void {
    if (!this.client) return;
    this.pending.set(key, op);
  }

  /** Public so onModuleDestroy + tests can trigger a flush directly. */
  async flush(): Promise<void> {
    if (!this.client) return;
    if (this.flushing) return;
    if (this.pending.size === 0) return;

    this.flushing = true;
    const batch = this.pending;
    this.pending = new Map();

    try {
      await this.flushBatch(batch);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Search index flush failed: ${msg}`);
    } finally {
      this.flushing = false;
    }
  }

  private async flushBatch(batch: Map<string, QueuedOp>): Promise<void> {
    const client = this.client;
    if (!client) return;

    const qUp = new Set<number>();
    const qDel = new Set<number>();
    const aUp = new Set<number>();
    const aDel = new Set<number>();
    const uUp = new Set<number>();
    const uDel = new Set<number>();
    const tUp = new Set<number>();
    const tDel = new Set<number>();
    const filterParents = new Set<number>();
    const patchParents = new Set<number>();

    for (const op of batch.values()) {
      switch (op.kind) {
        case 'qUpsert':
          qUp.add(op.id);
          break;
        case 'qDelete':
          qDel.add(op.id);
          break;
        case 'aUpsert':
          aUp.add(op.id);
          break;
        case 'aDelete':
          aDel.add(op.id);
          break;
        case 'uUpsert':
          uUp.add(op.id);
          break;
        case 'uDelete':
          uDel.add(op.id);
          break;
        case 'tUpsert':
          tUp.add(op.id);
          break;
        case 'tDelete':
          tDel.add(op.id);
          break;
        case 'answersFilterDelete':
          filterParents.add(op.parentQuestionId);
          break;
        case 'patchParentTitle':
          patchParents.add(op.questionId);
          break;
      }
    }

    // 1. Filter-delete answers by parent question (e.g. when question is removed).
    for (const parentId of filterParents) {
      await client
        .collections(SEARCH_COLLECTION_ANSWERS)
        .documents()
        .delete({ filter_by: `parent_question_id:${parentId}` });
    }

    // 2. Single-doc deletes (parallel within each collection).
    await this.deleteDocs(client, SEARCH_COLLECTION_QUESTIONS, [...qDel]);
    await this.deleteDocs(client, SEARCH_COLLECTION_ANSWERS, [...aDel]);
    await this.deleteDocs(client, SEARCH_COLLECTION_USERS, [...uDel]);
    await this.deleteDocs(client, SEARCH_COLLECTION_TAGS, [...tDel]);

    // 3. Bulk upserts. Anything Postgres no longer knows about is removed.
    await this.importAndPrune(
      client,
      SEARCH_COLLECTION_QUESTIONS,
      [...qUp],
      (ids) => this.docBuilder.buildQuestionDocs(ids),
    );
    await this.importAndPrune(
      client,
      SEARCH_COLLECTION_ANSWERS,
      [...aUp],
      (ids) => this.docBuilder.buildAnswerDocs(ids),
    );
    await this.importAndPrune(
      client,
      SEARCH_COLLECTION_USERS,
      [...uUp],
      (ids) => this.docBuilder.buildUserDocs(ids),
    );
    await this.importAndPrune(client, SEARCH_COLLECTION_TAGS, [...tUp], (ids) =>
      this.docBuilder.buildTagDocs(ids),
    );

    // 4. Title change on a question => re-import its answers so parent_title stays fresh.
    for (const qid of patchParents) {
      const answerIds = await this.docBuilder.answerPostIdsForQuestion(qid);
      if (answerIds.length === 0) continue;
      await this.importAndPrune(
        client,
        SEARCH_COLLECTION_ANSWERS,
        answerIds,
        (ids) => this.docBuilder.buildAnswerDocs(ids),
      );
    }
  }

  private async importAndPrune(
    client: Client,
    collectionName: string,
    ids: number[],
    build: (
      ids: number[],
    ) => Promise<{ docs: Record<string, unknown>[]; missingIds: number[] }>,
  ): Promise<void> {
    if (ids.length === 0) return;
    const { docs, missingIds } = await build(ids);
    await this.importBatches(client, collectionName, docs);
    if (missingIds.length > 0) {
      await this.deleteDocs(client, collectionName, missingIds);
    }
  }

  private async importBatches(
    client: Client,
    collectionName: string,
    docs: Record<string, unknown>[],
  ): Promise<void> {
    for (let i = 0; i < docs.length; i += IMPORT_BATCH_SIZE) {
      const chunk = docs.slice(i, i + IMPORT_BATCH_SIZE);
      if (chunk.length === 0) continue;
      const res = await client
        .collections(collectionName)
        .documents()
        .import(chunk, { action: 'upsert' });
      const arr = Array.isArray(res) ? res : [];
      const failures = arr.filter(
        (r: { success?: boolean }) => r.success === false,
      );
      if (failures.length > 0) {
        this.logger.warn(
          `${collectionName} import failures: ${failures.length} (sample: ${JSON.stringify(failures[0])})`,
        );
      }
    }
  }

  private async deleteDocs(
    client: Client,
    collectionName: string,
    ids: number[],
  ): Promise<void> {
    const unique = [...new Set(ids)].filter((x) => x > 0);
    for (let i = 0; i < unique.length; i += DELETE_CONCURRENCY) {
      const slice = unique.slice(i, i + DELETE_CONCURRENCY);
      await Promise.all(
        slice.map((id) =>
          this.safeDeleteDoc(client, collectionName, String(id)),
        ),
      );
    }
  }

  private async safeDeleteDoc(
    client: Client,
    collectionName: string,
    id: string,
  ): Promise<void> {
    try {
      await client.collections(collectionName).documents(id).delete();
    } catch (e: unknown) {
      const status =
        e && typeof e === 'object' && 'httpStatus' in e
          ? (e as { httpStatus?: number }).httpStatus
          : undefined;
      if (status !== 404) throw e;
    }
  }
}

/** Used by CLI reindex script (non-DI). */
export function createTypesenseClientFromEnv(): Client | null {
  const opts = getTypesenseConfigurationOptions();
  if (!opts) return null;
  return new Typesense.Client(opts);
}
