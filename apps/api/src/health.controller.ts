import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@codeguard/contracts';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Get()
  health(): HealthStatus {
    return { status: 'ok', service: 'api', timestamp: new Date().toISOString() };
  }
}
