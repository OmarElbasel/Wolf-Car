import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

/**
 * Account administration. There is no public registration: every account is
 * created here (or with its branch). Generated passwords are returned once.
 */
@ApiTags('users')
@ApiBearerAuth()
@RequirePermissions('user.manage')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  /** Creates a Super Admin or Finance account with an auto-generated username and password. */
  @Audit('user.create', { entity: 'User' })
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor);
  }

  @Audit('user.update', { entity: 'User', idParam: 'id' })
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.update(id, dto, actor);
  }

  @Audit('user.delete', { entity: 'User', idParam: 'id' })
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.users.remove(id, actor);
  }

  @Audit('user.password.reset', { entity: 'User', idParam: 'id' })
  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.resetPassword(id);
  }

  @Audit('user.showroom_password.reset', { entity: 'User', idParam: 'id' })
  @Post(':id/reset-showroom-password')
  @HttpCode(200)
  resetShowroomPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.resetShowroomPassword(id);
  }

  @Audit('user.2fa.reset', { entity: 'User', idParam: 'id' })
  @Post(':id/reset-2fa')
  @HttpCode(200)
  resetTwoFactor(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.resetTwoFactor(id);
  }

  @Audit('user.unlock', { entity: 'User', idParam: 'id' })
  @Post(':id/unlock')
  @HttpCode(200)
  unlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.unlock(id);
  }
}
