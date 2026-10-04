import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import { CreateReservationDto, ListReservationsQueryDto, UpdateReservationDto } from './dto/reservations.dto';
import { ReservationsService } from './reservations.service';

/** General reservations: internal to the call center, never shown to sales. */
@ApiTags('reservations')
@ApiBearerAuth()
@RequirePermissions('booking.general.manage')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  list(@Query() query: ListReservationsQueryDto) {
    return this.reservations.list(query);
  }

  @Audit('reservation.create', { entity: 'GeneralReservation' })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReservationDto) {
    return this.reservations.create(user, dto);
  }

  @Audit('reservation.update', { entity: 'GeneralReservation', idParam: 'id' })
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReservationDto) {
    return this.reservations.update(user, id, dto);
  }

  @Audit('reservation.cancel', { entity: 'GeneralReservation', idParam: 'id' })
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.cancel(user, id);
  }
}
