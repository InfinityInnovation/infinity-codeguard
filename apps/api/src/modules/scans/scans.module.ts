import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

@Module({ imports: [OrganizationsModule], controllers: [ScansController], providers: [ScansService] })
export class ScansModule {}
