// /auth/callback → Google OAuth token exchange, then client-side redirect. Browser-only.
import AuthCallbackSurface from '@/components/AuthCallbackSurface';

export default function AuthCallbackPage() {
  return <AuthCallbackSurface />;
}
