import { Global, Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { AuditTrail } from './audit-trail.service';

@Global()
@Module({
  providers: [ActivityService, AuditTrail],
  exports: [ActivityService, AuditTrail],
})
export class ActivityModule {}
