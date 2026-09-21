import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ActivityQueryService } from './activity-query.service';
import { ListActivityQueryDto } from './dto/activity.dto';

@ApiTags('activity')
@ApiBearerAuth()
@RequirePermissions('activity.read')
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityQueryService) {}

  /** Filterable, paginated audit trail (newest first). */
  @Get()
  list(@Query() query: ListActivityQueryDto) {
    return this.activity.list(query);
  }

  @Get('actions')
  actions() {
    return this.activity.knownActions();
  }
}
