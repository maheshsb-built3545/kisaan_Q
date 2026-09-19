import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GovHeader from '../components/common/GovHeader';
import {
  ShieldCheck, Lock, User, ArrowRight, Sparkles,
  Building2, Scale, Leaf, Banknote, CheckCircle2,
  Activity, MapPin, KeyRound, AlertTriangle,
  ArrowLeft, Clock
} from 'lucide-react';
import { ActionButton, StatusBadge } from '../components/staff';
import { MANDIS } from '../services/storageService';
import {
  joinMandiRoom, onNewBooking, onStageUpdated,
  onTokenCompleted, onTokenCancelled, onQueueSlotFreed
} from '../services/socketService';
import { TOKEN_STATUS, normalizeStatus, isTokenActive } from '../utils/statusEnums';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// 5 Active Operational Mandis for Maharashtra APMC Operations
const ACTIVE_MANDIS = MANDIS.filter((m) =>
  ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05'].includes(m.id)
);

const MANDI_FACILITY_CONFIG = {
  'KPG-01': 'Weighbridge Calibrated',
  'SRD-02': 'Weighbridge Calibrated',
  'RHT-03': 'Pitless Scale Active',
  'VJP-04': 'Scales 1 & 2 Active',
  'SRP-05': 'Weighbridge Calibrated',
};

// ─── Station Roles ───────────────────────────────────────────────────────────
const PHYSICAL_STATION_ROLES = [
  {
    id: 'security_gate',
    roleLabel: 'Desk 1: Security Gate',
    officerName: 'Ramesh Shinde',
    officerPhone: '9800000001',
    officerCode: 'SEC-D1-KPG',
    icon: ShieldCheck,
    deskName: 'Gate Check-In & ANPR Intake',
    terminalLane: 'Gate 01 - North Boom Barrier',
    terminalCode: 'GATE-01-NBR',
    description: 'Scans QR passes, manages live yard intake & boom barrier release',
  },
  {
    id: 'quality_assayer',
    roleLabel: 'Desk 2: Quality Lab',
    officerName: 'S. Patil',
    officerPhone: '9800000002',
    officerCode: 'QA-SP-KPG',
    icon: Leaf,
    deskName: 'Assaying Lab #2 (NIR Moisture)',
    terminalLane: 'Assaying Lab #2',
    terminalCode: 'LAB-02-NIR',
    description: 'Inspects moisture, foreign matter, applies FAQ Grade A/B/C',
  },
  {
    id: 'weighmaster',
    roleLabel: 'Desk 3: Weighbridge',
    officerName: 'Suresh Jadhav',
    officerPhone: '9800000003',
    officerCode: 'WM-02-KPG',
    icon: Scale,
    deskName: 'Pitless Electronic Weighbridge #1',
    terminalLane: 'Pitless Weighbridge #1 (60 MT)',
    terminalCode: 'WB-01-60MT',
    description: 'Direct load-cell telemetry reading, gross & tare lock, auto net weight',
  },
  {
    id: 'procurement',
    roleLabel: 'Desk 4: Procurement',
    officerName: 'Secretary Deshmukh',
    officerPhone: '9800000004',
    officerCode: 'SEC-APMC-KPG',
    icon: Building2,
    deskName: 'APMC Secretary Procurement Terminal',
    terminalLane: 'APMC Secretary Terminal',
    terminalCode: 'SEC-PROC-01',
    description: 'Generates purchase order bill, confirms statutory rates & weights',
  },
  {
    id: 'accounts_settlement',
    roleLabel: 'Desk 5: Treasury & DBT',
    officerName: 'Treasurer Deshmukh',
    officerPhone: '9800000005',
    officerCode: 'TRY-DBT-KPG',
    icon: Banknote,
    deskName: 'Treasury & PFMS/DBT Settlement Desk',
    terminalLane: 'Accounts & DBT Payout Desk',
    terminalCode: 'TRY-DBT-DESK',
    description: 'Automatic penalty recovery, net DBT bank payout disbursement',
  },
];

