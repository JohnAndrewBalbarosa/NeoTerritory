import { useSurface } from './logic/router';
import MarketingShell from './components/marketing/MarketingShell';
import StudioApp from './components/studio/StudioApp';
import GoogleCallback from './components/auth/GoogleCallback';
import GoogleSignInPage from './components/auth/GoogleSignInPage';
import AuthChooserPage from './components/auth/AuthChooserPage';
import OnboardingFlow from './components/auth/OnboardingFlow';

export default function App() {
  const surface = useSurface();

  if (surface === 'googleCallback') return <GoogleCallback />;
  if (surface === 'googleSignIn')   return <GoogleSignInPage />;
  if (surface === 'authChoose')     return <AuthChooserPage />;
  if (surface === 'onboarding')     return <OnboardingFlow />;
  if (surface === 'studio')          return <StudioApp />;

  return <MarketingShell surface={surface} />;
}
