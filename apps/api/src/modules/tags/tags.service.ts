import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { GetPopularTagsQueryDto } from './dto/get-popular-tags-query.dto';
import { ListTagsQueryDto, TagsListSort } from './dto/list-tags-query.dto';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_TAG_LIST_LIMIT = 500;

const tagListSelect = {
  id: true,
  displayName: true,
  slug: true,
  description: true,
  questionCount: true,
  iconUrl: true,
} satisfies Prisma.TagSelect;

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTags(dto: ListTagsQueryDto) {
    const sort = dto.sort ?? TagsListSort.popular;
    const limit = dto.limit ?? DEFAULT_TAG_LIST_LIMIT;
    const q = dto.q?.trim();

    const where: Prisma.TagWhereInput =
      q && q.length > 0
        ? {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {};

    const orderBy: Prisma.TagOrderByWithRelationInput[] =
      sort === TagsListSort.name
        ? [{ displayName: 'asc' }]
        : [{ questionCount: 'desc' }, { displayName: 'asc' }];

    const tags = await this.prisma.tag.findMany({
      where,
      orderBy,
      take: limit,
      select: tagListSelect,
    });

    return { tags };
  }

  async listPopularTags(query: GetPopularTagsQueryDto) {
    const limit = query.limit ?? 10;

    return await this.prisma.tag.findMany({
      take: limit,
      orderBy: [{ questionCount: 'desc' }, { displayName: 'asc' }],
      select: {
        id: true,
        displayName: true,
        slug: true,
        iconUrl: true,
        questionCount: true,
      },
    });
  }
}
