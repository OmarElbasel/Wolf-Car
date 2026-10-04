import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ParseDayPipe } from '../common/day';
import type { AuthUser } from '../common/types';
import {
  CalendarQueryDto,
  CloseDayDto,
  CreatePpfBookingDto,
  DecideRequestDto,
  ListPpfBookingsQueryDto,
  ListRequestsQueryDto,
  UpdatePpfBookingDto,
} from './dto/ppf.dto';
import { PpfService } from './ppf.service';

/** The call center's PPF calendar (Bin Omran). Reading and managing are separate permissions. */
@ApiTags('ppf')
@ApiBearerAuth()
@Controller('ppf')
export class PpfController {
  constructor(private readonly ppf: PpfService) {}

  @RequirePermissions('booking.ppf.read')
  @Get('calendar')
  calendar(@Query() query: CalendarQueryDto) {
    return this.ppf.calendar(query);
  }

  @RequirePermissions('booking.ppf.read')
  @Get('bookings')
  list(@Query() query: ListPpfBookingsQueryDto) {
    return this.ppf.list(query);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_booking.create', { entity: 'PpfBooking' })
  @Post('bookings')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePpfBookingDto) {
    return this.ppf.create(user, dto);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_booking.update', { entity: 'PpfBooking', idParam: 'id' })
  @Patch('bookings/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePpfBookingDto) {
    return this.ppf.update(user, id, dto);
  }

  /** Keeps the booking, marked cancelled, and frees its day. */
  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_booking.cancel', { entity: 'PpfBooking', idParam: 'id' })
  @Post('bookings/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.ppf.cancel(user, id);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_day.close', { entity: 'PpfClosedDay', idParam: 'date' })
  @Put('closed-days/:date')
  closeDay(@CurrentUser() user: AuthUser, @Param('date', ParseDayPipe) date: string, @Body() dto: CloseDayDto) {
    return this.ppf.closeDay(user, date, dto);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_day.reopen', { entity: 'PpfClosedDay', idParam: 'date' })
  @Delete('closed-days/:date')
  @HttpCode(204)
  reopenDay(@Param('date', ParseDayPipe) date: string) {
    return this.ppf.reopenDay(date);
  }

  @RequirePermissions('booking.ppf.read')
  @Get('requests')
  requests(@Query() query: ListRequestsQueryDto) {
    return this.ppf.listRequests(query);
  }

  /** Adds the light job to the requested day. */
  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_request.approve', { entity: 'LightJobRequest', idParam: 'id' })
  @Post('requests/:id/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideRequestDto) {
    return this.ppf.approveRequest(user, id, dto);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_request.reject', { entity: 'LightJobRequest', idParam: 'id' })
  @Post('requests/:id/reject')
  @HttpCode(200)
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideRequestDto) {
    return this.ppf.rejectRequest(user, id, dto);
  }
}
