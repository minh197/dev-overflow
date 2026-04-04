import { Module } from '@nestjs/common';
import Typesense from 'typesense';
import { PrismaModule } from '../../prisma/prisma.module';
import { SearchController } from './search.controller';
import { getTypesenseConfigurationOptions } from './search-env';
import { SearchIndexService } from './search-index.service';
import { SearchService } from './search.service';
import { TYPESENSE_CLIENT } from './typesense.constants';

@Module({
  imports: [PrismaModule],
  controllers: [SearchController],
  providers: [
    {
      provide: TYPESENSE_CLIENT,
      useFactory: () => {
        const opts = getTypesenseConfigurationOptions();
        if (!opts) {
          return null;
        }
        return new Typesense.Client(opts);
      },
    },
    SearchService,
    SearchIndexService,
  ],
  exports: [SearchService, SearchIndexService],
})
export class SearchModule {}
