import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from '../../common/session.guard';
import { AuthRateLimitGuard } from '../../common/auth-rate-limit.guard';
import { RedisModule } from '../../infrastructure/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, AuthRateLimitGuard],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
