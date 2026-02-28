import { Injectable } from '@nestjs/common';

@Injectable()
export class SearchService {
  globalSearch() {
    return { message: 'TODO: implement GET /search/global' };
  }
}
