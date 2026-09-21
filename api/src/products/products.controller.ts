import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { IMAGE_MAX_BYTES } from '../../../shared/validation';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import type { UploadedImage } from '../uploads/image-upload.service';
import {
  CreateProductDto,
  ListProductsQueryDto,
  ReorderProductsDto,
  UpdatePriceDto,
  UpdateProductDetailsDto,
} from './dto/products.dto';
import { ProductsService } from './products.service';

const imageUpload = () =>
  FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: IMAGE_MAX_BYTES, files: 1, fields: 8, fieldSize: 8 * 1024, parts: 10 },
  });

const multipartSchema = (required: string[]) => ({
  schema: {
    type: 'object',
    required,
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      barcode: { type: 'string' },
      image: { type: 'string', format: 'binary', description: 'JPEG, PNG or WebP, max 5 MB' },
    },
  },
});

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @RequirePermissions('product.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListProductsQueryDto) {
    return this.products.list(user, query);
  }

  /** Saves the showroom display order of the caller's branch (Super Admin: pass branchId). */
  @RequirePermissions('product.reorder')
  @Audit('product.reorder', { entity: 'Branch' })
  @Put('order')
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderProductsDto) {
    return this.products.reorder(user, dto);
  }

  @RequirePermissions('product.read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.get(id);
  }

  @RequirePermissions('product.read')
  @Get(':id/price-history')
  priceHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.priceHistory(id);
  }

  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartSchema(['name', 'image']))
  @RequirePermissions('product.create')
  @Audit('product.create', { entity: 'Product' })
  @UseInterceptors(imageUpload())
  @Post()
  create(@Body() dto: CreateProductDto, @UploadedFile() image: UploadedImage | undefined, @CurrentUser() user: AuthUser) {
    return this.products.create(dto, image, user);
  }

  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartSchema([]))
  @RequirePermissions('product.update.details')
  @Audit('product.update', { entity: 'Product', idParam: 'id' })
  @UseInterceptors(imageUpload())
  @Patch(':id')
  updateDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDetailsDto,
    @UploadedFile() image: UploadedImage | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.updateDetails(id, dto, image, user);
  }

  /** Finance: accepts only { price }. */
  @RequirePermissions('product.update.price')
  @Audit('product.price.update', { entity: 'Product', idParam: 'id' })
  @Patch(':id/price')
  updatePrice(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePriceDto, @CurrentUser() user: AuthUser) {
    return this.products.updatePrice(id, dto, user);
  }
}
