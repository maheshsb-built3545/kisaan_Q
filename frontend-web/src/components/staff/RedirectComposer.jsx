import React, { useState } from 'react';
import { Send, Radio, Shield, AlertCircle, CheckCircle, RefreshCw, Users, MapPin } from 'lucide-react';
import { redirectApi } from '../../api/redirect.api';

export default function RedirectComposer({ currentCentreId = 'KPG-01', onCompleted }) {
  const [activeTab, setActiveTab] = useState('redirect'); // 'redirect' | 'quota' | 'broadcast'

  // Redirect State
  const [toCentre, setToCentre] = useState('RDG-02');
  const [redirectDate, setRedirectDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeWindow, setTimeWindow] = useState('10:00 - 12:00');
  const [maxFarmers, setMaxFarmers] = useState(10);
  const [isSubmittingRedirect, setIsSubmittingRedirect] = useState(false);
  const [redirectResult, setRedirectResult] = useState(null);

  // Inbound Quota State
  const [quotaDate, setQuotaDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quotaHour, setQuotaHour] = useState(10);
  const [quotaCount, setQuotaCount] = useState(5);
  const [isSubmittingQuota, setIsSubmittingQuota] = useState(false);
  const [quotaResult, setQuotaResult] = useState(null);

  // Broadcast State
  const [broadcastTextEn, setBroadcastTextEn] = useState('');
  const [broadcastTextHi, setBroadcastTextHi] = useState('');
  const [broadcastTextMr, setBroadcastTextMr] = useState('');
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  const handleProposeRedirect = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingRedirect(true);
      setRedirectResult(null);
      const res = await redirectApi.proposeRedirect({
        fromCentre: currentCentreId,
        toCentre,
        date: redirectDate,
        timeWindow,
        maxOffers: Number(maxFarmers)
      });
      setRedirectResult({ success: true, message: `Redirect proposal created! Offers sent: ${res?.offersSent || 0}` });
      if (onCompleted) onCompleted();
    } catch (err) {
      setRedirectResult({ success: false, message: err.response?.data?.message || err.message || 'Failed to propose redirect' });
    } finally {
      setIsSubmittingRedirect(false);
    }
  };

  const handleSetQuota = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingQuota(true);
      setQuotaResult(null);
      const res = await redirectApi.setInboundQuota({
        centreId: currentCentreId,
        date: quotaDate,
        hour: Number(quotaHour),
        count: Number(quotaCount)
      });
      setQuotaResult({ success: true, message: `Inbound quota updated to ${res?.quota?.count || quotaCount} slots!` });
      if (onCompleted) onCompleted();
    } catch (err) {
      setQuotaResult({ success: false, message: err.response?.data?.message || err.message || 'Failed to set quota' });
    } finally {
      setIsSubmittingQuota(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingBroadcast(true);
      setBroadcastResult(null);
      const res = await redirectApi.sendBroadcast({
        centreId: currentCentreId,
        text: {
          en: broadcastTextEn || 'Operational update from Mandi',
          hi: broadcastTextHi || broadcastTextEn || 'मंडी से आवश्यक सूचना',
          mr: broadcastTextMr || broadcastTextEn || 'मार्केट यार्डकडून महत्त्वाची सूचना'
        }
      });
      setBroadcastResult({ success: true, message: `Broadcast broadcasted to ${res?.notifiedCount || 0} active farmers!` });
      setBroadcastTextEn('');
      setBroadcastTextHi('');
      setBroadcastTextMr('');
      if (onCompleted) onCompleted();
    } catch (err) {
      setBroadcastResult({ success: false, message: err.response?.data?.message || err.message || 'Failed to send broadcast' });
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Redirect & Broadcast Operations
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Rule-Based
              </span>
            </h2>
            <p className="text-xs text-slate-400">Manage multi-mandi load redirects, inbound quotas, and trilingual broadcasts.</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('redirect')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'redirect' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Redirect Offer
          </button>
          <button
            onClick={() => setActiveTab('quota')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'quota' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Inbound Quota
          </button>
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'broadcast' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Broadcast
          </button>
        </div>
      </div>

      {/* Tab: Propose Redirect */}
      {activeTab === 'redirect' && (
        <form onSubmit={handleProposeRedirect} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Source Mandi</label>
              <input
                type="text"
                disabled
                value={currentCentreId}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Alternate Mandi</label>
              <select
                value={toCentre}
                onChange={(e) => setToCentre(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="RDG-02">Rahata (RDG-02) — 14 km</option>
                <option value="SNM-03">Sangamner (SNM-03) — 28 km</option>
                <option value="SNR-04">Sinnar (SNR-04) — 38 km</option>
                <option value="YVL-05">Yeola (YVL-05) — 26 km</option>
                <option value="VRP-06">Vaijapur (VRP-06) — 32 km</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Date</label>
              <input
                type="date"
                value={redirectDate}
                onChange={(e) => setRedirectDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Max Farmer Offers</label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxFarmers}
                onChange={(e) => setMaxFarmers(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {redirectResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              redirectResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              {redirectResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{redirectResult.message}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmittingRedirect}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSubmittingRedirect ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Propose & Send Redirect Offers</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab: Inbound Quota */}
      {activeTab === 'quota' && (
        <form onSubmit={handleSetQuota} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Date</label>
              <input
                type="date"
                value={quotaDate}
                onChange={(e) => setQuotaDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Hour of Day (24h)</label>
              <select
                value={quotaHour}
                onChange={(e) => setQuotaHour(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => (
                  <option key={h} value={h}>{h}:00 - {h + 1}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Inbound Quota Capacity</label>
              <input
                type="number"
                min="0"
                max="100"
                value={quotaCount}
                onChange={(e) => setQuotaCount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {quotaResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              quotaResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              {quotaResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{quotaResult.message}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmittingQuota}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSubmittingQuota ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              <span>Save Inbound Quota</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab: Trilingual Broadcast */}
      {activeTab === 'broadcast' && (
        <form onSubmit={handleSendBroadcast} className="mt-4 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                English Message <span className="text-slate-500 font-mono">(required)</span>
              </label>
              <input
                type="text"
                value={broadcastTextEn}
                onChange={(e) => setBroadcastTextEn(e.target.value)}
                placeholder="e.g. Tomorrow market opens at 7:00 AM due to peak arrivals."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Hindi Message <span className="text-slate-500 font-mono">(optional)</span>
              </label>
              <input
                type="text"
                value={broadcastTextHi}
                onChange={(e) => setBroadcastTextHi(e.target.value)}
                placeholder="उदा. भारी आवक के कारण कल मंडी सुबह 7:00 बजे खुलेगी।"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Marathi Message <span className="text-slate-500 font-mono">(optional)</span>
              </label>
              <input
                type="text"
                value={broadcastTextMr}
                onChange={(e) => setBroadcastTextMr(e.target.value)}
                placeholder="उदा. उद्या जास्त आवक असल्यामुळे बाजार समिती सकाळी 7:00 वाजता उघडेल."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {broadcastResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              broadcastResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              {broadcastResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{broadcastResult.message}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmittingBroadcast}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSubmittingBroadcast ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              <span>Send Trilingual Broadcast</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
