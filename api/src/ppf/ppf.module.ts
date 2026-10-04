import { Module } from '@nestjs/common';
import { PpfController } from './ppf.controller';
import { PpfService } from './ppf.service';

@Module({
  controllers: [PpfController],
  providers: [PpfService],
  exports: [PpfService],
})
export class PpfModule {}
