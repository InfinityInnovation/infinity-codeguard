import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { QueryProvider } from '../providers/query-provider';

export const metadata: Metadata = {
  title: { default: 'Infinity CodeGuard', template: '%s · Infinity CodeGuard' },
  description: 'Open-source code quality and application security governance.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html lang="fr">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
