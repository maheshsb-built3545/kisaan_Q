import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, MessageSquare, Radio, ExternalLink, ShieldAlert, Sparkles, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationsApi } from '../../api/notifications.api';
import { joinUserRoom, joinStaffRole, onNotificationNew } from '../../services/socketService';

export default function NotificationBell({ className = '' }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [recentToast, setRecentToast] = useState(null);
  const dropdownRef = useRef(null);

  const userId = user?.id || user?._id || user?.phone || 'anonymous';
  const userRole = user?.role;
  const userCentreId = user?.centreId || user?.assignedMandi;

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const [listRes, countRes] = await Promise.allSettled([
        notificationsApi.getMyNotifications({ limit: 20 }),
        notificationsApi.getUnreadCount()
      ]);

      if (listRes.status === 'fulfilled' && listRes.value?.success) {
        setNotifications(listRes.value.data || []);
      }
      if (countRes.status === 'fulfilled' && countRes.value?.success) {
        setUnreadCount(countRes.value.data?.unreadCount || 0);
      }
    } catch (err) {
      console.debug('[NotificationBell] Fetch notice:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch and Socket.IO listeners
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // Join personal room
    joinUserRoom(userId);

    // If staff, join role & centre rooms
    if (userRole) {
      joinStaffRole(userRole, userCentreId);
    }

    // Subscribe to live notification:new
    const unsub = onNotificationNew((data) => {
      const incoming = data.notification || data;
      setNotifications((prev) => [incoming, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Trigger temporary toast
      setRecentToast({
        title: incoming.title || 'New Notification',
        body: incoming.body || 'You received a new update.',
        event: incoming.event
      });
      setTimeout(() => setRecentToast(null), 5000);
    });

    // Close on outside click
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsub();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user, userId, userRole, userCentreId, fetchNotifications]);

  // Mark single as read
  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true, channels: { ...n.channels, inApp: { status: 'read' } } } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, channels: { ...n.channels, inApp: { status: 'read' } } }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  if (!user) return null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-slate-950 shadow-xs shadow-emerald-950 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Live Toast Alert for incoming notifications */}
      {recentToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white tracking-wide truncate">{recentToast.title}</h4>
              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">{recentToast.body}</p>
            </div>
            <button onClick={() => setRecentToast(null)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/60 p-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                activeTab === 'unread'
                  ? 'bg-slate-800 text-emerald-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List Area */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {isLoading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-xs font-semibold text-slate-400">No notifications yet</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Live queue and checkpoint alerts will appear here.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isUnread = !notif.read;
                const smsStatus = notif.channels?.sms?.status;
                const createdAtStr = notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                return (
                  <div
                    key={notif._id || notif.id || notif.dedupeKey}
                    onClick={(e) => isUnread && handleMarkAsRead(notif._id, e)}
                    className={`p-3 transition-colors cursor-pointer relative flex items-start gap-3 ${
                      isUnread
                        ? 'bg-slate-800/50 hover:bg-slate-800/80'
                        : 'hover:bg-slate-800/30 opacity-80'
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0 animate-pulse" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`text-xs font-bold truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                          {notif.title}
                        </h4>
                        <span className="text-[9px] font-mono text-slate-500 shrink-0">{createdAtStr}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed break-words">{notif.body}</p>

                      {/* Channel chips */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                          in-app: {notif.channels?.inApp?.status || (notif.read ? 'read' : 'delivered')}
                        </span>
                        {smsStatus && smsStatus !== 'none' && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                              smsStatus === 'sent'
                                ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                                : smsStatus === 'mock'
                                ? 'bg-cyan-950 border-cyan-600 text-cyan-300'
                                : 'bg-rose-950 border-rose-600 text-rose-300'
                            }`}
                          >
                            SMS: {smsStatus.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer link to full notification centre */}
          <div className="p-2.5 bg-slate-800/90 border-t border-slate-700/60 text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
            >
              <span>Open Notification Centre</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
