import { PostType } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { SearchIndexDocumentBuilderService } from './search-index-document-builder.service';
import { SearchIndexService } from './search-index.service';
import {
  SEARCH_COLLECTION_ANSWERS,
  SEARCH_COLLECTION_QUESTIONS,
  SEARCH_COLLECTION_TAGS,
} from './typesense.collections';

type CallEntry =
  | { kind: 'filterDelete'; col: string; filter: string }
  | { kind: 'docDelete'; col: string; id: string }
  | { kind: 'import'; col: string; count: number };

function makeTypesenseMock(): {
  client: unknown;
  calls: CallEntry[];
} {
  const calls: CallEntry[] = [];

  const client = {
    collections: (col: string) => ({
      documents: (docId?: string) => {
        if (docId !== undefined) {
          return {
            delete: () => {
              calls.push({ kind: 'docDelete', col, id: String(docId) });
              return Promise.resolve();
            },
          };
        }
        return {
          import: (docs: unknown[]) => {
            calls.push({ kind: 'import', col, count: docs.length });
            return Promise.resolve(docs.map(() => ({ success: true })));
          },
          delete: (q: { filter_by: string }) => {
            calls.push({ kind: 'filterDelete', col, filter: q.filter_by });
            return Promise.resolve();
          },
        };
      },
    }),
  };

  return { client, calls };
}

