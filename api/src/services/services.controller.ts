import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import { CreateServiceDto, UpdateServiceDto, UpdateTierDto } from './dto/services.dto';
import { ServicesService } from './services.service';

/**
 * The dashboard's services and packages page. A price is changed through
 * PATCH /products/:id/price with the cell's productId, so it gets the same
 * permission and price history as any product.
 */
@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @RequirePermissions('product.read')
  @Get()
  list() {
    return this.services.list();
  }

  @RequirePermissions('product.create')
  @Audit('service.create', { entity: 'Service' })
  @Post()
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthUser) {
    return this.services.create(dto, user);
  }

  /** Renames a package, film or car model column. */
  @RequirePermissions('product.update.details')
  @Audit('service.tier.update', { entity: 'ServiceTier', idParam: 'id' })
  @Patch('tiers/:id')
  updateTier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTierDto) {
    return this.services.updateTier(id, dto);
  }

  /** Names, note, and whether customers see it. */
  @RequirePermissions('product.update.details')
  @Audit('service.update', { entity: 'Service', idParam: 'id' })
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, dto);
  }
}

@ApiTags('public')
@Controller('public')
export class PublicServicesController {
  constructor(private readonly services: ServicesService) {}

  /** What the website's packages page and the showroom offer: active services with their set prices. */
  @Public()
  @Header('Cache-Control', 'public, max-age=60')
  @Get('services')
  list() {
    return this.services.publicList();
  }
}
