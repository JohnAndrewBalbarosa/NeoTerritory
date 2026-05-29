// /patterns/learn/<moduleId> → one isolated learning module. Auth-gated. The shell reads
// the module id client-side (window-guarded); passing it as a prop is a B2.2 item.
import LearnHubSurface from '@/components/LearnHubSurface';

export default function PatternsLearnModulePage() {
  return <LearnHubSurface />;
}
