import { useSurface } from './logic/router';
import MarketingShell from './components/marketing/MarketingShell';
import StudioApp from './components/studio/StudioApp';
import GoogleCallback from './components/auth/GoogleCallback';
import GoogleSignInPage from './components/auth/GoogleSignInPage';

export default function App() {
  const surface = useSurface();

  if (surface === 'googleCallback') return <GoogleCallback />;
  if (surface === 'googleSignIn')   return <GoogleSignInPage />;
  if (surface === 'studio')          return <StudioApp />;

  return <MarketingShell surface={surface} />;
}
