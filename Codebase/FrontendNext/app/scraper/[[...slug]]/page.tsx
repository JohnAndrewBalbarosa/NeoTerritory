// /scraper and /scraper/* → Scraper control panel (was scraper.html). Imports the
// scraper-specific stylesheet (in addition to the global marketing.css from the layout);
// the panel itself renders client-only.
import '@frontend/styles/scraper.css';
import ScraperSurface from '@/components/ScraperSurface';

export default function ScraperPage() {
  return <ScraperSurface />;
}
