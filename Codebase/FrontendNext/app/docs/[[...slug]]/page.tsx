// /docs and /docs/* → marketing 'docs' surface (popup-style overview).
// More specific /docs/full/* is handled by app/docs/full/[[...slug]] (docsFull).
import MarketingSurface from '@/components/MarketingSurface';

export default function DocsPage() {
  return <MarketingSurface surface="docs" />;
}
