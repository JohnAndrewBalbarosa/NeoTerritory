import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminUsers } from '../../api/client';
import { AdminUser } from '../../types/api';

const ONLINE_MS = 2 * 60 * 1000;

export function isOnline(lastActive?: string): boolean {
  if (!lastActive) return false;
  const ago = Date.now() - new Date(lastActive + 'Z').getTime();
  return ago >= 0 && ago < ONLINE_MS;
}

export interface AdminUsersState {
  users: AdminUser[];
  loading: boolean;
  onlineCount: number;
  refresh: () => void;
}

// Single source of truth for admin user data. Both the topbar (for the
// online-count pill) and the UserTable (for the row list) read from this.
// Network errors — including the "Missing or invalid token" 401 a freshly
// loaded admin page can hit before its bearer token attaches — are
// swallowed silently: the UI shows "0 users" / "no user online" instead
// of a red error block, since the cause is almost always a transient
// race rather than something the operator can act on.
export function useAdminUsers(intervalMs: number = 60_000): AdminUsersState {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const cancelledRef = useRef(false);

  const refresh = useCallback(() => {
    fetchAdminUsers()
      .then(d => {
        if (cancelledRef.current) return;
        setUsers(d.users ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelledRef.current) return;
        setUsers([]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => { cancelledRef.current = true; clearInterval(timer); };
  }, [refresh, intervalMs]);

  // Admins are excluded from the "online" tally and from the user count
  // shown next to it: the pill is meant to surface tester activity, not the
  // operators looking at the dashboard.
  const testers = users.filter(u => u.role !== 'admin');
  const onlineCount = testers.filter(u => isOnline(u.last_active)).length;
  return { users: testers, loading, onlineCount, refresh };
}
