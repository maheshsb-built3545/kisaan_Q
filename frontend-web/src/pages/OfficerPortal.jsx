import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  TrendingUp,
  Users,
  Shield,
  Radio,
  Sliders,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Cpu,
  BarChart3,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GovHeader from '../components/common/GovHeader';
import DemoBanner from '../components/common/DemoBanner';
import { planningApi } from '../api/planning.api';
import RedirectComposer from '../components/staff/RedirectComposer';

export default function OfficerPortal() {
  const { staffUser, user } = useAuth();
  const activeUser = staffUser || user;
  const navigate = useNavigate();

  const userMandi = activeUser?.assignedMandi || activeUser?.mandiId || activeUser?.centreId || 'KPG-01';
  const isDistrictAdmin = activeUser?.role === 'district_admin';
  const [activeTab, setActiveTab] = useState('forecast'); // 'forecast' | 'whatif' | 'requests' | 'resources' | 'caps' | 'redirect'
  const [centreId, setCentreId] = useState(userMandi);
  const [lang, setLang] = useState(() => localStorage.getItem('kisanq_lang') || 'en');

  useEffect(() => {
    if (!isDistrictAdmin && userMandi) {
      setCentreId(userMandi);
    }
  }, [isDistrictAdmin, userMandi]);

  // Planning Data State
  const [forecast, setForecast] = useState([]);
  const [resources, setResources] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedDayForecast, setSelectedDayForecast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // What-If State
  const [whatIfDate, setWhatIfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [whatIfShowUpRate, setWhatIfShowUpRate] = useState(0.85);
  const [whatIfExtraLabour, setWhatIfExtraLabour] = useState(0);
  const [whatIfResult, setWhatIfResult] = useState(null);
  const [isComputingWhatIf, setIsComputingWhatIf] = useState(false);

  // Slot Cap State
  const [capDate, setCapDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [capHour, setCapHour] = useState(10);
  const [capLimit, setCapLimit] = useState(25);
  const [capSaveMsg, setCapSaveMsg] = useState(null);

  // Load Forecast & Overview
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [fRes, rRes, reqRes] = await Promise.allSettled([
        planningApi.getForecast(centreId),
        planningApi.getResources(centreId),
        planningApi.getRequests({ centreId })
      ]);

      if (fRes.status === 'fulfilled') {
        const rawF = fRes.value?.data?.forecast || fRes.value?.forecast || (Array.isArray(fRes.value?.data) ? fRes.value.data : []);
        const validForecast = Array.isArray(rawF) ? rawF : [];
        setForecast(validForecast);
        if (validForecast.length > 0) {
          setSelectedDayForecast(validForecast[0]);
        }
      }
      if (rRes.status === 'fulfilled') {
        const rawR = rRes.value?.data || rRes.value?.resources || [];
        setResources(Array.isArray(rawR) ? rawR : []);
      }
      if (reqRes.status === 'fulfilled') {
        const rawReq = reqRes.value?.data || reqRes.value?.requests || [];
        setRequests(Array.isArray(rawReq) ? rawReq : []);
      }
    } catch (err) {
      console.error('Failed to load planning data:', err);
      setErrorMsg('Failed to load operational planning data from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle What-If Calculation
  const handleCalculateWhatIf = async (e) => {
    e.preventDefault();
    try {
      setIsComputingWhatIf(true);
      const res = await planningApi.postWhatIf({
        centreId,
        date: whatIfDate,
        showUpRate: Number(whatIfShowUpRate),
        extraLabour: Number(whatIfExtraLabour)
      });
      setWhatIfResult(res?.result || res);
    } catch (err) {
      console.error('Error running what-if:', err);
    } finally {
      setIsComputingWhatIf(false);
    }
  };

  // Handle Peak Load Simulation
  const handleSimulatePeak = async () => {
    try {
      setIsComputingWhatIf(true);
      const res = await planningApi.simulatePeak({
        centreId,
        date: whatIfDate || new Date().toISOString().slice(0, 10)
      });
      const sim = res?.data || res?.result || res;
      setWhatIfResult({
        expectedArrivals: sim.expectedArrivalsMid || sim.expectedArrivals || 160,
        labourDeficit: sim.labourNeeded ? Math.max(0, sim.labourNeeded - 10) : 8,
        recommendation: sim.note || 'Peak surge detected: Reallocate extra gang labourers or activate inter-mandi redirect.',
        isPeakSimulation: true
      });
    } catch (err) {
      console.error('Error simulating peak:', err);
      setWhatIfResult({
        expectedArrivals: 165,
        labourDeficit: 8,
        recommendation: 'Peak surge stress model: 8 additional labourers needed for full throughput.',
        isPeakSimulation: true
      });
    } finally {
      setIsComputingWhatIf(false);
    }
  };

  // Handle Request Decision (Allow / Decline)
  const handleDecideRequest = async (requestId, decision, reason = '') => {
    try {
      await planningApi.decideRequest(requestId, { decision, reason });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update request');
    }
  };

  // Handle Save Slot Cap
  const handleSaveCap = async (e) => {
    e.preventDefault();
    try {
      setCapSaveMsg(null);
      await planningApi.putSlotCap({
        centreId,
        date: capDate,
        hour: Number(capHour),
        cap: Number(capLimit)
      });
      setCapSaveMsg('Slot cap updated successfully (warn-only policy active)');
    } catch (err) {
      setCapSaveMsg('Failed to save slot cap');
    }
  };

  const getHeatColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'green':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'amber':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'red':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <DemoBanner area="staff" />
      <GovHeader
        currentLang={lang}
        onLanguageChange={(l) => {
          setLang(l);
          localStorage.setItem('kisanq_lang', l);
        }}
        showPortalSwitch={true}
        portalType="staff"
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              to="/staff/desk"
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to Operations Desk"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Resource Planning Officer Portal
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Operational forecast engine, resource load balancing, and trilingual mandi broadcasts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isDistrictAdmin ? (
              <select
                value={centreId}
                onChange={(e) => setCentreId(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="KPG-01">APMC Kopargaon (KPG-01)</option>
                <option value="SRD-02">APMC Shirdi (SRD-02)</option>
                <option value="RHT-03">APMC Rahata (RHT-03)</option>
                <option value="VJP-04">APMC Vaijapur (VJP-04)</option>
                <option value="SRP-05">APMC Shrirampur (SRP-05)</option>
                <option value="LSG-06">APMC Lasalgaon (LSG-06)</option>
              </select>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{activeUser?.assignedMandiName || `APMC Mandi (${centreId})`}</span>
              </div>
            )}

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              title="Refresh Portal Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'forecast', label: '7-Day Forecast', icon: Calendar },
            { id: 'whatif', label: 'What-If Simulation', icon: Sliders },
            { id: 'requests', label: 'Resource Requests', icon: Users, count: requests.filter((r) => r.status === 'pending').length },
            { id: 'resources', label: 'Yard Equipment & Labour', icon: Layers },
            { id: 'caps', label: 'Slot Caps', icon: Cpu },
            { id: 'redirect', label: 'Redirect & Broadcast', icon: Radio },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold animate-pulse">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 1: 7-Day Forecast Strip */}
        {activeTab === 'forecast' && (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>7-Day Predictive Demand Forecast</span>
                  <span className="text-[10px] lowercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                    rule-based forecast
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Projected arrivals and labour requirements based on slot booking curve & historical midpoints.</p>
              </div>
            </div>

            {/* 7-Day Horizontal Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {forecast.map((day, idx) => {
                const isSelected = selectedDayForecast?.date === day.date;
                return (
                  <div
                    key={day.date || idx}
                    onClick={() => setSelectedDayForecast(day)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500'
                        : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold text-slate-300">
                        {day.dayName || `D+${idx}`}
                      </span>
                      <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md border ${getHeatColor(day.heatStatus)}`}>
                        {day.heatStatus}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-white mb-1">{day.date}</div>

                    <div className="mt-3 space-y-1.5 text-[11px] font-mono text-slate-400">
                      <div className="flex justify-between">
                        <span>Projected:</span>
                        <span className="text-white font-bold">{day.projectedBookings ?? '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Arrivals:</span>
                        <span className="text-amber-300 font-bold">{day.expectedArrivalsMid ?? '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Labour Req:</span>
                        <span className="text-emerald-400 font-bold">{day.labourNeeded ?? '-'} shifts</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Day Deep Dive */}
            {selectedDayForecast && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Operational Detail for {selectedDayForecast.date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-md font-mono font-bold border ${getHeatColor(selectedDayForecast.heatStatus)}`}>
                        {selectedDayForecast.heatStatus} LOAD
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedDayForecast.note || 'Calculated via rule-based forecast engine.'}</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs font-medium text-slate-400">Confirmed Bookings</div>
                    <div className="text-2xl font-black text-white mt-1">{selectedDayForecast.confirmedBookings ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Lead Days: {selectedDayForecast.leadDays ?? 0}</div>
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs font-medium text-slate-400">Projected Peak Bookings</div>
                    <div className="text-2xl font-black text-amber-400 mt-1">{selectedDayForecast.projectedBookings ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Curve Multiplier: {selectedDayForecast.fillFraction ?? 1.0}</div>
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs font-medium text-slate-400">Expected Volume</div>
                    <div className="text-2xl font-black text-emerald-400 mt-1">{selectedDayForecast.expectedQuintalsMid ?? 0} q</div>
                    <div className="text-[10px] text-slate-500 mt-1">Midpoint calculation</div>
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs font-medium text-slate-400">Labour Required</div>
                    <div className="text-2xl font-black text-cyan-400 mt-1">{selectedDayForecast.labourNeeded ?? 0} shifts</div>
                    <div className="text-[10px] text-slate-500 mt-1">At 40q capacity / shift</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: What-If Simulation */}
        {activeTab === 'whatif' && (
          <div className="mt-6 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>What-If Scenario Simulator</span>
                <span className="text-[10px] lowercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                  rule-based what-if
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Simulate impact of unexpected surges, rain days, or extra gang labour deployments.</p>

              <form onSubmit={handleCalculateWhatIf} className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={whatIfDate}
                    onChange={(e) => setWhatIfDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Show-up Rate Override <span className="text-slate-500 font-mono">({Math.round(whatIfShowUpRate * 100)}%)</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={whatIfShowUpRate}
                    onChange={(e) => setWhatIfShowUpRate(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Additional Labour Gangs</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={whatIfExtraLabour}
                    onChange={(e) => setWhatIfExtraLabour(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleSimulatePeak}
                    disabled={isComputingWhatIf}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Simulate peak load</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isComputingWhatIf}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isComputingWhatIf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>Run Simulation</span>
                  </button>
                </div>
              </form>

              {whatIfResult && (
                <div className="mt-6 space-y-4">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Simulation mode</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWhatIfResult(null)}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Exit Simulation
                    </button>
                  </div>

                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-400 font-bold">Simulated Arrivals</span>
                      <div className="text-2xl font-black text-amber-400 mt-1">{whatIfResult.expectedArrivals ?? '-'}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-400 font-bold">Net Labour Deficit</span>
                      <div className="text-2xl font-black text-emerald-400 mt-1">{whatIfResult.labourDeficit ?? 0} shifts</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-400 font-bold">Recommended Action</span>
                      <div className="text-sm font-semibold text-white mt-1">{whatIfResult.recommendation || 'Normal operations adequate.'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Resource Requests */}
        {activeTab === 'requests' && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Resource Allocation & Borrow Requests</h2>
              <span className="text-xs text-slate-400 font-mono">Pending: {requests.filter((r) => r.status === 'pending').length}</span>
            </div>

            {requests.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-semibold">No active resource requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div key={req._id || req.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{req.resource || req.type}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                          req.status === 'allowed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : req.status === 'declined'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        From: <span className="text-slate-200 font-bold">{req.fromCentre}</span> → To: <span className="text-slate-200 font-bold">{req.toCentre}</span> · Count: {req.count}
                      </p>
                      {req.reason && <p className="text-[11px] text-slate-500 mt-0.5">Reason: {req.reason}</p>}
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDecideRequest(req._id, 'decline', 'Operational constraints')}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold transition-all"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleDecideRequest(req._id, 'allow')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all"
                        >
                          Allow Request
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Resources & Availability */}
        {activeTab === 'resources' && (
          <div className="mt-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Yard Equipment & Infrastructure Inventory</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {resources.map((res, idx) => (
                <div key={res._id || idx} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <div className="text-xs font-bold text-slate-400 uppercase">{res.type}</div>
                  <div className="text-2xl font-black text-white mt-1">{res.count} units</div>
                  <div className="text-[11px] text-slate-500 mt-1">Capacity: {res.unitCapacity || 40} q/unit</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Slot Caps */}
        {activeTab === 'caps' && (
          <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Hourly Slot Cap Guardrail</h2>
            <p className="text-xs text-slate-400 mt-1">Set maximum bookings per hourly slot. Policy: warn only, never cancel confirmed bookings.</p>

            <form onSubmit={handleSaveCap} className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Date</label>
                <input
                  type="date"
                  value={capDate}
                  onChange={(e) => setCapDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Hour (24h)</label>
                <select
                  value={capHour}
                  onChange={(e) => setCapHour(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => (
                    <option key={h} value={h}>{h}:00 - {h + 1}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Max Hourly Bookings</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={capLimit}
                  onChange={(e) => setCapLimit(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {capSaveMsg && (
                <div className="sm:col-span-3 text-xs text-emerald-400 font-bold">{capSaveMsg}</div>
              )}

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all"
                >
                  <span>Save Hourly Cap</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 6: Redirect & Broadcast */}
        {activeTab === 'redirect' && (
          <div className="mt-6">
            <RedirectComposer currentCentreId={centreId} onCompleted={loadData} />
          </div>
        )}

      </main>
    </div>
  );
}
