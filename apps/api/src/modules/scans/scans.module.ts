import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [ScansController],
  providers: [ScansService],
})
export class ScansModule {}
