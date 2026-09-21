import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ActivityQueryService } from './activity-query.service';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { AuditTrail } from './audit-trail.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [ActivityController],
  providers: [ActivityService, AuditTrail, ActivityQueryService],
  exports: [ActivityService, AuditTrail],
})
export class ActivityModule {}
