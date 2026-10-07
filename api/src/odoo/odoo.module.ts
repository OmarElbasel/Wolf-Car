import { Module } from '@nestjs/common';
import { OdooController } from './odoo.controller';
import { OdooSyncService } from './odoo-sync.service';

@Module({
  controllers: [OdooController],
  providers: [OdooSyncService],
  exports: [OdooSyncService],
})
export class OdooModule {}
