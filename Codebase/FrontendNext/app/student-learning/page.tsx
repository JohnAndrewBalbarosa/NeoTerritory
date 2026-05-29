// /student-learning (legacy) → marketing 'studentLearning' surface, which the shell
// redirects to /patterns/learn so old bookmarks keep working (D77).
import MarketingSurface from '@/components/MarketingSurface';

export default function StudentLearningLegacyPage() {
  return <MarketingSurface surface="studentLearning" />;
}
