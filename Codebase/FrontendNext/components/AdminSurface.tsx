'use client';
// Client wrapper for the Admin dashboard (was the separate admin.html Vite entry).
// ssr:false — AdminApp is a browser-only authenticated dashboard (localStorage JWT, live
// health polling, tab state); no SSR value. Tabs are React state, not path segments, so
// /admin alone mounts it (/admin/login is the separate sign-in route). Per D89.
import dynamic from 'next/dynamic';
import '@frontend/../admin.css';

const AdminApp = dynamic(() => import('@frontend/admin/AdminApp'), { ssr: false });

export default function AdminSurface() {
  return <AdminApp />;
}
