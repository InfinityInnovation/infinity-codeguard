import { getRequestConfig } from 'next-intl/server';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

const locales = new Set(['fr', 'en']);
const messages = { en, fr } as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && locales.has(requested) ? requested : 'fr';
  return { locale, messages: messages[locale as keyof typeof messages] };
});
