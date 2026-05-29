import type { Metadata } from 'next';
import type { ReactNode } from 'react';
// Shared design system (~188KB) from the existing Vite app — single source (D89).
import '@frontend/styles/marketing.css';

export const metadata: Metadata = {
  title: 'CodiNeo',
  description:
    'CodiNeo Studio — C++ design pattern analysis and AI documentation pipeline.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Montserrat:wght@700;800;900&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
