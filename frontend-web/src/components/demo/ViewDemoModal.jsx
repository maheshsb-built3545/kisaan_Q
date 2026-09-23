import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCentreDisplayName } from '../../config/centreDisplayNames';
import {
  Sparkles, X, User, Building2, ChevronRight, ShieldCheck,
  Scale, FileText, CheckCircle2, ArrowRight, Activity, Award,
  Truck, ShieldAlert, BarChart3, AlertCircle
} from 'lucide-react';

const centreAName = getCentreDisplayName('KPG-01');
const centreCName = getCentreDisplayName('RHT-03');

const FARMER_PERSONAS = [
  {
    key: 'ramesh_kadam',
    name: 'Ramesh Kadam (All-in-One Farmer Persona)',
    badge: 'Confirmed Slot #3 · Flagged Exception · Multi-Mandi Waitlist',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: `Comprehensive operational profile consolidating confirmed slot #3 (KQ-KPG-2026-6285), flagged rule-based yield warning exception, open moisture assaying grievance (CMP-2026-101), multi-mandi waitlist (${centreAName} & ${centreCName}), 1-click released slot offer claim, and AgriPool freight sharing (~160m).`,
    details: 'Soybean · 20.0ac (Verified 7/12) · Village: Kolpewadi · Token: KQ-KPG-2026-6285 · Grievance: CMP-2026-101',
    highlights: [
      'Confirmed Slot #3 with dynamic Leave-By OSRM highway departure timer',
      'Rule-Based Yield Warning exception flagged for supervisor review',
      'Open NIR moisture dispute grievance (CMP-2026-101) pending resolution',
      'Released Slot Offer ready for 1-click claim (KQ-KPG-2026-6279)',
      `Multi-Mandi Waitlist entry active across ${centreAName} & ${centreCName}`,
      'AgriPool load pooling with Sunil Shinde tractor (~160m in Kolpewadi)'
    ],
    icon: Sparkles
  }
];

const STAFF_ROLES = [
  {
    role: 'security_gate',
    desk: 'Desk 1: Security Gate',
    officer: 'Ramesh Shinde (SEC-D1-KPG)',
    description: 'ANPR gate intake, vehicle queue triage, boom barrier control & check-in.',
    icon: Truck
  },
  {
    role: 'quality_assayer',
    desk: 'Desk 2: Assaying Lab',
    officer: 'S. Patil (QA-SP-KPG)',
    description: 'Moisture spectrometer analysis, grade classification & quality sign-off.',
    icon: Award
  },
  {
    role: 'weighmaster',
    desk: 'Desk 3: Weighbridge Scale',
    officer: 'Suresh Jadhav (WM-02-KPG)',
    description: 'Electronic gross & tare weighment, scale telemetry & net weight lock.',
    icon: Scale
  },
  {
    role: 'procurement',
    desk: 'Desk 4: Procurement Desk',
    officer: 'Secretary Deshmukh (SEC-APMC-KPG)',
    description: 'MSP deed verification, lot deed signing & procurement certification.',
    icon: FileText
  },
  {
    role: 'accounts_settlement',
    desk: 'Desk 5: DBT Treasury',
    officer: 'Treasury Officer Kale (TRY-DBT-KPG)',
    description: 'PFMS electronic treasury batch dispatch & direct bank payment advice.',
    icon: CheckCircle2
  },
  {
    role: 'resource_officer',
    desk: 'Resource Planning Officer',
    officer: 'P. Kulkarni (RPO-KPG-01)',
    description: '7-day demand forecasting, inter-mandi resource borrow & quota allocation.',
    icon: BarChart3
  },
  {
    role: 'supervisor',
    desk: 'Mandi Supervisor',
    officer: 'V. Pawar (SUP-KPG-01)',
    description: 'Exception review, anomaly flag overrides, yield check & dispute resolution.',
    icon: ShieldAlert
  },
  {
    role: 'district_admin',
    desk: 'District Administrator',
    officer: 'District Collector Ahilyanagar (DA-AHD-01)',
    description: 'Multi-mandi district operations, load balancing & escalated reviews.',
    icon: Building2
  }
];

