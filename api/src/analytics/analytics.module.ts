import { Module } from '@nestjs/common';
import { AnalyticsController, SiteEventsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [SiteEventsController, AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
