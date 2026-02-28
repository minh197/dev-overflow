import { Controller, Get, Query } from '@nestjs/common';
import { TagsService } from './tags.service';
import { GetPopularTagsQueryDto } from './dto/get-popular-tags-query.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get('popular')
  getPopularTags(@Query() _query: GetPopularTagsQueryDto) {
    return this.tagsService.listPopularTags();
  }
}
