import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PublicProductsQueryDto } from './public-catalog.dto';
import { PublicCatalogService, type PublicCategory, type PublicProduct } from './public-catalog.service';

@ApiTags('public')
@Controller('public')
export class PublicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

  /** Public catalogue: image, name, description, category and price — never the barcode. */
  @Public()
  @ApiOkResponse({ description: 'Products sorted by name (id, name, description, categoryId, price, imageUrl, thumbUrl)' })
  @Header('Cache-Control', 'public, max-age=60')
  @Get('products')
  products(@Query() query: PublicProductsQueryDto): Promise<PublicProduct[]> {
    return this.catalog.list(query.categoryId);
  }

  /** Car-model categories with a product count, largest first. */
  @Public()
  @ApiOkResponse({ description: 'Categories with at least one product (id, name, nameEn, carModel, imageUrl, thumbUrl, count)' })
  @Header('Cache-Control', 'public, max-age=60')
  @Get('categories')
  categories(): Promise<PublicCategory[]> {
    return this.catalog.categories();
  }
}
