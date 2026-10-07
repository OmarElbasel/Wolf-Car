import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import { OdooSyncService } from './odoo-sync.service';

@ApiTags('odoo')
@ApiBearerAuth()
@Controller('odoo')
export class OdooController {
  constructor(private readonly sync: OdooSyncService) {}

  /** Whether Odoo is connected, and when the catalogue was last brought up to date. */
  @RequirePermissions('product.read')
  @Get('sync')
  status() {
    return this.sync.status();
  }

  /** "Sync now": brings the catalogue up to date without waiting for the timer. */
  @RequirePermissions('product.update.price')
  @Audit('product.odoo_sync')
  @Post('sync')
  @HttpCode(200)
  run(@CurrentUser() user: AuthUser) {
    return this.sync.run(user.id);
  }
}
