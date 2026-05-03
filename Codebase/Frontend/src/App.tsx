import { useSurface } from './lib/router';
import MarketingShell from './components/marketing/MarketingShell';
import StudioApp from './components/studio/StudioApp';

export default function App() {
  const surface = useSurface();

  if (surface === 'studio') {
    return <StudioApp />;
  }

  return <MarketingShell surface={surface} />;
}