function makeDocBuilderMock(
  overrides: Partial<
    Record<keyof SearchIndexDocumentBuilderService, unknown>
  > = {},
): SearchIndexDocumentBuilderService {
  const defaultResult = {
    docs: [] as Record<string, unknown>[],
    missingIds: [] as number[],
  };
  return {
    buildQuestionDocs: jest.fn().mockResolvedValue(defaultResult),
    buildAnswerDocs: jest.fn().mockResolvedValue(defaultResult),
    buildUserDocs: jest.fn().mockResolvedValue(defaultResult),
    buildTagDocs: jest.fn().mockResolvedValue(defaultResult),
    answerPostIdsForQuestion: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as SearchIndexDocumentBuilderService;
}

function makePrismaMock(): PrismaService {
  return {
    post: { findUnique: jest.fn() },
  } as unknown as PrismaService;
}

describe('SearchIndexService', () => {
  it('coalesces repeat enqueues for the same key before flushing', async () => {
    const { client, calls } = makeTypesenseMock();
    const buildQuestionDocs = jest
      .fn()
      .mockResolvedValue({ docs: [{ id: '1' }], missingIds: [] });
    const docBuilder = makeDocBuilderMock({ buildQuestionDocs });
    const svc = new SearchIndexService(
      makePrismaMock(),
      docBuilder,
      client as never,
    );

    for (let i = 0; i < 10_000; i++) {
      svc.syncQuestionById(1);
    }

    await svc.flush();

    const imports = calls.filter((c) => c.kind === 'import');
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      col: SEARCH_COLLECTION_QUESTIONS,
      count: 1,
    });
    expect(buildQuestionDocs).toHaveBeenCalledTimes(1);
    expect(buildQuestionDocs).toHaveBeenCalledWith([1]);
  });

  it('last enqueue wins per key (delete after upsert resolves to delete)', async () => {
    const { client, calls } = makeTypesenseMock();
    const svc = new SearchIndexService(
      makePrismaMock(),
      makeDocBuilderMock(),
      client as never,
    );

    svc.syncQuestionById(42);
    svc.removeQuestionDocument(42);

    await svc.flush();

    expect(calls.filter((c) => c.kind === 'import')).toHaveLength(0);
    expect(calls).toContainEqual({
      kind: 'docDelete',
      col: SEARCH_COLLECTION_QUESTIONS,
      id: '42',
    });
  });

  it('flushes in order: filter delete → doc delete → import', async () => {
    const { client, calls } = makeTypesenseMock();
    const docBuilder = makeDocBuilderMock({
      buildQuestionDocs: jest
        .fn()
        .mockResolvedValue({ docs: [{ id: '2' }], missingIds: [] }),
    });
    const svc = new SearchIndexService(
      makePrismaMock(),
      docBuilder,
      client as never,
    );

    svc.deleteAnswersForQuestion(9);
    svc.removeQuestionDocument(1);
    svc.syncQuestionById(2);

    await svc.flush();

    const kinds = calls.map((c) => c.kind);
    const filterIdx = kinds.indexOf('filterDelete');
    const docDelIdx = kinds.indexOf('docDelete');
    const importIdx = kinds.indexOf('import');

    expect(filterIdx).toBeGreaterThanOrEqual(0);
    expect(docDelIdx).toBeGreaterThan(filterIdx);
    expect(importIdx).toBeGreaterThan(docDelIdx);

    expect(calls[filterIdx]).toMatchObject({
      col: SEARCH_COLLECTION_ANSWERS,
      filter: 'parent_question_id:9',
    });
    expect(calls[docDelIdx]).toMatchObject({
      col: SEARCH_COLLECTION_QUESTIONS,
      id: '1',
    });
  });

  it('patchParentTitle re-imports all answers for that question', async () => {
    const { client, calls } = makeTypesenseMock();
    const answerPostIdsForQuestion = jest.fn().mockResolvedValue([10, 11]);
    const buildAnswerDocs = jest.fn().mockResolvedValue({
      docs: [{ id: '10' }, { id: '11' }],
      missingIds: [],
    });
    const docBuilder = makeDocBuilderMock({
      answerPostIdsForQuestion,
      buildAnswerDocs,
    });
    const svc = new SearchIndexService(
      makePrismaMock(),
      docBuilder,
      client as never,
    );

    svc.updateAnswersParentTitle(7, 'New title');

    await svc.flush();

    expect(answerPostIdsForQuestion).toHaveBeenCalledWith(7);
    expect(buildAnswerDocs).toHaveBeenCalledWith([10, 11]);
    const answerImports = calls.filter(
      (c) => c.kind === 'import' && c.col === SEARCH_COLLECTION_ANSWERS,
    );
    expect(answerImports).toHaveLength(1);
    expect(answerImports[0]).toMatchObject({ count: 2 });
  });

  it('removes stale docs that Postgres no longer returns', async () => {
    const { client, calls } = makeTypesenseMock();
    const docBuilder = makeDocBuilderMock({
      buildTagDocs: jest.fn().mockResolvedValue({ docs: [], missingIds: [5] }),
    });
    const svc = new SearchIndexService(
      makePrismaMock(),
      docBuilder,
      client as never,
    );

    svc.syncTagById(5);
    await svc.flush();

    expect(
      calls.filter(
        (c) => c.kind === 'import' && c.col === SEARCH_COLLECTION_TAGS,
      ),
    ).toHaveLength(0);
    expect(calls).toContainEqual({
      kind: 'docDelete',
      col: SEARCH_COLLECTION_TAGS,
      id: '5',
    });
  });

  it('is a no-op without a Typesense client', async () => {
    const svc = new SearchIndexService(
      makePrismaMock(),
      makeDocBuilderMock(),
      null,
    );

    svc.syncQuestionById(1);
    await svc.flush();

    expect(svc.isConfigured()).toBe(false);
  });

  it('syncPostVoteCounts enqueues based on Postgres post type', async () => {
    const { client, calls } = makeTypesenseMock();
    const findUnique = jest.fn().mockResolvedValue({ type: PostType.QUESTION });
    const prisma = {
      post: { findUnique },
    } as unknown as PrismaService;
    const docBuilder = makeDocBuilderMock({
      buildQuestionDocs: jest
        .fn()
        .mockResolvedValue({ docs: [{ id: '3' }], missingIds: [] }),
    });
    const svc = new SearchIndexService(prisma, docBuilder, client as never);

    svc.syncPostVoteCounts(3);
    await new Promise((r) => setImmediate(r));
    await svc.flush();

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { type: true },
    });
    expect(
      calls.filter(
        (c) => c.kind === 'import' && c.col === SEARCH_COLLECTION_QUESTIONS,
      ),
    ).toHaveLength(1);
  });
});
