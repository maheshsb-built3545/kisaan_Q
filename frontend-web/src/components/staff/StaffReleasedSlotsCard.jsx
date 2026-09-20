import React, { useState, useEffect } from 'react';
import { History, Clock, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { staffWaitlistApi } from '../../api/waitlist.api';

export default function StaffReleasedSlotsCard({ centreId }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchOffers = async () => {
    if (!centreId) return;
    try {
      setLoading(true);
      const res = await staffWaitlistApi.getOffers({ centreId });
      if (res?.success) {
        setOffers(res.data?.offers || []);
      }
    } catch (err) {
      console.warn('Offers fetch:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
    const interval = setInterval(fetchOffers, 15000);
    return () => clearInterval(interval);
  }, [centreId]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-white text-base">Released Slots & Waitlist Reallocations</h3>
        </div>
        {loading && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
      </div>

      {offers.length === 0 ? (
        <div className="mt-4 p-4 bg-slate-800/40 rounded-lg text-slate-400 text-xs">
          No slots currently released or reallocated at this centre.
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {offers.slice(0, 8).map((o) => (
            <div key={o._id} className="bg-slate-800/70 border border-slate-700/60 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-amber-400 font-semibold">{o.releasedTokenNumber || 'Auto-Released Slot'}</span>
                  <span className={`px-2 py-0.5 rounded font-medium text-[10px] ${
                    o.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-300' :
                    o.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300' :
                    o.status === 'DECLINED' ? 'bg-slate-700 text-slate-300' :
                    'bg-rose-500/20 text-rose-300'
                  }`}>
                    {o.status}
                  </span>
                </div>
                <p className="text-slate-400 mt-1">
                  Reallocated to: <strong className="text-white">{o.farmerName}</strong> ({o.farmerPhone}) • {o.crop} ({o.quantity} Qtl) • {o.slotTime}
                </p>
              </div>

              {o.createdTokenNumber && (
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Confirmed New Token:</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">{o.createdTokenNumber}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
