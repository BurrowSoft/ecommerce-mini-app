import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CatalogService } from './catalog.service';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { SuggestQueryDto } from './dto/suggest-query.dto';

@Controller('products')
@UseGuards(SessionAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async getProducts(@Query() query: GetProductsQueryDto) {
    return this.catalogService.getProducts(query);
  }

  @Get('suggest')
  async suggest(@Query() query: SuggestQueryDto) {
    return { suggestions: await this.catalogService.suggest(query.q ?? '') };
  }
}
