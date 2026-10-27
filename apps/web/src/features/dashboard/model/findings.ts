import type { FindingSummary } from '@codeguard/contracts';
import type { useTranslations } from 'next-intl';

export function localizeFinding(
  finding: FindingSummary,
  t: ReturnType<typeof useTranslations>,
): { title: string; description: string; category: string } {
  if (finding.ruleId.includes('github-actions-mutable-action-tag'))
    return {
      title: t('finding.mutableAction.title'),
      description: t('finding.mutableAction.description'),
      category: t('finding.supplyChain'),
    };
  if (finding.ruleId.includes('pnpm-block-exotic'))
    return {
      title: t('finding.exoticDependencies.title'),
      description: t('finding.exoticDependencies.description'),
      category: t('finding.dependencies'),
    };
  if (finding.ruleId.includes('minimum-release-age'))
    return {
      title: t('finding.releaseAge.title'),
      description: t('finding.releaseAge.description'),
      category: t('finding.dependencies'),
    };
  if (finding.ruleId.includes('pnpm-trust-policy'))
    return {
      title: t('finding.trustPolicy.title'),
      description: t('finding.trustPolicy.description'),
      category: t('finding.dependencies'),
    };
  return {
    title: t('finding.generic.title'),
    description: t('finding.generic.description'),
    category: t('finding.codeSecurity'),
  };
}
