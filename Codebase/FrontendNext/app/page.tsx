// Home surface (`/`). Renders the marketing shell at the 'hero' surface (nav + hero +
// footer), matching the Vite App.tsx dispatch. Server-rendered first paint, then hydrates.
import MarketingSurface from '@/components/MarketingSurface';

export default function HomePage() {
  return <MarketingSurface surface="hero" />;
}
