import { getRequestConfig } from 'next-intl/server';

const locales = new Set(['fr', 'en']);

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && locales.has(requested) ? requested : 'fr';
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
