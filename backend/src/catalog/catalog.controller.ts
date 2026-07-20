import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CatalogService } from './catalog.service';
import { GetProductsQueryDto } from './dto/get-products-query.dto';

@Controller('products')
@UseGuards(SessionAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async getProducts(@Query() query: GetProductsQueryDto) {
    return this.catalogService.getProducts(query);
  }
}
