import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SkipAudit } from '../common/decorators/audit.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { requestMeta } from '../common/types';
import { AnalyticsService, type AnalyticsSummary } from './analytics.service';
import { AnalyticsRangeDto, SiteEventDto } from './dto/analytics.dto';

@ApiTags('public')
@Controller('public')
export class SiteEventsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** A page view or a contact-button press from the public website. Anonymous; always answers 204. */
  @Public()
  @SkipAudit('anonymous visitor statistics from the public website; high volume and no actor')
  @ApiNoContentResponse()
  @HttpCode(204)
  @Post('events')
  async record(@Body() dto: SiteEventDto, @Req() req: Request): Promise<void> {
    const origin = req.headers.origin;
    let ownHost: string | undefined;
    try {
      ownHost = typeof origin === 'string' ? new URL(origin).hostname : undefined;
    } catch {
      /* a malformed Origin header: every referrer then counts as another site */
    }
    await this.analytics.record(dto, requestMeta(req), ownHost);
  }
}

@ApiTags('analytics')
@ApiBearerAuth()
@RequirePermissions('analytics.read')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Visitors, page views, sources and contact-button presses between two Qatar days. */
  @Get('summary')
  summary(@Query() query: AnalyticsRangeDto): Promise<AnalyticsSummary> {
    return this.analytics.summary(query.from, query.to);
  }
}
