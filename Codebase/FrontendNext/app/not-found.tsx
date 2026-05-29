// Catch-all 404 → marketing 'notFound' surface. Covers unknown paths and the retired
// auth paths (/choose, /login, /seat-selection, /consent) which the Vite router also
// sends to the 404 page rather than the homepage, so old bookmarks land somewhere honest.
import MarketingSurface from '@/components/MarketingSurface';

export default function NotFound() {
  return <MarketingSurface surface="notFound" />;
}
