import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import { PinDto } from './dto/sales-access.dto';
import { SalesAccessService } from './sales-access.service';

/** The call center's side of the sales page: is a PIN set, and setting it. */
@ApiTags('ppf')
@ApiBearerAuth()
@Controller('ppf/sales-access')
export class SalesAccessController {
  constructor(private readonly access: SalesAccessService) {}

  @RequirePermissions('booking.ppf.read')
  @Get()
  status() {
    return this.access.status();
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('sales_access.pin_change', { entity: 'SalesAccess' })
  @Put('pin')
  setPin(@CurrentUser() user: AuthUser, @Body() dto: PinDto) {
    return this.access.setPin(user, dto.pin);
  }
}
