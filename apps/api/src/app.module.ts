import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './health.controller';
import { OrganizationsModule } from './modules/organizations/organizations.module';

@Module({ imports: [AuthModule, OrganizationsModule], controllers: [HealthController] })
export class AppModule {}
