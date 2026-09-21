import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, ValidateNested } from 'class-validator';
import { PERMISSION_KEYS, type PermissionKey } from '../../../../shared/permissions';

export class SetRolePermissionsDto {
  /** The complete list of permissions the role should have (replaces the current set). */
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(PERMISSION_KEYS.length)
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions: PermissionKey[];
}

export class PermissionOverrideDto {
  @IsIn(PERMISSION_KEYS)
  permission: PermissionKey;

  @IsIn(['GRANT', 'REVOKE'])
  effect: 'GRANT' | 'REVOKE';
}

export class SetUserOverridesDto {
  /** The complete list of per-user overrides (replaces the current ones). Omitted permissions inherit from the role. */
  @IsArray()
  @ArrayMaxSize(PERMISSION_KEYS.length)
  @ArrayUnique((o: PermissionOverrideDto) => o.permission)
  @ValidateNested({ each: true })
  @Type(() => PermissionOverrideDto)
  overrides: PermissionOverrideDto[];
}
