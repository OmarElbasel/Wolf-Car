import { Body, Controller, Get, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { setSlotsCookie } from '../auth/cookies';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthThrottle } from '../common/decorators/auth-throttle.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { Env } from '../config/env';
import { CalendarQueryDto, CreateLightJobRequestDto } from '../ppf/dto/ppf.dto';
import { PpfService } from '../ppf/ppf.service';
import { PinDto } from './dto/sales-access.dto';
import { SalesAccessGuard } from './sales-access.guard';
import { SalesAccessService } from './sales-access.service';

/**
 * The sales slots page. There is no user here: the routes are public to the
 * global JWT guard and protected by the PIN cookie instead (SalesAccessGuard).
 */
@ApiTags('slots')
@Public()
@Controller('slots')
export class SlotsController {
  constructor(
    private readonly access: SalesAccessService,
    private readonly ppf: PpfService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @AuthThrottle()
  @Audit('sales_access.unlock', { entity: 'SalesAccess' })
  @Post('unlock')
  @HttpCode(200)
  async unlock(@Body() dto: PinDto, @Res({ passthrough: true }) res: Response): Promise<{ expiresAt: Date }> {
    const { token, expiresAt } = await this.access.unlock(dto.pin);
    setSlotsCookie(res, token, expiresAt, this.config.get('COOKIE_SECURE', { infer: true }));
    return { expiresAt };
  }

  @ApiCookieAuth('wc_slt')
  @UseGuards(SalesAccessGuard)
  @Get()
  view(@Query() query: CalendarQueryDto) {
    return this.ppf.salesView(query);
  }

  /** Cookie-authenticated and state-changing: the guard also requires the CSRF header. */
  @ApiCookieAuth('wc_slt')
  @UseGuards(SalesAccessGuard)
  @Audit('ppf_request.create', { entity: 'LightJobRequest' })
  @Post('requests')
  createRequest(@Body() dto: CreateLightJobRequestDto) {
    return this.ppf.createRequest(dto);
  }
}
