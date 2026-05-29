import type { Metadata } from 'next';
import type { ReactNode } from 'react';
// Shared design system (~188KB) from the existing Vite app — single source (D89).
import '@frontend/styles/marketing.css';
import RouterBridge from '@/components/RouterBridge';

export const metadata: Metadata = {
  title: 'CodiNeo',
  description:
    'CodiNeo Studio — C++ design pattern analysis and AI documentation pipeline.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Second global stylesheet (the --devcon-* theme tokens + shared classes). The
            Vite index.html linked this as /styles.css alongside marketing.css; it is served
            from FrontendNext/public/styles.css. Without it the theme variables are undefined
            and the UI/animations break. */}
        <link rel="stylesheet" href="/styles.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Montserrat:wght@700;800;900&display=swap"
        />
      </head>
      <body>
        <RouterBridge />
        {children}
      </body>
    </html>
  );
}
