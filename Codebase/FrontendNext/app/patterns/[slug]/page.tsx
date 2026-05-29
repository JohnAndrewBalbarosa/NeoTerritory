// /patterns/<slug> → 'patternDetail'. Static segments (gof, learn) take precedence over
// this dynamic segment. The detail component reads the slug client-side (window-guarded);
// passing the slug as a prop for true SSR is deferred to B2.2.
import MarketingSurface from '@/components/MarketingSurface';

export default function PatternDetailPage() {
  return <MarketingSurface surface="patternDetail" />;
}
