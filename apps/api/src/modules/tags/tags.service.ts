import { Injectable } from '@nestjs/common';

@Injectable()
export class TagsService {
  listPopularTags() {
    return { message: 'TODO: implement GET /tags/popular' };
  }
}
