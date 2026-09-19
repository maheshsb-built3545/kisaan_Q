import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GovHeader from '../components/common/GovHeader';
import {
  Building2, Truck, RefreshCw, CheckCircle2,
  MapPin, Scale, Database, Radio, Check, Filter,
  ScanLine, Printer, Zap, Gauge, ShieldCheck
} from 'lucide-react';
import { StatusBadge, ActionButton } from '../components/staff';
import {
  joinAdminRoom, onNewBooking, onStageUpdated,
  onHardwareEvent, subscribeConnectionStatus, triggerHardwareSimulation
} from '../services/socketService';
import { MANDIS, STAGE_DEFINITIONS } from '../services/storageService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const CROPS = ['Wheat', 'Soybean', 'Onion', 'Cotton'];

export default function AdminDashboard() {
  const { user } = useAuth();

  // State
  const [tokens, setTokens] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState('ALL');
  const [selectedMandiId, setSelectedMandiId] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [recentEventToast, setRecentEventToast] = useState(null);
  const [hardwareState, setHardwareState] = useState({
    boomBarrier: 'CLOSED',
    weighScale: '0.00 MT',
    lastEvent: null
  });

  // Fetch tokens from live backend
  const fetchLiveTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('kq_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/tokens/all`, {
        headers,
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tokens)) {
          setTokens(data.tokens);
        }
      }
    } catch (err) {
      console.warn('[AdminDashboard] Falling back to local storage tokens:', err.message);
      try {
        const local = JSON.parse(localStorage.getItem('kisanq_active_tokens') || '[]');
        setTokens(local);
      } catch {
        setTokens([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Socket.IO Setup & Event Listeners
  useEffect(() => {
    fetchLiveTokens();
    joinAdminRoom();

    const unsubConn = subscribeConnectionStatus((connected) => {
      setSocketConnected(connected);
    });

    const unsubBooking = onNewBooking((data) => {
      const newToken = data.token || data;
      setTokens((prev) => {
        const key = newToken.id || newToken.tokenNumber;
        const exists = prev.some((t) => (t.id || t.tokenNumber) === key);
        if (exists) return prev;
        return [newToken, ...prev];
      });

      setRecentEventToast({
        title: 'New Arrival Slot Booked',
        desc: `${newToken.farmerName || 'Farmer'} booked ${newToken.quantity || 10} Quintals ${newToken.crop} at ${newToken.mandiName || 'APMC Mandi'}`,
        badge: newToken.tokenNumber || newToken.id,
      });
      setTimeout(() => setRecentEventToast(null), 5000);
    });

    const unsubStage = onStageUpdated((data) => {
      const updatedToken = data.token;
      const tokenNum = data.tokenNumber || updatedToken?.tokenNumber || updatedToken?.id;

      setTokens((prev) =>
        prev.map((t) => {
          if ((t.tokenNumber || t.id) === tokenNum) {
            return updatedToken || { ...t, currentStageIndex: data.stageIndex || t.currentStageIndex + 1, status: data.status || 'In-Progress' };
          }
          return t;
        })
      );

      setRecentEventToast({
        title: 'Checkpoint Signed Off',
        desc: `Token #${tokenNum} marked ${data.stageTitle || 'Checkpoint'} by ${data.officerName || 'Officer'}`,
        badge: data.stageTitle || 'Approved',
      });
      setTimeout(() => setRecentEventToast(null), 4500);
    });

    const unsubHardware = onHardwareEvent((data) => {
      if (data.device === 'BOOM_BARRIER') {
        setHardwareState((prev) => ({ ...prev, boomBarrier: data.action, lastEvent: data }));
      } else if (data.device === 'LOAD_CELL') {
        setHardwareState((prev) => ({ ...prev, weighScale: data.value, lastEvent: data }));
      }
    });

    return () => {
      unsubConn();
      unsubBooking();
      unsubStage();
      unsubHardware();
    };
  }, [fetchLiveTokens]);

  // Handle Admin Quick Stage Action
  const handleAdminAdvanceStage = async (token, stageDef, targetIndex) => {
    const tokenNumber = token.tokenNumber || token.id;
    setActionLoadingId(`${tokenNumber}-${stageDef.id}`);

    const sigId = `${stageDef.officerCode}-${Date.now().toString(36).toUpperCase()}`;
    const extras = {};
    if (stageDef.id === 'QUALITY_GRADING') extras.grade = 'Grade A (Moisture 11.2%)';
    if (stageDef.id === 'WEIGHBRIDGE') extras.weight = (token.quantity * 0.96).toFixed(2);

    try {
      const tokenAuth = localStorage.getItem('kq_token');
      const headers = { 'Content-Type': 'application/json' };
      if (tokenAuth) headers['Authorization'] = `Bearer ${tokenAuth}`;

      const res = await fetch(`${API_BASE}/tokens/${encodeURIComponent(tokenNumber)}/stage-progress`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          stageId: stageDef.id,
          stageIndex: targetIndex,
          officerName: stageDef.officer,
          officerSigId: sigId,
          status: 'Completed',
          ...extras
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setTokens((prev) =>
            prev.map((t) => ((t.tokenNumber || t.id) === tokenNumber ? data.token : t))
          );
        }
      }
    } catch (err) {
      console.error('Failed to advance stage from Admin:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Hardware Simulation Controls
  const toggleBoomBarrier = async () => {
    const nextAction = hardwareState.boomBarrier === 'OPEN' ? 'CLOSED' : 'OPEN';
    setHardwareState((prev) => ({ ...prev, boomBarrier: nextAction }));
    await triggerHardwareSimulation({
      mandiId: 'KPG-01',
      device: 'BOOM_BARRIER',
      action: nextAction
    });
  };

  const simulateScaleReading = async () => {
    const randWeight = (Math.random() * 8 + 15).toFixed(2) + ' MT';
    setHardwareState((prev) => ({ ...prev, weighScale: randWeight }));
    await triggerHardwareSimulation({
      mandiId: 'KPG-01',
      device: 'LOAD_CELL',
      action: 'WEIGHT_LOCKED',
      value: randWeight
    });
  };

  // Filter Tokens
  const filteredTokens = tokens.filter((t) => {
    if (selectedCrop !== 'ALL' && t.crop !== selectedCrop) return false;
    if (selectedMandiId !== 'ALL' && t.mandiId !== selectedMandiId) return false;
    return true;
  });

  // Calculate Metrics
  const activeCount = tokens.filter((t) => t.status !== 'Completed' && t.status !== 'COMPLETED').length;
  const completedCount = tokens.filter((t) => t.status === 'Completed' || t.status === 'COMPLETED').length;
  const totalQuintals = tokens.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <GovHeader portalType="staff" />

      {/* Real-Time Toast Notification */}
      {recentEventToast && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200 bg-slate-900 border border-emerald-500/50 text-white px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-md max-w-md flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 truncate">
                {recentEventToast.title}
              </h4>
              <span className="text-[10px] font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-emerald-400 border border-slate-700 shrink-0">
                {recentEventToast.badge}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-snug">{recentEventToast.desc}</p>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:px-8">
        {/* Header & Status Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                APMC Regional Procurement Command
              </h1>
              <StatusBadge status={socketConnected ? 'ONLINE' : 'OFFLINE'} size="xs">
                {socketConnected ? 'Socket Live Sync' : 'Reconnecting'}
              </StatusBadge>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Live Synchronized with MongoDB Atlas Cluster (`kisanq.tokens`)</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link to="/admin-dashboard/desk">
              <ActionButton
                variant="primary"
                size="sm"
                icon={ScanLine}
              >
                Open Staff Desk
              </ActionButton>
            </Link>
            <ActionButton
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              isLoading={isLoading}
              loadingText="Refreshing…"
              onClick={fetchLiveTokens}
            >
              Refresh Data
            </ActionButton>
            <ActionButton
              variant="outline"
              size="sm"
              icon={Printer}
              onClick={() => window.print()}
            >
              Print Report
            </ActionButton>
          </div>
        </div>

        {/* High-Density KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
              <span>Active Vehicles in Queue</span>
              <Truck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2 font-mono">{activeCount}</div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">Live in APMC Network</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
              <span>Completed Payouts</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-emerald-700 mt-2 font-mono">{completedCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Direct Bank Transfers cleared</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
              <span>Total Volume Intake</span>
              <Scale className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
              {totalQuintals} <span className="text-sm font-sans font-normal text-slate-500">Qtl</span>
            </div>
            <div className="text-11px] text-slate-500 mt-1">Across 4 Regional Crops</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
              <span>Telemetry Node Status</span>
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            </div>
            <div className="text-3xl font-black text-emerald-700 mt-2 font-mono">100%</div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">5 Regional Mandis Online</div>
          </div>
        </div>

        {/* Hardware Simulation Bar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 flex items-center justify-center">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">IoT Hardware Telemetry Bridge</h3>
              <p className="text-xs text-slate-600">
                Gate Boom Barrier: <strong className={hardwareState.boomBarrier === 'OPEN' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{hardwareState.boomBarrier}</strong>
                {' · '}
                Weighbridge Digital Cell: <strong className="text-slate-900 font-mono font-bold">{hardwareState.weighScale}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              icon={ShieldCheck}
              onClick={toggleBoomBarrier}
            >
              Toggle Barrier ({hardwareState.boomBarrier === 'OPEN' ? 'Close' : 'Open'})
            </ActionButton>
            <ActionButton
              variant="outline"
              size="sm"
              icon={Scale}
              onClick={simulateScaleReading}
            >
              Simulate Scale Reading
            </ActionButton>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-emerald-600" /> Crop Queue:
            </span>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {['ALL', ...CROPS].map((cr) => (
                <button
                  key={cr}
                  type="button"
                  onClick={() => setSelectedCrop(cr)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedCrop === cr
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  {cr}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mandi:</span>
            <select
              value={selectedMandiId}
              onChange={(e) => setSelectedMandiId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All APMC Centers (5 Hubs)</option>
              {MANDIS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Crop Queue Kanban */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
          {CROPS.map((cropName) => {
            const cropTokens = filteredTokens.filter((t) => t.crop === cropName);
            const cropTotalQtl = cropTokens.reduce((s, t) => s + (Number(t.quantity) || 0), 0);

            return (
              <div key={cropName} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">{cropName} Queue</h3>
                  </div>
                  <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                    {cropTokens.length} Tokens ({cropTotalQtl} Qt)
                  </span>
                </div>

                <div className="space-y-3 flex-1 min-h-[220px]">
                  {cropTokens.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-400">
                      <p className="text-xs">No active {cropName} tokens</p>
                      <span className="text-[10px] mt-1 text-slate-400">Live tokens will appear here instantly</span>
                    </div>
                  ) : (
                    cropTokens.map((token) => {
                      const completedStages = (token.stages || []).filter(
                        (s) => s.status === 'Completed' || s.status === 'completed'
                      ).length;
                      const nextStage = (token.stages || STAGE_DEFINITIONS).find(
                        (s) => s.status !== 'Completed' && s.status !== 'completed'
                      ) || STAGE_DEFINITIONS[completedStages] || STAGE_DEFINITIONS[0];
                      const isComplete = completedStages >= 5;

                      return (
                        <div
                          key={token.tokenNumber || token.id}
                          className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-emerald-500/50 transition-all shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="font-mono font-bold text-xs text-slate-900">
                                #{token.tokenNumber || token.id}
                              </div>
                              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                                {token.farmerName || 'Citizen Farmer'}
                              </div>
                            </div>
                            <StatusBadge status={token.status} size="xs" />
                          </div>

                          <div className="text-[11px] text-slate-500 space-y-0.5 mb-3">
                            <p className="truncate">📍 {token.mandiName}</p>
                            <p>⚖️ {token.quantity || 10} Quintals · {token.slotTime || token.slotLabel || 'Morning'}</p>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                              <span>Checkpoints</span>
                              <span className="font-mono text-emerald-700 font-bold">{completedStages}/5 Certified</span>
                            </div>
                            <div className="flex gap-1 h-1.5">
                              {[0, 1, 2, 3, 4].map((idx) => (
                                <div
                                  key={idx}
                                  className={`flex-1 rounded-full ${
                                    idx < completedStages ? 'bg-emerald-600' : 'bg-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Admin Action Button */}
                          {!isComplete ? (
                            <ActionButton
                              variant="primary"
                              size="sm"
                              fullWidth
                              isLoading={actionLoadingId === `${token.tokenNumber || token.id}-${nextStage.id}`}
                              loadingText="Signing off…"
                              onClick={() => handleAdminAdvanceStage(token, nextStage, completedStages)}
                              icon={Check}
                            >
                              Sign-off {nextStage.shortLabel || nextStage.label}
                            </ActionButton>
                          ) : (
                            <div className="text-center py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-800">
                              ✓ All 5 Stages Cleared & Paid
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Regional Congestion Matrix */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>Regional APMC Mandi Load Balancing Network</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">Live Telemetry Synchronized</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MANDIS.map((mandi) => {
              const mandiTokens = tokens.filter((t) => t.mandiId === mandi.id);
              return (
                <div key={mandi.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{mandi.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {mandi.location}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      {mandi.code}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Active Queue</span>
                      <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">{mandiTokens.length} Tokens</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Congestion</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{mandi.congestion}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
