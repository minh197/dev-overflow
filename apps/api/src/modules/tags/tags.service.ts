import { Injectable } from '@nestjs/common';
import { GetPopularTagsQueryDto } from './dto/get-popular-tags-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPopularTags(query: GetPopularTagsQueryDto) {
    const limit = query.limit ?? 10;

    return await this.prisma.tag.findMany({
      take: limit,
      orderBy: [{ questionCount: 'desc' }, { displayName: 'asc' }],
      select: {
        displayName: true,
        slug: true,
        iconUrl: true,
        questionCount: true,
      },
    });
  }
}
