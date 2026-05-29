'use client';
// Client wrapper for the unified Google sign-in page. Used by the */login routes
// (/developer/login, /student-learning/login, /admin/login, /pm/login, /new-user/login).
//
// ssr:false — GoogleSignInPage reads window/location during render (role-from-path,
// OAuth redirect). Auth pages have no SSR value (they require the browser), so render
// client-only; this avoids "window is not defined" during prerender. Per D89, auth-gated
// surfaces are browser-only islands.
import dynamic from 'next/dynamic';

const GoogleSignInPage = dynamic(
  () => import('@frontend/components/auth/GoogleSignInPage'),
  { ssr: false },
);

export default function SignInSurface() {
  return <GoogleSignInPage />;
}