export default function ViewDemoModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { demoFarmerLogin, demoStaffLogin } = useAuth();
  const [activeSubView, setActiveSubView] = useState('farmer'); // 'farmer' | 'staff'
  const [loadingKey, setLoadingKey] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleFarmerClick = async (profileKey) => {
    try {
      setLoadingKey(profileKey);
      setErrorMsg('');
      localStorage.setItem('kisanq_lang', 'en');
      const res = await demoFarmerLogin(profileKey);
      const targetPath = res?.data?.landingPath || '/farmer/command-center';
      onClose();
      navigate(targetPath);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Demo farmer login failed';
      setErrorMsg(msg);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleStaffClick = async (roleKey) => {
    try {
      setLoadingKey(roleKey);
      setErrorMsg('');
      localStorage.setItem('kisanq_lang', 'en');
      // Strictly pass role to POST /auth/demo/staff { role }
      const res = await demoStaffLogin(roleKey);
      const targetPath = res?.data?.landingPath || '/admin-dashboard/desk';
      onClose();
      navigate(targetPath);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Demo staff login failed';
      setErrorMsg(msg);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 sm:p-7 relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 font-mono">
              Live Showcase Pilot
            </span>
          </div>

          <h2 id="demo-modal-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Explore KisanQ Demonstration
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Select any persona below to enter the live operational system in 1 click. Zero passwords, OTPs, or setup required.
          </p>

          {/* Sub-view Switcher Tabs */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl mt-5 max-w-md border border-slate-700/60">
            <button
              type="button"
              onClick={() => { setActiveSubView('farmer'); setErrorMsg(''); }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeSubView === 'farmer'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              id="tab-demo-farmer"
            >
              <User className="w-3.5 h-3.5" />
              <span>Farmer Persona (1)</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveSubView('staff'); setErrorMsg(''); }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeSubView === 'staff'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              id="tab-demo-staff"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Mandi Staff Desks (8)</span>
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body: Scrollable Cards Container */}
        <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-4">
          {activeSubView === 'farmer' ? (
            /* ─── Farmer Persona (Consolidated All-in-One Card) ───── */
            <div className="max-w-2xl mx-auto w-full">
              {FARMER_PERSONAS.map((p) => {
                const IconComp = p.icon;
                const isLoading = loadingKey === p.key;
                return (
                  <div
                    key={p.key}
                    onClick={() => !loadingKey && handleFarmerClick(p.key)}
                    className="group bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-500 rounded-3xl p-6 sm:p-7 transition-all shadow-xs hover:shadow-xl flex flex-col justify-between cursor-pointer relative overflow-hidden"
                    id={`card-farmer-${p.key}`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${p.badgeColor}`}>
                          {p.badge}
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-xs">
                          <IconComp className="w-5 h-5" />
                        </div>
                      </div>

                      <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors mb-2">
                        {p.name}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                        {p.description}
                      </p>

                      {/* 6 Key Highlight Pills */}
                      {p.highlights && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                          {p.highlights.map((h, i) => (
                            <div key={i} className="flex items-start gap-2 bg-white/80 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-700">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">{h}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-mono text-slate-500 mb-4 pt-3 border-t border-slate-200/80">
                        {p.details}
                      </p>

                      <button
                        type="button"
                        disabled={isLoading}
                        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-slate-900 to-emerald-950 group-hover:from-emerald-600 group-hover:to-teal-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                      >
                        {isLoading ? (
                          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Launch Farmer Portal</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── Staff Roles (8 Cards) ────────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {STAFF_ROLES.map((s) => {
                const IconComp = s.icon;
                const isLoading = loadingKey === s.role;
                return (
                  <div
                    key={s.role}
                    onClick={() => !loadingKey && handleStaffClick(s.role)}
                    className="group bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-4 transition-all shadow-xs hover:shadow-md flex flex-col justify-between cursor-pointer"
                    id={`card-staff-${s.role}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                          {getCentreDisplayName('KPG-01')}
                        </span>
                        <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {s.desk}
                      </h4>

                      <p className="text-[11px] font-semibold text-emerald-700 mt-0.5 mb-2">
                        {s.officer}
                      </p>

                      <p className="text-xs text-slate-600 leading-snug">
                        {s.description}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                      <span>Enter Desk</span>
                      {isLoading ? (
                        <span className="inline-block w-3.5 h-3.5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer (Guaranteed: Zero Reset Controls) */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Public demonstration mode · All state frozen under DEMO_STATIC_MODE</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
