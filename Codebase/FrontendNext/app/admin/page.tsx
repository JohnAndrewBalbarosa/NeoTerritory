// /admin → Admin dashboard (was admin.html). Tabs are React state, so this single route
// covers the dashboard; /admin/login is the separate sign-in route.
import AdminSurface from '@/components/AdminSurface';

export default function AdminPage() {
  return <AdminSurface />;
}
