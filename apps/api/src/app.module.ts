import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './health.controller';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { CsrfGuard } from './common/csrf.guard';
import { ProjectsModule } from './modules/projects/projects.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { ScansModule } from './modules/scans/scans.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ScannerModule } from './modules/scanner/scanner.module';

@Module({
  imports: [AuthModule, OrganizationsModule, ProjectsModule, RepositoriesModule, ScansModule, IntegrationsModule, ScannerModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
})
export class AppModule {}
