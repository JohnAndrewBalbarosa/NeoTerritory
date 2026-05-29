'use client';
// Client wrapper for the Google OAuth callback. ssr:false — GoogleCallback reads the URL
// hash/fragment and redirects in the browser; it has no SSR value. Per D89.
import dynamic from 'next/dynamic';

const GoogleCallback = dynamic(
  () => import('@frontend/components/auth/GoogleCallback'),
  { ssr: false },
);

export default function AuthCallbackSurface() {
  return <GoogleCallback />;
}
