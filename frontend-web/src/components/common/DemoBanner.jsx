import React, { useState } from 'react';
import { FlaskConical, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { demoApi } from '../../api/demo.api';

/**
 * DemoBanner — shown on every page in a demo session.
 *
 * Props:
 *   area: 'farmer' | 'staff'
 *     Controls which session token is used to call reset and which logout fires.
 *     Farmer banner reads farmerUser; staff banner reads staffUser.
 *     They are independent — both can be visible on the same screen.
 *
 * Behaviour:
 *   - Visible only when the active user for the given area has demo:true claim.
 *   - "Reset demo data" → calls POST /api/demo/reset, then hard-refreshes the page.
 *   - "Exit demo" → logs out the given area only (does not touch the other area).
 */
export default function DemoBanner({ area = 'farmer' }) {
  const { farmerUser, staffUser, isDemoFarmer, isDemoStaff, logoutFarmer, logoutStaff } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  // Only show for the matching area and only when demo:true is in the session
  const shouldShow = area === 'farmer' ? isDemoFarmer : isDemoStaff;
  if (!shouldShow) return null;

  const handleReset = async () => {
    try {
      setIsResetting(true);
      setResetError('');
      await demoApi.resetDemoData(area);
      // Hard refresh so all live data re-renders from the retimed state
      window.location.reload();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Reset failed';
      setResetError(msg);
    } finally {
      setIsResetting(false);
    }
  };

  const handleExit = () => {
    if (area === 'farmer') {
      logoutFarmer();
      window.location.href = '/farmer-login';
    } else {
      logoutStaff();
      window.location.href = '/staff-login';
    }
  };

  const userName = area === 'farmer'
    ? farmerUser?.name
    : staffUser?.name;

  return (
    <div
      id={`demo-banner-${area}`}
      role="status"
      aria-label={`Demo mode banner for ${area} session`}
      className="demo-banner"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderBottom: '1px solid rgba(251, 191, 36, 0.3)',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        backdropFilter: 'blur(8px)'
      }}
    >
      {/* Left: demo label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
        <FlaskConical size={14} style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>Demo mode</span>
        <span style={{
          background: 'rgba(251, 191, 36, 0.15)',
          border: '1px solid rgba(251, 191, 36, 0.4)',
          borderRadius: '4px',
          padding: '1px 6px',
          fontSize: '10px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          sample data
        </span>
        {userName && (
          <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: '11px' }}>
            — {userName}
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {resetError && (
          <span style={{ color: '#f87171', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} /> {resetError}
          </span>
        )}
        <button
          id={`demo-reset-btn-${area}`}
          onClick={handleReset}
          disabled={isResetting}
          title="Re-time showcase scenarios to live clock"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(251, 191, 36, 0.5)',
            background: 'rgba(251, 191, 36, 0.1)',
            color: '#fbbf24',
            cursor: isResetting ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: 500,
            opacity: isResetting ? 0.7 : 1,
            transition: 'all 0.15s ease'
          }}
        >
          <RefreshCw size={11} style={{ animation: isResetting ? 'spin 1s linear infinite' : 'none' }} />
          {isResetting ? 'Resetting…' : 'Reset demo data'}
        </button>

        <button
          id={`demo-exit-btn-${area}`}
          onClick={handleExit}
          title="Exit demo session (other area sessions are preserved)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'rgba(148, 163, 184, 0.05)',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 500,
            transition: 'all 0.15s ease'
          }}
        >
          <LogOut size={11} />
          Exit demo
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        #demo-banner-${area} button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
