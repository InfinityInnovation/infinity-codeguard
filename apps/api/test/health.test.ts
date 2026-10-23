import { describe, expect, it } from 'vitest';
import { HealthController } from '../src/health.controller';

describe('HealthController', () => {
  it('reports the API as healthy', () => {
    expect(new HealthController().health()).toMatchObject({ status: 'ok', service: 'api' });
  });
});
