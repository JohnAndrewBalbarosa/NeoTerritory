'use client';
// Client wrapper for the Scraper control panel (was the separate scraper.html Vite entry).
// ssr:false — browser-only tool panel. The scraper-specific stylesheet is imported by the
// route page (scraper.css is in addition to the global marketing.css). Per D89.
import dynamic from 'next/dynamic';

const ScraperPanel = dynamic(
  () => import('@frontend/components/scraper/ScraperPanel'),
  { ssr: false },
);

export default function ScraperSurface() {
  return <ScraperPanel />;
}
