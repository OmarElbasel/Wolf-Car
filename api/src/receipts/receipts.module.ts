import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PdfRendererService } from './pdf-renderer.service';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [OrdersModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, PdfRendererService],
})
export class ReceiptsModule {}
