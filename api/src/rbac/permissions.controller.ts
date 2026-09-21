import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import { Role } from '../generated/prisma/enums';
import { SetRolePermissionsDto, SetUserOverridesDto } from './dto/permissions.dto';
import { PermissionsService } from './permissions.service';

/** Granular RBAC administration: role defaults and per-user overrides. */
@ApiTags('permissions')
@ApiBearerAuth()
@RequirePermissions('permission.manage')
@Controller()
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('permissions')
  catalog() {
    return this.permissions.catalog();
  }

  @Get('roles/permissions')
  roleMatrix() {
    return this.permissions.roleMatrix();
  }

  @Audit('permission.role.update', { entity: 'Role', idParam: 'role' })
  @Put('roles/:role/permissions')
  async setRole(@Param('role', new ParseEnumPipe(Role)) role: Role, @Body() dto: SetRolePermissionsDto) {
    return { role, permissions: await this.permissions.setRolePermissions(role, dto.permissions) };
  }

  @Get('users/:id/permissions')
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissions.userPermissions(id);
  }

  @Audit('permission.user.update', { entity: 'User', idParam: 'id' })
  @Put('users/:id/permissions')
  setUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetUserOverridesDto, @CurrentUser() actor: AuthUser) {
    return this.permissions.setUserOverrides(id, dto, actor.id);
  }
}
