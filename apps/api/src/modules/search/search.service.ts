import { Injectable } from '@nestjs/common';

@Injectable()
export class SearchService {
  globalSearch() {
    return {
      enabled: false,
      reason:
        'Global search is intentionally disabled for this integration pass.',
      groups: {
        questions: [],
        answers: [],
        users: [],
        tags: [],
      },
    };
  }
}
