import React, { useState, useEffect } from 'react';
import { AlertOctagon, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import ActionButton from './ActionButton';

const DEFAULT_REASONS = [
  { id: 'MOISTURE_EXCEEDS_LIMIT', label: 'Moisture Exceeds 14% Limit' },
  { id: 'FOREIGN_MATTER_HIGH', label: 'Foreign Matter > 2% Admixture' },
  { id: 'WEIGHT_MISMATCH', label: 'Gross/Tare Scale Discrepancy' },
  { id: 'ANPR_PLATE_MISMATCH', label: 'Vehicle ANPR Plate Discrepancy' },
  { id: 'AADHAAR_KYC_FAILED', label: 'Farmer KYC / Bank Discrepancy' },
  { id: 'GATE_EXIT_HOLD', label: 'Gate Exit Security Review' },
  { id: 'OTHER', label: 'Other Operational Exception' },
];

/**
 * ExceptionReasonModal - Shared modal for raising APMC discrepancy exceptions and supervisor override rationale.
 */
export const ExceptionReasonModal = ({
  isOpen = false,
  onClose,
  onSubmit,
  title = 'Raise Operational Exception',
  subtitle = 'Log formal discrepancy details for supervisor review and audit trail.',
  token = null,
  reasons = DEFAULT_REASONS,
  isLoading = false,
  submitLabel = 'Submit to Supervisor Desk',
  confirmVariant = 'destructive',
}) => {
  const [selectedReason, setSelectedReason] = useState(reasons[0]?.id || 'OTHER');
  const [notes, setNotes] = useState('');
  const [severity, setSeverity] = useState('HIGH'); // 'NORMAL' | 'HIGH' | 'CRITICAL'
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(reasons[0]?.id || 'OTHER');
      setNotes('');
      setSeverity('HIGH');
      setError('');
    }
  }, [isOpen, reasons]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError('Please provide a specific explanation for this exception.');
      return;
    }
    setError('');
    const reasonObj = reasons.find((r) => r.id === selectedReason);
    onSubmit({
      reasonCode: selectedReason,
      reasonLabel: reasonObj ? reasonObj.label : selectedReason,
      notes: notes.trim(),
      severity,
      tokenId: token?.id || token?.tokenId,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-500/20">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Token Context Strip */}
        {token && (
          <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-700">
            <span className="font-semibold">
              Token: <span className="text-slate-900 font-mono font-bold">#{token.tokenNumber || token.id}</span>
            </span>
            <span>
              Farmer: <span className="font-semibold">{token.farmerName || 'Registered Farmer'}</span>
            </span>
            {token.vehicleNumber && (
              <span>
                Vehicle: <span className="font-mono font-semibold">{token.vehicleNumber}</span>
              </span>
            )}
          </div>
        )}

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Preset Reason Chips */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Select Discrepancy Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {reasons.map((r) => {
                const isSelected = selectedReason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReason(r.id)}
                    className={`text-left text-xs p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50/70 text-rose-950 font-semibold ring-1 ring-rose-500/30'
                        : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      <span className="truncate">{r.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity Radio */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Severity Level
            </label>
            <div className="flex gap-2">
              {[
                { id: 'NORMAL', label: 'Standard Flag', bg: 'hover:bg-slate-100' },
                { id: 'HIGH', label: 'High Priority', bg: 'hover:bg-amber-50' },
                { id: 'CRITICAL', label: 'Critical / Hold Vehicle', bg: 'hover:bg-rose-50' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSeverity(s.id)}
                  className={`flex-1 text-xs py-1.5 px-2 rounded-lg border text-center transition-all ${
                    severity === s.id
                      ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                      : `border-slate-200 text-slate-600 ${s.bg}`
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Operator Observations & Audit Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (error) setError('');
              }}
              placeholder="Detail the exact readings, physical observations, or supervisor directions..."
              className="w-full text-xs sm:text-sm p-3 border border-slate-300 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-colors"
            />
            {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <ActionButton
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </ActionButton>
            <ActionButton
              type="submit"
              variant={confirmVariant}
              size="md"
              isLoading={isLoading}
              loadingText="Logging Exception..."
              icon={ShieldAlert}
            >
              {submitLabel}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExceptionReasonModal;
