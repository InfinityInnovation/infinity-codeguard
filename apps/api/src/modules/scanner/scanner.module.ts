import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [ScannerController],
  providers: [ScannerService],
})
export class ScannerModule {}
