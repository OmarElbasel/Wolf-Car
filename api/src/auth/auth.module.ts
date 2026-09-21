import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LockoutService } from './lockout.service';
import { PasswordService } from './password.service';
import { SessionUserService } from './session-user.service';
import { JWT_ISSUER, TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { issuer: JWT_ISSUER, algorithm: 'HS256' },
        verifyOptions: { issuer: JWT_ISSUER, algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, PasswordService, LockoutService, TwoFactorService, SessionUserService, JwtAuthGuard],
  exports: [TokenService, PasswordService, TwoFactorService, SessionUserService, AuthService, JwtAuthGuard],
})
export class AuthModule {}
