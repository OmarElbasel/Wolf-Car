import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ShowroomSession } from '../common/decorators/showroom-session.decorator';
import type { AuthUser } from '../common/types';
import { CreateShowroomOrderDto, IDEMPOTENCY_KEY_PATTERN } from '../orders/dto/orders.dto';
import { ShowroomService } from './showroom.service';

/** Endpoints for the showroom kiosk (showroom sessions only). */
@ApiTags('showroom')
@ApiBearerAuth()
@ShowroomSession()
@RequirePermissions('order.create')
@Controller('showroom')
export class ShowroomController {
  constructor(private readonly showroom: ShowroomService) {}

  @Get('products')
  products(@CurrentUser() user: AuthUser) {
    return this.showroom.products(user);
  }

  /** 201 for a new order; 200 when the Idempotency-Key was already used (the original order is returned). */
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: '8–80 chars [A-Za-z0-9_-]; one per checkout attempt' })
  @Audit('order.create', { entity: 'Order' })
  @Post('orders')
  @HttpCode(201)
  async createOrder(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateShowroomOrderDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (key !== undefined && !IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', code: 'BAD_IDEMPOTENCY_KEY', message: 'Invalid Idempotency-Key header.' });
    }
    const { order, replayed } = await this.showroom.createOrder(user, dto, key);
    if (replayed) res.status(200);
    return order;
  }
}
