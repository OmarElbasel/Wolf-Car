import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';
import { Trim } from '../../common/validators';

export class ListActivityQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  /** part of the actor's username */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  actor?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** exact action ("order.confirm") or a prefix ending in "." ("order.") */
  @IsOptional()
  @Matches(/^[a-z0-9_.]{2,64}$/)
  action?: string;

  @IsOptional()
  @Matches(/^[A-Za-z]{2,32}$/)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @IsOptional()
  @IsIn(['SUCCESS', 'FAILURE'])
  outcome?: 'SUCCESS' | 'FAILURE';

  /** YYYY-MM-DD (Qatar day) or ISO timestamp, inclusive */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
