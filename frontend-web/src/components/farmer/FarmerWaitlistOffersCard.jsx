import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, AlertCircle, ArrowRight, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { waitlistApi } from '../../api';

export default function FarmerWaitlistOffersCard({ phone, onOfferAccepted }) {
  const [data, setData] = useState({ waitlist: [], offers: [] });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [msg, setMsg] = useState(null);

  const fetchWaitlistData = async () => {
    try {
      setLoading(true);
      const res = await waitlistApi.getMyWaitlist();
      if (res?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('Waitlist fetch:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlistData();
    const interval = setInterval(fetchWaitlistData, 15000);
    return () => clearInterval(interval);
  }, [phone]);

  const handleAccept = async (offerId) => {
    try {
      setActionLoading((prev) => ({ ...prev, [offerId]: 'accept' }));
      const res = await waitlistApi.acceptOffer(offerId);
      if (res?.success) {
        setMsg({ type: 'success', text: `Offer accepted! Confirmed Token: ${res.data?.token?.tokenNumber}` });
        fetchWaitlistData();
        if (onOfferAccepted) onOfferAccepted(res.data?.token);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setActionLoading((prev) => ({ ...prev, [offerId]: null }));
    }
  };

  const handleDecline = async (offerId) => {
    try {
      setActionLoading((prev) => ({ ...prev, [offerId]: 'decline' }));
      const res = await waitlistApi.declineOffer(offerId);
      if (res?.success) {
        setMsg({ type: 'info', text: 'Offer declined. Passed to next candidate.' });
        fetchWaitlistData();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setActionLoading((prev) => ({ ...prev, [offerId]: null }));
    }
  };

  if (!phone || (!loading && (!data.offers?.length && !data.waitlist?.length))) {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 shadow-xl mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-white">Live Slot Reallocations & Waitlist (B4)</h3>
        </div>
        {loading && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
      </div>

      {msg && (
        <div className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
          msg.type === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
          'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{msg.text}</span>
        </div>
      )}

      {/* Active Pending Offers */}
      {data.offers && data.offers.length > 0 && (
        <div className="mt-3 space-y-3">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">🎉 Released Slot Offer Available</p>
          {data.offers.map((offer) => {
            const expires = new Date(offer.expiresAt);
            const timeLeftSec = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000));
            const minLeft = Math.floor(timeLeftSec / 60);
            const secLeft = timeLeftSec % 60;

            return (
              <div key={offer._id} className="bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/40 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{offer.mandiName || offer.centreId}</span>
                      <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded font-mono font-medium">
                        {offer.slotTime} ({offer.slotDate})
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1">
                      Crop: <strong className="text-white">{offer.crop}</strong> • Quantity: <strong className="text-white">{offer.quantity} Qtl</strong>
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 mt-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Offer expires in: <strong>{minLeft}m {secLeft < 10 ? `0${secLeft}` : secLeft}s</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <button
                      onClick={() => handleAccept(offer._id)}
                      disabled={actionLoading[offer._id]}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-lg flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
                    >
                      {actionLoading[offer._id] === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Claim Slot</span>
                    </button>
                    <button
                      onClick={() => handleDecline(offer._id)}
                      disabled={actionLoading[offer._id]}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-lg flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                      {actionLoading[offer._id] === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      <span>Pass</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Waitlist Entries */}
      {data.waitlist && data.waitlist.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">My Waitlist Status</p>
          <div className="space-y-2">
            {data.waitlist.map((w) => (
              <div key={w._id} className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-white text-sm">{w.mandiName || w.centreId}</span>
                  <span className="text-slate-400 ml-2">{w.crop} ({w.quantity} Qtl) • {w.requestedSlotTime || '08:00 AM - 11:00 AM'}</span>
                </div>
                <div>
                  <span className={`px-2 py-0.5 rounded font-medium ${
                    w.status === 'WAITING' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    w.status === 'OFFERED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    w.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {w.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
