import { useSurface } from './logic/router';
import MarketingShell from './components/marketing/MarketingShell';
import StudioApp from './components/studio/StudioApp';
import GoogleCallback from './components/auth/GoogleCallback';
import GoogleSignInPage from './components/auth/GoogleSignInPage';
import OnboardingFlow from './components/auth/OnboardingFlow';
import StudentLearningShell from './components/learn/StudentLearningShell';
import InternDashboard from './components/learn/InternDashboard';
import { useHeartbeat } from './hooks/useHeartbeat';

export default function App() {
  const surface = useSurface();
  useHeartbeat();

  if (surface === 'googleCallback') return <GoogleCallback />;
  if (surface === 'googleSignIn')   return <GoogleSignInPage />;
  if (surface === 'onboarding')     return <OnboardingFlow />;
  if (surface === 'studio')          return <StudioApp />;
  if (surface === 'internDashboard') return <InternDashboard />;
  if (surface === 'patternsLearn' || surface === 'patternsLearnModule') {
    return <StudentLearningShell />;
  }

  return <MarketingShell surface={surface} />;
}
