import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { GetGlobalSearchQueryDto } from './dto/get-global-search-query.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('global')
  getGlobalSearch(@Query() query: GetGlobalSearchQueryDto) {
    return this.searchService.searchGlobal(query);
  }
}