export default function StaffLogin() {
  const navigate = useNavigate();
  const { staffVerifyCredentials, staffVerifyOtp } = useAuth();

  // Selected Center & Station
  const [selectedMandiId, setSelectedMandiId] = useState('KPG-01');
  const [selectedStation, setSelectedStation] = useState(PHYSICAL_STATION_ROLES[0]);
  
  // 2FA Pipeline State (Step 1: Credentials -> Step 2: OTP Challenge)
  const [authStep, setAuthStep] = useState(1);
  const [challengeToken, setChallengeToken] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(120);

  // Form Input State
  const [officerPhone, setOfficerPhone] = useState('9800000001');
  const [username, setUsername] = useState('Ramesh Shinde');
  const [password, setPassword] = useState('Staff@KisanQ2026');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected Mandi Object
  const selectedMandi = useMemo(() => {
    return ACTIVE_MANDIS.find((m) => m.id === selectedMandiId) || ACTIVE_MANDIS[0];
  }, [selectedMandiId]);

  // Live Yard Telemetry State
  const [telemetryData, setTelemetryData] = useState({
    isLoading: true,
    isLive: false,
    trucksInYard: 0,
    totalActiveQueue: 0,
    gateVelocity: '~3.5 min/truck',
    isPaceLive: false,
    paceSamplesCount: 0,
    loadPercentage: 0,
    status: 'Connecting…',
    code: 'MH-KPG-01',
    mandiName: 'APMC Kopargaon',
    scaleStatus: 'Weighbridge Calibrated',
  });

  // Fetch Live Telemetry from Backend Endpoints
  const fetchLiveTelemetry = useCallback(async (targetMandiId) => {
    const mandiObj = ACTIVE_MANDIS.find((m) => m.id === targetMandiId) || ACTIVE_MANDIS[0];
    try {
      const [centresRes, tokensRes] = await Promise.allSettled([
        fetch(`${API_BASE}/centres`, { signal: AbortSignal.timeout(3000) }),
        fetch(`${API_BASE}/tokens/mandi/${targetMandiId}`, { signal: AbortSignal.timeout(3000) }),
      ]);

      let centreData = null;
      if (centresRes.status === 'fulfilled' && centresRes.value.ok) {
        const json = await centresRes.value.json();
        const centres = Array.isArray(json) ? json : json?.data || [];
        centreData = centres.find((c) => c.code === targetMandiId || c.name === mandiObj.name);
      }

      let tokens = [];
      if (tokensRes.status === 'fulfilled' && tokensRes.value.ok) {
        const json = await tokensRes.value.json();
        tokens = Array.isArray(json?.tokens) ? json.tokens : (Array.isArray(json) ? json : []);
      }

      const activeTokens = tokens.filter((t) => isTokenActive(t.status));

      // Trucks physically inside yard: past gate check-in and not completed/cancelled
      const yardTrucks = tokens.filter((t) => {
        const norm = normalizeStatus(t.status);
        if (norm === TOKEN_STATUS.COMPLETED || norm === TOKEN_STATUS.CANCELLED) return false;
        const isPastGate = (t.currentStageIndex !== undefined && t.currentStageIndex > 0) ||
          (t.stages?.[0]?.status === 'completed' || t.stages?.[0]?.status === 'Completed') ||
          ['GATE_IN', 'INSPECTED', 'WEIGHED', 'PROCUREMENT', 'GATE_EXIT_REQUESTED', 'CHECKED_IN'].includes(t.status);
        return isPastGate;
      });

      // Live Gate Pace Calculation from stage 0 completed timestamps
      const checkInTimestamps = tokens
        .map((t) => {
          const s0 = t.stages?.[0];
          if (s0 && (s0.status === 'completed' || s0.status === 'Completed' || t.currentStageIndex > 0)) {
            const ts = s0.completedAt || s0.timestamp || t.createdAt;
            return ts ? new Date(ts).getTime() : null;
          }
          return null;
        })
        .filter((ts) => ts && !isNaN(ts))
        .sort((a, b) => a - b);

      let isPaceLive = false;
      let gateVelocityStr = '~3.5 min/truck';
      let paceSamplesCount = 0;

      if (checkInTimestamps.length >= 2) {
        const deltasMin = [];
        for (let i = 1; i < checkInTimestamps.length; i++) {
          const deltaMs = checkInTimestamps[i] - checkInTimestamps[i - 1];
          const deltaMin = deltaMs / (60 * 1000);
          if (deltaMin > 0 && deltaMin < 120) {
            deltasMin.push(deltaMin);
          }
        }
        if (deltasMin.length > 0) {
          const avg = deltasMin.reduce((a, b) => a + b, 0) / deltasMin.length;
          gateVelocityStr = `${Math.max(1.0, Math.min(15.0, avg)).toFixed(1)} min/truck`;
          isPaceLive = true;
          paceSamplesCount = checkInTimestamps.length;
        }
      }

      // Dynamic Capacity & Status
      const capacity = centreData?.totalCapacity || 50;
      const computedUtilization = Math.min(100, Math.round((activeTokens.length / capacity) * 100));
      const utilization = (centreData && centreData.utilizationPercent > 0)
        ? Math.max(centreData.utilizationPercent, computedUtilization)
        : computedUtilization;

      let dynamicStatus = 'Optimal Flow';
      if (utilization > 85) {
        dynamicStatus = 'High Volume';
      } else if (utilization > 50) {
        dynamicStatus = 'Active Intake';
      } else if (activeTokens.length > 0) {
        dynamicStatus = 'Normal Intake';
      } else {
        dynamicStatus = 'Idle Intake';
      }

      setTelemetryData({
        isLoading: false,
        isLive: true,
        trucksInYard: yardTrucks.length,
        totalActiveQueue: activeTokens.length,
        gateVelocity: gateVelocityStr,
        isPaceLive,
        paceSamplesCount,
        loadPercentage: utilization,
        status: dynamicStatus,
        code: mandiObj.code,
        mandiName: mandiObj.name,
        scaleStatus: MANDI_FACILITY_CONFIG[targetMandiId] || 'Weighbridge Calibrated',
      });
    } catch (err) {
      console.warn('[StaffLogin] Live telemetry fetch error:', err.message);
      setTelemetryData({
        isLoading: false,
        isLive: false,
        trucksInYard: 0,
        totalActiveQueue: 0,
        gateVelocity: '--',
        isPaceLive: false,
        paceSamplesCount: 0,
        loadPercentage: 0,
        status: 'Telemetry Offline',
        code: mandiObj.code,
        mandiName: mandiObj.name,
        scaleStatus: MANDI_FACILITY_CONFIG[targetMandiId] || 'Scale Offline',
      });
    }
  }, []);

  // Subscribe to live telemetry and Socket.IO real-time stream
  useEffect(() => {
    fetchLiveTelemetry(selectedMandiId);
    joinMandiRoom(selectedMandiId);

    const handleSocketUpdate = (data) => {
      const eventMandi = data?.mandiId || data?.token?.mandiId;
      if (!eventMandi || eventMandi === selectedMandiId || eventMandi.startsWith(selectedMandiId.split('-')[0])) {
        fetchLiveTelemetry(selectedMandiId);
      }
    };

    const unsubBooking = onNewBooking(handleSocketUpdate);
    const unsubStage = onStageUpdated(handleSocketUpdate);
    const unsubCompleted = onTokenCompleted(handleSocketUpdate);
    const unsubCancelled = onTokenCancelled(handleSocketUpdate);
    const unsubFreed = onQueueSlotFreed(handleSocketUpdate);

    return () => {
      unsubBooking?.();
      unsubStage?.();
      unsubCompleted?.();
      unsubCancelled?.();
      unsubFreed?.();
    };
  }, [selectedMandiId, fetchLiveTelemetry]);

  // Countdown timer for 2FA OTP Challenge
  useEffect(() => {
    let timer;
    if (authStep === 2 && otpSecondsLeft > 0) {
      timer = setInterval(() => {
        setOtpSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (authStep === 2 && otpSecondsLeft === 0) {
      setError('2FA verification session expired. Please re-enter your credentials.');
    }
    return () => clearInterval(timer);
  }, [authStep, otpSecondsLeft]);

  // Handle Station Role Selection
  const handleStationSelect = (station) => {
    setSelectedStation(station);
    setUsername(station.officerName);
    setOfficerPhone(station.officerPhone || '9800000001');
    setError('');
    if (authStep === 2) {
      setAuthStep(1);
      setChallengeToken('');
      setOtp('');
    }
  };

  // Step 1: Submit Credentials & Request 2FA Challenge
  const handleVerifyCredentials = async (e) => {
    e.preventDefault();
    setError('');

    if (!officerPhone || officerPhone.length !== 10) {
      setError('Please provide a valid 10-digit officer mobile number');
      return;
    }
    if (!password) {
      setError('Please enter your staff password / security PIN');
      return;
    }

    setIsLoading(true);
    try {
      const res = await staffVerifyCredentials({
        mobileNumber: officerPhone.trim(),
        phone: officerPhone.trim(),
        password: password.trim(),
        role: selectedStation.id,
      });

      if (res?.data?.challengeToken || res?.challengeToken) {
        const token = res?.data?.challengeToken || res?.challengeToken;
        const masked = res?.data?.maskedMobile || res?.maskedMobile || `+91 ******${officerPhone.slice(-4)}`;
        setChallengeToken(token);
        setMaskedMobile(masked);
        setAuthStep(2);
        setOtpSecondsLeft(120);
        setOtp('');
      } else {
        setError('Authentication challenge could not be initialized.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid credentials or role mismatch';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Submit 6-digit OTP to complete authentication
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setIsLoading(true);
    try {
      const res = await staffVerifyOtp({
        challengeToken,
        otp: cleanOtp,
      });

      if (res?.data?.token || res?.token) {
        navigate('/admin-dashboard/desk');
      } else {
        setError('Session token could not be generated.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid or expired OTP code';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <GovHeader
        portalType="staff"
        activeMandi={selectedMandi}
        onMandiChange={setSelectedMandiId}
        showPortalSwitch={true}
      />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>APMC Mandi Operations Terminal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Operational Terminal Access
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Select your assigned duty station and authenticate via 2-Factor Authentication (2FA) to launch checkpoint controls.
            </p>
          </div>

          {/* Center Selector */}
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
            <MapPin className="w-4 h-4 text-emerald-600 ml-1" />
            <span className="text-xs font-bold text-slate-500">Mandi:</span>
            <select
              value={selectedMandiId}
              onChange={(e) => setSelectedMandiId(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold py-1.5 px-3 rounded-xl border border-slate-200 outline-none cursor-pointer transition-colors"
            >
              {ACTIVE_MANDIS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Yard Telemetry Strip */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 mb-6 border border-slate-800 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Live Yard Telemetry</span>
                <span className="text-[10px] font-mono bg-emerald-950 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full">
                  {telemetryData.isLoading ? '...' : telemetryData.code}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {telemetryData.mandiName} · {telemetryData.scaleStatus}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 sm:gap-8 flex-wrap">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vehicles In Yard</span>
              <span className="text-sm font-black font-mono text-white flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {telemetryData.isLoading ? '--' : `${telemetryData.trucksInYard} trucks`}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gate Velocity</span>
              <span className="text-sm font-black font-mono text-emerald-400 mt-0.5 block">
                {telemetryData.isLoading ? '--' : telemetryData.gateVelocity}
              </span>
              {telemetryData.isPaceLive ? (
                <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ● Live Pace ({telemetryData.paceSamplesCount})
                </span>
              ) : (
                <span className="text-[9px] font-medium text-slate-400 block mt-0.5">
                  ○ Calibrated Std
                </span>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Intake Load</span>
              <span className="text-sm font-black font-mono text-cyan-300 mt-0.5 block">
                {telemetryData.isLoading ? '--%' : `${telemetryData.loadPercentage}% Cap`}
              </span>
            </div>
          </div>
        </div>

        {/* Station Selection Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-8 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Assigned Station Desk Selection:</span>
            </span>
            <span className="text-[11px] text-slate-400">Select your active duty role</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {PHYSICAL_STATION_ROLES.map((station) => {
              const isSelected = selectedStation.id === station.id;
              const IconComp = station.icon;
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => handleStationSelect(station)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}>
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>
                      {station.roleLabel.split(':')[1] || station.roleLabel}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {station.officerName}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Two-Column Grid: Station Details & Auth Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Station Overview & Telemetry */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 flex items-center justify-center shrink-0">
                  <selectedStation.icon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                    Selected Duty Desk
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    {selectedStation.roleLabel}
                  </h2>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {selectedStation.description}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Officer Name</span>
                  <span className="font-bold text-slate-800">{selectedStation.officerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Terminal Code</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedStation.terminalCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Lane</span>
                  <span className="font-bold text-slate-800">{selectedStation.terminalLane}</span>
                </div>
              </div>
            </div>

            {/* Yard Telemetry */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Live Yard Telemetry: {selectedMandi.name}
                  </h3>
                </div>
                <StatusBadge status={telemetryData.isLive ? 'ONLINE' : 'OFFLINE'} size="xs">
                  {telemetryData.status}
                </StatusBadge>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xl font-extrabold text-slate-900 font-mono">
                    {telemetryData.isLoading ? '--' : telemetryData.trucksInYard}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Vehicles in Yard</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xl font-extrabold text-slate-900 font-mono">
                    {telemetryData.isLoading ? '--' : telemetryData.gateVelocity}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                    Gate Pace {telemetryData.isPaceLive ? '(● Live)' : '(○ Std)'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xl font-extrabold text-emerald-600 font-mono">
                    {telemetryData.isLoading ? '--%' : `${telemetryData.loadPercentage}%`}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Intake Load</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: 2FA Sign-In Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    {authStep === 1 ? 'Step 1: Role & Credentials' : 'Step 2: 2FA Verification'}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                    Step {authStep}/2
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {authStep === 1
                    ? 'Verify administrative credentials matching your claimed desk.'
                    : `Enter the 6-digit authentication code sent to ${maskedMobile}.`}
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Step 1 Form */}
              {authStep === 1 && (
                <form onSubmit={handleVerifyCredentials} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Officer Mobile Number
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-3 text-xs font-bold text-slate-400">
                        +91
                      </div>
                      <input
                        type="tel"
                        maxLength="10"
                        value={officerPhone}
                        onChange={(e) => setOfficerPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Officer Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Password / Security PIN
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <span className="font-bold text-slate-700">Claimed Station Desk: </span>
                    <span className="text-emerald-700 font-bold">{selectedStation.roleLabel}</span>
                  </div>

                  <ActionButton
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    isLoading={isLoading}
                    loadingText="Verifying Role…"
                    rightIcon={ArrowRight}
                  >
                    Verify Role & Request 2FA OTP
                  </ActionButton>
                </form>
              )}

              {/* Step 2 Form */}
              {authStep === 2 && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>OTP Challenge Valid:</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-800">
                      {Math.floor(otpSecondsLeft / 60)}:{(otpSecondsLeft % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      6-Digit Administrative SMS Code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        maxLength="6"
                        autoFocus
                        placeholder="••••••"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 text-center tracking-[0.4em] focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
                        required
                      />
                    </div>
                  </div>

                  <ActionButton
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    isLoading={isLoading}
                    loadingText="Signing in…"
                    disabled={otp.length !== 6 || otpSecondsLeft === 0}
                    rightIcon={CheckCircle2}
                  >
                    Verify OTP & Sign In
                  </ActionButton>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthStep(1);
                        setError('');
                      }}
                      className="text-xs text-slate-500 hover:text-emerald-700 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Station & Credentials</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <Link
                  to="/"
                  className="text-xs text-slate-500 hover:text-emerald-600 font-medium inline-flex items-center gap-1"
                >
                  <span>← Return to Citizen Farmer Portal</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
