import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BOOKING_NOTE_MAX, BOOKING_SERVICE_MAX, TIME_PATTERN } from '../../../../shared/validation';
import { NameField, PhoneField, TextField } from '../../common/booking-fields';
import { IsDay } from '../../common/day';
import { PageQueryDto } from '../../common/pagination';
import { EmptyToNull, EmptyToUndefined, Trim } from '../../common/validators';
import { BOOKING_STATUSES } from '../../ppf/dto/ppf.dto';

const TIME_MESSAGE = { message: 'time must be HH:mm (24-hour)' };

export class CreateReservationDto {
  @IsDay()
  date: string;

  /** "HH:mm" in Qatar time, when an hour was agreed. */
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Matches(TIME_PATTERN, TIME_MESSAGE)
  time?: string | null;

  @TextField(BOOKING_SERVICE_MAX)
  service: string;

  @IsOptional()
  @EmptyToUndefined()
  @NameField()
  ownerName?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @NameField()
  car?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @TextField(BOOKING_NOTE_MAX)
  note?: string | null;
}

/** Every field is optional; send "" or null to clear anything but the day and the service. */
export class UpdateReservationDto {
  @IsOptional()
  @IsDay()
  date?: string;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @Matches(TIME_PATTERN, TIME_MESSAGE)
  time?: string | null;

  @IsOptional()
  @TextField(BOOKING_SERVICE_MAX)
  service?: string;

  @IsOptional()
  @EmptyToNull()
  @NameField()
  ownerName?: string | null;

  @IsOptional()
  @EmptyToNull()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToNull()
  @NameField()
  car?: string | null;

  @IsOptional()
  @EmptyToNull()
  @TextField(BOOKING_NOTE_MAX)
  note?: string | null;
}

export class ListReservationsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsDay()
  from?: string;

  @IsOptional()
  @IsDay()
  to?: string;

  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: (typeof BOOKING_STATUSES)[number];

  /** matches owner name, phone, car or service */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  q?: string;
}
