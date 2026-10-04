import { Module } from '@nestjs/common';
import { PpfModule } from '../ppf/ppf.module';
import { SalesAccessController } from './sales-access.controller';
import { SalesAccessGuard } from './sales-access.guard';
import { SalesAccessService } from './sales-access.service';
import { SlotsController } from './slots.controller';

@Module({
  imports: [PpfModule],
  controllers: [SalesAccessController, SlotsController],
  providers: [SalesAccessService, SalesAccessGuard],
})
export class SalesAccessModule {}
