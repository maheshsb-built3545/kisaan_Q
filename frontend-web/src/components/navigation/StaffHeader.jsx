import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  ShieldCheck,
  LogOut,
  Radio,
  DoorOpen,
  Scale,
  AlertTriangle,
  LayoutDashboard,
  Building2,
  User,
  ChevronDown,
  ArrowLeft,
  Leaf
} from 'lucide-react';
import Badge from '../common/Badge';

export const StaffHeader = ({ activeDesk, currentCentreName }) => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/staff-login');
  };

  const navItems = [
    {
      id: 'guard',
      label: 'Gate Terminal',
      path: '/guard-terminal',
      icon: DoorOpen,
      roles: ['operator', 'staff', 'supervisor', 'district_admin', 'farmer'],
    },
    {
      id: 'weighmaster',
      label: 'Weighmaster Desk',
      path: '/weighmaster-desk',
      icon: Scale,
      roles: ['operator', 'staff', 'supervisor', 'district_admin', 'farmer'],
    },
    {
      id: 'supervisor',
      label: 'Supervisor Desk',
      path: '/supervisor-exceptions',
      icon: AlertTriangle,
      roles: ['supervisor', 'district_admin', 'farmer', 'staff'],
    },
    {
      id: 'admin',
      label: 'District Admin',
      path: '/admin-dashboard',
      icon: LayoutDashboard,
      roles: ['district_admin', 'supervisor', 'auditor', 'operator', 'farmer', 'staff'],
    },
  ];

  const userRole = user?.role || 'district_admin';

  const roleLabels = {
    operator: 'Gate Operator',
    staff: 'Weighmaster / Staff',
    supervisor: 'Mandi Supervisor',
    district_admin: 'District Collector Admin',
    auditor: 'APMC Auditor',
    farmer: 'Farmer (Demo Admin)',
  };

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
      <div className="gov-tricolor-strip w-full" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Centre Title */}
          <div className="flex items-center gap-4 shrink-0">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-glow-emerald">
                <ShieldCheck className="w-5 h-5 text-slate-950 font-bold" />
              </div>
              <div>
                <span className="font-bold text-base text-white tracking-tight">
                  Kisan<span className="text-emerald-400">Q</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                  STAFF PORTAL
                </span>
              </div>
            </Link>

            {/* Switch to Farmer View Link */}
            <Link
              to="/farmer/command-center"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all shadow-sm"
              title="Return to Farmer Command Center"
            >
              <Leaf className="w-3.5 h-3.5" />
              <span>Switch to Farmer View</span>
            </Link>
          </div>

          {/* Desk Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || activeDesk === item.id;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Socket Live Status */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Live Socket Status */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
              title={isConnected ? 'Real-time WebSocket connected' : 'Connecting to telemetry gateway...'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>{isConnected ? 'Live Telemetry' : 'Connecting...'}</span>
            </div>

            {/* User Profile Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <User className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-white leading-tight">
                  {user?.name || 'District Admin Officer'}
                </div>
                <div className="text-[10px] text-emerald-400 font-medium">
                  {roleLabels[userRole] || 'District Collector Admin'}
                </div>
              </div>

              <Link
                to="/farmer/command-center"
                className="md:hidden p-2 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-400 hover:bg-emerald-900 transition-colors"
                title="Farmer View"
              >
                <Leaf className="w-4 h-4" />
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors ml-1"
                title="Log Out of Staff Portal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex lg:hidden items-center gap-1 overflow-x-auto py-2 border-t border-slate-800/60 scrollbar-none">
          <Link
            to="/farmer/command-center"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          >
            <Leaf className="w-3.5 h-3.5" />
            <span>Farmer View</span>
          </Link>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || activeDesk === item.id;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default StaffHeader;
