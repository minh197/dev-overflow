import { ForbiddenException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { QuestionsService } from './questions.service';

describe('QuestionsService', () => {
  const makePrismaMock = () => {
    const tx = {
      post: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      questionTag: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        groupBy: jest.fn(),
      },
      vote: { deleteMany: jest.fn() },
      bookmark: { deleteMany: jest.fn() },
      comment: { deleteMany: jest.fn() },
      postView: { deleteMany: jest.fn() },
      aiAnswer: { deleteMany: jest.fn() },
      tag: { update: jest.fn() },
    };

    const prisma = {
      user: { findFirst: jest.fn() },
      post: { findFirst: jest.fn() },
      tag: { findMany: jest.fn() },
      $transaction: jest.fn(async (callback) => callback(tx)),
      __tx: tx,
    };

    return prisma;
  };

  const actor = {
    id: 1,
    username: 'seed_alex',
    fullName: 'Alex',
    avatarUrl: null,
  };

  const baseQuestionRow = {
    id: 11,
    userId: 2,
    title: 'Question title',
    bodyMdx: 'Body',
    status: PostStatus.ACTIVE,
    createdAt: new Date(),
    upVoteCount: 0,
    answerCount: 0,
    viewCount: 0,
    user: {
      id: 2,
      fullName: 'Owner User',
      username: 'owner',
      avatarUrl: null,
    },
    questionTags: [{ tag: { id: 7, displayName: 'nestjs' } }],
    answers: [],
  };

  afterEach(() => {
    delete process.env.QUESTION_ADMIN_USERNAMES;
    jest.clearAllMocks();
  });

  it('rejects update when actor is neither owner nor admin', async () => {
    const prisma = makePrismaMock();
    prisma.user.findFirst.mockResolvedValueOnce(actor);
    prisma.post.findFirst.mockResolvedValue(baseQuestionRow);

    const service = new QuestionsService(prisma as never);

    await expect(
      service.updateQuestion(11, { title: 'Updated title' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hard deletes related rows and post for admin actor', async () => {
    process.env.QUESTION_ADMIN_USERNAMES = 'seed_alex';

    const prisma = makePrismaMock();
    prisma.user.findFirst.mockResolvedValueOnce(actor);
    prisma.post.findFirst.mockResolvedValue(baseQuestionRow);
    prisma.__tx.questionTag.groupBy.mockResolvedValue([{ tagId: 7, _count: { tagId: 0 } }]);

    const service = new QuestionsService(prisma as never);

    const result = await service.deleteQuestion(11);

    expect(result).toEqual({ id: 11, deleted: true });
    expect(prisma.__tx.questionTag.deleteMany).toHaveBeenCalledWith({
      where: { postId: 11 },
    });
    expect(prisma.__tx.vote.deleteMany).toHaveBeenCalledWith({
      where: { postId: 11 },
    });
    expect(prisma.__tx.bookmark.deleteMany).toHaveBeenCalledWith({
      where: { postId: 11 },
    });
    expect(prisma.__tx.comment.deleteMany).toHaveBeenCalledWith({
      where: { postId: 11 },
    });
    expect(prisma.__tx.postView.deleteMany).toHaveBeenCalledWith({
      where: { postId: 11 },
    });
    expect(prisma.__tx.aiAnswer.deleteMany).toHaveBeenCalledWith({
      where: { postId: 11 },
    });
    expect(prisma.__tx.post.delete).toHaveBeenCalledWith({ where: { id: 11 } });
  });
});
