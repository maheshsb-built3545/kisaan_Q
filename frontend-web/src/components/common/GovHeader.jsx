import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe, Clock, Sparkles, Building2, User, ArrowRight, Shield, Layers, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MANDIS } from '../../services/storageService';

export default function GovHeader({
  currentLang = 'en',
  onLanguageChange,
  showPortalSwitch = true,
  portalType = 'farmer',
  activeMandi = null,
  onMandiChange = null,
  onOpenResetModal = null,
  onLogout = null,
}) {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [liveTime, setLiveTime] = useState('');
  const [fontSize, setFontSize] = useState('base');

  // Strictly bind displayed profile to an active session token matching current context
  const activeUserProfile = token && user ? user : null;

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      await logout();
      console.log('[AuthContext] kisanq_token after logout:', localStorage.getItem('kisanq_token'));
      navigate('/', { replace: true });
    }
  };

  // Live IST Clock ticking
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      };
      setLiveTime(now.toLocaleTimeString('en-IN', options));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFontSize = (size) => {
    setFontSize(size);
    document.documentElement.classList.remove('font-size-sm', 'font-size-base', 'font-size-lg');
    document.documentElement.classList.add(`font-size-${size}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* ── Brand Logo ────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <span className="font-black text-lg tracking-tight">K</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xl text-slate-900 tracking-tight">
                    Kisan<span className="text-emerald-600">Q</span>
                  </span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[10px] font-medium text-slate-500 tracking-tight leading-none hidden sm:block">
                  Smart Mandi Queue & Logistics
                </p>
              </div>
            </Link>

            {/* Active Mandi Indicator or Live Status */}
            {activeMandi && onMandiChange ? (
              <div className="hidden md:flex items-center ml-4 pl-4 border-l border-slate-200">
                <select
                  value={activeMandi.id}
                  onChange={(e) => onMandiChange(e.target.value)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold py-1 px-2.5 rounded-lg border border-slate-300 outline-none cursor-pointer transition-colors"
                >
                  {MANDIS.map((m) => (
                    <option key={m.id} value={m.id}>
                      📍 {m.name} ({m.distanceKm} km)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  5 Mandis Online
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 font-mono text-[11px]">IST {liveTime}</span>
              </div>
            )}
          </div>

          {/* ── Right Controls ────────────────────────────────────────── */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Accessibility Font Size Toggle */}
            <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => handleFontSize('sm')}
                className={`px-1.5 py-0.5 rounded font-bold transition-colors ${fontSize === 'sm' ? 'bg-white shadow-xs text-slate-900' : 'hover:text-slate-900'}`}
                title="Smaller font"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => handleFontSize('base')}
                className={`px-1.5 py-0.5 rounded font-bold transition-colors ${fontSize === 'base' ? 'bg-white shadow-xs text-slate-900' : 'hover:text-slate-900'}`}
                title="Normal font"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => handleFontSize('lg')}
                className={`px-1.5 py-0.5 rounded font-bold transition-colors ${fontSize === 'lg' ? 'bg-white shadow-xs text-slate-900' : 'hover:text-slate-900'}`}
                title="Larger font"
              >
                A+
              </button>
            </div>

            {/* Trilingual Language Selector Pills */}
            {onLanguageChange && (
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => onLanguageChange('en')}
                  className={`px-2 py-1 rounded-md transition-all ${
                    currentLang === 'en'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('hi')}
                  className={`px-2 py-1 rounded-md transition-all ${
                    currentLang === 'hi'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  हिं
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('mr')}
                  className={`px-2 py-1 rounded-md transition-all ${
                    currentLang === 'mr'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  मरा
                </button>
              </div>
            )}

            {/* Optional Reset / Seeding Trigger (For Staff Desk testing) */}
            {onOpenResetModal && (
              <button
                type="button"
                onClick={onOpenResetModal}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                title="Reset/Seed Test Data"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Data</span>
              </button>
            )}

            {/* User Profile Pill & Logout */}
            {activeUserProfile && (
              <div className="flex items-center gap-1.5">
                <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                    {activeUserProfile.name ? activeUserProfile.name[0] : 'U'}
                  </div>
                  <span className="font-semibold text-slate-800 max-w-[110px] truncate">
                    {activeUserProfile.name || 'User'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Logout Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Portal Switch Button */}
            {showPortalSwitch && (
              portalType === 'farmer' ? (
                <Link
                  to="/staff-login"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs"
                >
                  <span>Staff Desk</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                </Link>
              ) : (
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-all"
                >
                  <span>Farmer App</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )
            )}

          </div>

        </div>
      </div>
    </header>
  );
}
