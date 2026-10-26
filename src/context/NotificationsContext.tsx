import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type { NotificationFeed } from '../types';

const emptyFeed: NotificationFeed = { notifications: [], unreadCount: 0, total: 0, orders: [] };
interface NotificationsValue {
  feed: NotificationFeed;
  isOpen: boolean;
  loading: boolean;
  error: string;
  marking: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  refresh: () => Promise<void>;
  markRead: (ids: string[] | 'all') => Promise<void>;
}
const NotificationsContext = createContext<NotificationsValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, openAuthModal } = useAuth();
  const uid = currentUser?.uid;
  const activeUid = useRef(uid);
  activeUid.current = uid;
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const reading = useRef(false);
  const [state, setState] = useState<{ uid?: string; feed: NotificationFeed }>({ feed: emptyFeed });
  const [openOwner, setOpenOwner] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);

  const refresh = useCallback(async () => {
    if (!uid || reading.current) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store', signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'دریافت اعلان‌ها انجام نشد. دوباره تلاش کنید.');
      if (activeUid.current === uid && id === requestId.current) {
        setState({ uid, feed: data }); setError('');
      }
    } catch (e) {
      if (!abort.signal.aborted && activeUid.current === uid && id === requestId.current) {
        setError(e instanceof Error ? e.message : 'دریافت اعلان‌ها انجام نشد.');
      }
    } finally {
      if (activeUid.current === uid && id === requestId.current) setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    ++requestId.current;
    controller.current?.abort();
    reading.current = false;
    setOpenOwner(undefined);
    setState({ uid, feed: emptyFeed }); setError(''); setMarking(false); setLoading(false);
    if (!uid) return;
    void refresh();
    const update = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    window.addEventListener('inana:notifications-refresh', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer); controller.current?.abort(); ++requestId.current;
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
      window.removeEventListener('inana:notifications-refresh', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [uid, refresh]);

  const markRead = useCallback(async (ids: string[] | 'all') => {
    if (!uid || reading.current) return;
    reading.current = true; setMarking(true);
    controller.current?.abort(); ++requestId.current;
    setLoading(false);
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids === 'all' ? { all: true } : { ids }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ثبت خواندن اعلان انجام نشد.');
      if (activeUid.current === uid) { setState({ uid, feed: data }); setError(''); }
    } catch (e) {
      if (activeUid.current === uid) setError(e instanceof Error ? e.message : 'ثبت خواندن اعلان انجام نشد.');
    } finally {
      if (activeUid.current === uid) { reading.current = false; setMarking(false); }
    }
  }, [uid]);

  const openNotifications = () => {
    if (!uid) { openAuthModal('login'); return; }
    setOpenOwner(uid); void refresh();
  };
  return <NotificationsContext.Provider value={{
    feed: state.uid === uid ? state.feed : emptyFeed, isOpen: !!uid && openOwner === uid,
    loading, error, marking, openNotifications, closeNotifications: () => setOpenOwner(undefined), refresh, markRead,
  }}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('NotificationsProvider is required');
  return context;
}
