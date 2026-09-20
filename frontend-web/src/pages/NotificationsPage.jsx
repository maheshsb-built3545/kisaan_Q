import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  Filter,
  CheckCheck,
  ArrowLeft,
  RefreshCw,
  Clock,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileText,
  CreditCard,
  Truck,
  Scale,
  Microscope,
  Calendar,
  X,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../api/notifications.api';
import { joinUserRoom, joinStaffRole, onNotificationNew } from '../services/socketService';
import GovHeader from '../components/common/GovHeader';

const EVENT_CATEGORIES = [
  { id: 'all', label: 'All Events', icon: Bell },
  { id: 'booking', label: 'Bookings & Slots', icon: Calendar, events: ['booking_confirmed', 'booking_cancelled', 'slot_warning', 'slot_released', 'slot_gone', 'waitlist_offer'] },
  { id: 'checkpoints', label: 'Yard Checkpoints', icon: Truck, events: ['gate_checkin', 'turn_near', 'leave_by_alert'] },
  { id: 'quality', label: 'Assaying & Lab', icon: Microscope, events: ['quality_assayed'] },
  { id: 'weighbridge', label: 'Weighbridge', icon: Scale, events: ['weighbridge_done'] },
  { id: 'procurement', label: 'Procurement Deed', icon: FileText, events: ['procurement_recorded'] },
  { id: 'payout', label: 'DBT Payouts', icon: CreditCard, events: ['payout_ready', 'payout_paid', 'payout_settled'] },
  { id: 'exceptions', label: 'Exceptions & Flags', icon: ShieldAlert, events: ['exception_raised', 'complaint_received', 'complaint_resolved'] },
  { id: 'fast_track', label: 'Fast-Track Priority', icon: Sparkles, events: ['fast_track_won', 'fast_track_approved', 'fast_track_declined'] }
];

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lang, setLang] = useState(() => localStorage.getItem('kisanq_lang') || 'en');

  const userId = user?.id || user?._id || user?.phone || 'anonymous';
  const userRole = user?.role;
  const userCentreId = user?.centreId || user?.assignedMandi;

  // Fetch notification list
  const loadNotifications = useCallback(async (quiet = false) => {
    if (!user) return;
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const [listRes, countRes] = await Promise.allSettled([
        notificationsApi.getMyNotifications({ limit: 100 }),
        notificationsApi.getUnreadCount()
      ]);

      if (listRes.status === 'fulfilled' && listRes.value?.success) {
        setNotifications(listRes.value.data || []);
      }
      if (countRes.status === 'fulfilled' && countRes.value?.success) {
        setUnreadCount(countRes.value.data?.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();

    if (userId && userId !== 'anonymous') {
      joinUserRoom(userId);
    }
    if (userRole) {
      joinStaffRole(userRole, userCentreId);
    }

    const unsubscribe = onNotificationNew((data) => {
      const incoming = data.notification || data;
      setNotifications((prev) => [incoming, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => unsubscribe();
  }, [loadNotifications, userId, userRole, userCentreId]);

  // Mark single notification as read
  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true, channels: { ...n.channels, inApp: { status: 'read' } } } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, channels: { ...n.channels, inApp: { status: 'read' } } }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Filter and search computation
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // 1. Tab filter (All vs Unread)
      if (activeTab === 'unread' && notif.read) {
        return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'all') {
        const catObj = EVENT_CATEGORIES.find((c) => c.id === selectedCategory);
        if (catObj?.events && !catObj.events.includes(notif.event)) {
          return false;
        }
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (notif.title || '').toLowerCase().includes(query);
        const bodyMatch = (notif.body || '').toLowerCase().includes(query);
        const eventMatch = (notif.event || '').toLowerCase().includes(query);
        const tokenMatch = (notif.payload?.tokenNumber || notif.dedupeKey || '').toLowerCase().includes(query);
        const cropMatch = (notif.payload?.crop || '').toLowerCase().includes(query);

        if (!titleMatch && !bodyMatch && !eventMatch && !tokenMatch && !cropMatch) {
          return false;
        }
      }

      return true;
    });
  }, [notifications, activeTab, selectedCategory, searchQuery]);

  // Helper for rendering event icons
  const getEventIcon = (event) => {
    if (event?.startsWith('booking') || event?.startsWith('slot')) {
      return <Calendar className="w-4 h-4 text-emerald-400" />;
    }
    if (event === 'gate_checkin' || event === 'turn_near' || event === 'leave_by_alert') {
      return <Truck className="w-4 h-4 text-cyan-400" />;
    }
    if (event === 'quality_assayed') {
      return <Microscope className="w-4 h-4 text-violet-400" />;
    }
    if (event === 'weighbridge_done') {
      return <Scale className="w-4 h-4 text-amber-400" />;
    }
    if (event === 'procurement_recorded') {
      return <FileText className="w-4 h-4 text-blue-400" />;
    }
    if (event?.startsWith('payout')) {
      return <CreditCard className="w-4 h-4 text-emerald-400" />;
    }
    if (event?.startsWith('exception') || event?.startsWith('complaint')) {
      return <ShieldAlert className="w-4 h-4 text-rose-400" />;
    }
    if (event?.startsWith('fast_track')) {
      return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
    return <Bell className="w-4 h-4 text-slate-400" />;
  };

  const backLink = userRole ? '/staff/desk' : '/farmer/command-center';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <GovHeader
        currentLang={lang}
        onLanguageChange={(l) => {
          setLang(l);
          localStorage.setItem('kisanq_lang', l);
        }}
        showPortalSwitch={true}
        portalType={userRole ? 'staff' : 'farmer'}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Top Breadcrumb & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              to={backLink}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Unified Notification Centre
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold animate-pulse">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live multi-channel telemetry, SMS audit logs, and operational queue alerts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadNotifications(true)}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              title="Refresh inbox"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-950/40 text-emerald-400 border border-slate-800 hover:border-emerald-700/50 text-xs font-bold transition-all"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="mt-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Read / Unread Tabs */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Notifications ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'unread'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, token, crop, or message..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* Event Category Filter Pills */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {EVENT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-xs'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800/80 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notifications Feed */}
        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800/80">
              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-400">Loading your notifications from MongoDB Atlas...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6 opacity-40" />
              </div>
              <h3 className="text-sm font-bold text-slate-300">No notifications found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery || selectedCategory !== 'all' || activeTab === 'unread'
                  ? 'Try adjusting your search criteria or filter categories.'
                  : 'Yard checkpoints, gate arrivals, and DBT payout notifications will appear here automatically.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isUnread = !notif.read;
              const inAppStatus = notif.channels?.inApp?.status || (notif.read ? 'read' : 'delivered');
              const smsStatus = notif.channels?.sms?.status;
              const smsAttempts = notif.channels?.sms?.attempts || 0;
              const dateObj = notif.createdAt ? new Date(notif.createdAt) : new Date();
              const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

              return (
                <div
                  key={notif._id || notif.id || notif.dedupeKey}
                  onClick={() => isUnread && handleMarkAsRead(notif._id)}
                  className={`group relative p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                    isUnread
                      ? 'bg-slate-900/90 hover:bg-slate-900 border-slate-700/80 shadow-md shadow-black/20'
                      : 'bg-slate-900/40 hover:bg-slate-900/60 border-slate-800/60 opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    
                    {/* Icon Badge */}
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {getEventIcon(notif.event)}
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0">
                      
                      {/* Title & Metadata Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-bold tracking-tight ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                            {notif.title}
                          </h3>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formattedDate} · {formattedTime}</span>
                        </div>
                      </div>

                      {/* Message Body */}
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed break-words">
                        {notif.body}
                      </p>

                      {/* Delivery Status & Metadata Badges */}
                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        
                        {/* Event Tag */}
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400">
                          event: {notif.event}
                        </span>

                        {/* Language Tag */}
                        {notif.lang && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/60 text-slate-400">
                            {notif.lang}
                          </span>
                        )}

                        {/* In-App Channel Badge */}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1">
                          <Radio className="w-3 h-3 text-emerald-400" />
                          <span>in-app: {inAppStatus}</span>
                        </span>

                        {/* SMS Channel Badge (queued | sent | mock | failed) */}
                        {smsStatus && smsStatus !== 'none' && (
                          <span
                            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                              smsStatus === 'sent'
                                ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300'
                                : smsStatus === 'mock'
                                ? 'bg-cyan-950/80 border-cyan-600/70 text-cyan-300'
                                : smsStatus === 'queued'
                                ? 'bg-amber-950/80 border-amber-600/70 text-amber-300'
                                : 'bg-rose-950/80 border-rose-600/70 text-rose-300'
                            }`}
                          >
                            <span>SMS: {smsStatus.toUpperCase()}</span>
                            {smsAttempts > 0 && <span className="opacity-75">({smsAttempts}/2)</span>}
                          </span>
                        )}

                        {/* Mark As Read Action (on hover/card) */}
                        {isUnread && (
                          <button
                            onClick={(e) => handleMarkAsRead(notif._id, e)}
                            className="ml-auto text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark read</span>
                          </button>
                        )}

                      </div>

                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>
    </div>
  );
}
