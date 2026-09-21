import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PublicCatalogService, type PublicProduct } from './public-catalog.service';

@ApiTags('public')
@Controller('public')
export class PublicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

  /** Public catalogue: image, name and description only — never price or barcode. */
  @Public()
  @ApiOkResponse({ description: 'Products sorted by name (id, name, description, imageUrl, thumbUrl)' })
  @Header('Cache-Control', 'public, max-age=60')
  @Get('products')
  products(): Promise<PublicProduct[]> {
    return this.catalog.list();
  }
}
