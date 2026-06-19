// Legacy alias retained for old bookmarks.
import { redirect } from 'next/navigation';

export default function LegacyDashboardRedirectPage() {
  redirect('/intern-dashboard');
}
