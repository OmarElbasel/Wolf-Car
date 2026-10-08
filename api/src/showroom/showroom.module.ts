import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { ShowroomController } from './showroom.controller';
import { ShowroomService } from './showroom.service';

@Module({
  imports: [ServicesModule],
  controllers: [ShowroomController],
  providers: [ShowroomService],
})
export class ShowroomModule {}
