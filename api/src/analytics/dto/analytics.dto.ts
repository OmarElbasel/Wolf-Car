import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SITE_EVENT_TYPES, type SiteEventType } from '../../../../shared/analytics';
import { IsDay } from '../../common/day';
import { Trim } from '../../common/validators';

export class SiteEventDto {
  @IsIn(SITE_EVENT_TYPES)
  type: SiteEventType;

  /** the page's path with its language prefix, e.g. "/ar/products" */
  @IsString()
  @Matches(/^\/[^\s]*$/)
  @MaxLength(300)
  path: string;

  /** true for the first page of a visit */
  @IsOptional()
  @IsBoolean()
  entry?: boolean;

  /** document.referrer, sent with the first page of a visit */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;

  /** utm_source of the link that brought the visitor */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  campaign?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,64}$/)
  targetId?: string;
}

export class AnalyticsRangeDto {
  /** Qatar days, both included */
  @IsDay()
  from: string;

  @IsDay()
  to: string;
}
