import { describe, expect, it } from 'vitest';
import { generateProjectSlug } from '../src/modules/projects/projects.service.js';

describe('project identifier generation', () => {
  it('creates a readable identifier without accents', () => {
    expect(generateProjectSlug('Sécurité Portail Client', 'a1b2c3')).toBe(
      'securite-portail-client-a1b2c3',
    );
  });

  it('uses a safe fallback for names without latin characters', () => {
    expect(generateProjectSlug('安全', 'a1b2c3')).toBe('project-a1b2c3');
  });
});
