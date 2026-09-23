import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Clock,
  AlertTriangle,
  MapPin,
  Edit3,
  PlusCircle,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import FarmerLandDetailsModal from './FarmerLandDetailsModal';

export default function FarmerLandDetailsCard({
  landRecord = null,
  lang = 'en',
  onLandUpdated = () => {},
  className = ''
}) {
  const [showEditModal, setShowEditModal] = useState(false);

  const hasLand = Boolean(
    landRecord &&
    typeof landRecord.areaAcres === 'number' &&
    landRecord.areaAcres > 0
  );

  const status = landRecord?.verificationStatus || 'pending';

  // Status mapping
  const statusConfig = {
    verified: {
      label: lang === 'mr' ? 'पडताळणी पूर्ण (Verified)' : lang === 'hi' ? 'सत्यापित (Verified)' : 'Verified',
      chipClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      icon: ShieldCheck,
      iconClass: 'text-emerald-700'
    },
    rejected: {
      label: lang === 'mr' ? 'नाकारले (Rejected)' : lang === 'hi' ? 'अस्वीकृत (Rejected)' : 'Rejected',
      chipClass: 'bg-rose-100 text-rose-900 border-rose-300',
      icon: AlertTriangle,
      iconClass: 'text-rose-700'
    },
    pending: {
      label: lang === 'mr' ? 'स्वयं-घोषित, पडताळणी प्रलंबित' : lang === 'hi' ? 'स्व-घोषित, सत्यापन लंबित' : 'Self-declared, pending verification',
      chipClass: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: Clock,
      iconClass: 'text-amber-700'
    }
  };

  const currentStatus = statusConfig[status] || statusConfig.pending;
  const StatusIcon = currentStatus.icon;

  // Translations
  const t = {
    cardTitle: lang === 'mr' ? 'नोंदणीकृत शेतजमीन (७/१२ तपशील)' : lang === 'hi' ? 'पंजीकृत भूमि (7/12 विवरण)' : 'Registered Land (7/12 Details)',
    missingTitle: lang === 'mr' ? 'शेतजमिनीचा तपशील नोंदवा' : lang === 'hi' ? 'भूमि का विवरण जोड़ें' : 'Add Your Land Details',
    missingSubtitle: lang === 'mr'
      ? 'अंदाजित उत्पादन तपासणी व मोंढा जलद चेक-इनसाठी आपला ७/१२ तपशील जोडा.'
      : lang === 'hi'
      ? 'अनुमानित उपज सत्यापन और त्वरित चेक-इन के लिए अपना 7/12 विवरण जोड़ें।'
      : 'Add your 7/12 land details to verify yield estimates and expedite mandi intake.',
    addBtn: lang === 'mr' ? 'जमीन तपशील जोडा' : lang === 'hi' ? 'विवरण जोड़ें' : 'Add Land Details',
    editBtn: lang === 'mr' ? 'बदला' : lang === 'hi' ? 'संपादित करें' : 'Edit',
    surveyLabel: lang === 'mr' ? 'सर्व्हे / गट क्र.' : lang === 'hi' ? 'सर्वे / गट सं.' : 'Survey / Gat No.',
    areaLabel: lang === 'mr' ? 'घोषित क्षेत्र' : lang === 'hi' ? 'घोषित क्षेत्रफल' : 'Declared Area',
    locationLabel: lang === 'mr' ? 'गाव / तालुका' : lang === 'hi' ? 'गांव / तालुका' : 'Location',
    ownershipLabel: lang === 'mr' ? 'मालकी' : lang === 'hi' ? 'स्वामित्व' : 'Ownership',
    owner: lang === 'mr' ? 'स्वतः मालक' : lang === 'hi' ? 'स्वयं स्वामी' : 'Owner',
    co_owner: lang === 'mr' ? 'सह-मालक' : lang === 'hi' ? 'सह-स्वामी' : 'Co-Owner',
    tenant: lang === 'mr' ? 'कुळ / बटाईदार' : lang === 'hi' ? 'बटाईदार' : 'Tenant',
    family_holding: lang === 'mr' ? 'कौटुंबिक सामाईक' : lang === 'hi' ? 'पारिवारिक' : 'Family Holding',
    verifiedByLabel: lang === 'mr' ? 'पडताळणी अधिकारी:' : lang === 'hi' ? 'सत्यापन अधिकारी:' : 'Verified By:',
    rejectionReasonLabel: lang === 'mr' ? 'नकारण्याचे कारण:' : lang === 'hi' ? 'अस्वीकृति कारण:' : 'Rejection Reason:',
    ruleBasedNotice: lang === 'mr'
      ? 'उत्पादन अंदाज नियम-आधारित (Rule-Based) असून गृहीत धरलेल्या (Assumed) सरासरीवर काढला जातो.'
      : lang === 'hi'
      ? 'उपज अनुमान नियम-आधारित (Rule-Based) और अनुमानित (Assumed) औसत पर आधारित है।'
      : 'Yield estimates are rule-based and calculated using assumed crop averages.'
  };

  const ownershipText = t[landRecord?.ownershipType] || t.owner;

  // Render Missing Land Reminder Card
  if (!hasLand) {
    return (
      <>
        <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-400/40 text-left shadow-xs ${className}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>{t.missingTitle}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Non-blocking
                  </span>
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 max-w-lg">{t.missingSubtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.addBtn}</span>
            </button>
          </div>
        </div>

        <FarmerLandDetailsModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          initialData={landRecord}
          lang={lang}
          onSaved={(newRec) => {
            onLandUpdated(newRec);
            setShowEditModal(false);
          }}
        />
      </>
    );
  }

  // Render Full Land Details Card
  return (
    <>
      <div className={`bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs text-left ${className}`}>
        {/* Header with Title and Verification Chip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">{t.cardTitle}</h4>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5">
                <span>{landRecord.village || 'Village'}, {landRecord.taluka || landRecord.district || 'Maharashtra'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Verification Status Chip */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${currentStatus.chipClass}`}
            >
              <StatusIcon className={`w-3.5 h-3.5 ${currentStatus.iconClass}`} />
              <span>{currentStatus.label}</span>
            </span>

            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title={t.editBtn}
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Land Attributes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              {t.areaLabel}
            </span>
            <div className="font-mono font-bold text-slate-900 text-sm">
              {landRecord.areaAcres} <span className="text-xs font-medium text-slate-600">Acres</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              {t.surveyLabel}
            </span>
            <div className="font-mono font-bold text-slate-900 text-sm truncate">
              {landRecord.surveyNumber || landRecord.gatNumber || '—'}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              {t.ownershipLabel}
            </span>
            <div className="font-bold text-slate-900 text-xs truncate">
              {ownershipText}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              {t.locationLabel}
            </span>
            <div className="font-medium text-slate-900 text-xs truncate">
              {landRecord.village || '—'}
            </div>
          </div>
        </div>

        {/* Extra Audit Notes if Verified or Rejected */}
        {status === 'verified' && landRecord.verifiedBy && (
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between mt-1">
            <span className="font-semibold">{t.verifiedByLabel} {landRecord.verifiedBy}</span>
            {landRecord.verifiedAt && (
              <span className="text-[10px] text-emerald-700">
                {new Date(landRecord.verifiedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {status === 'rejected' && landRecord.rejectionReason && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 mt-1">
            <strong>{t.rejectionReasonLabel}</strong> {landRecord.rejectionReason}
          </div>
        )}

        {/* Subtitle note on Rule-Based yield calculation */}
        <div className="pt-2 text-[10px] text-slate-500 flex items-center gap-1">
          <Info className="w-3 h-3 text-slate-400 shrink-0" />
          <span>{t.ruleBasedNotice}</span>
        </div>
      </div>

      <FarmerLandDetailsModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialData={landRecord}
        lang={lang}
        onSaved={(newRec) => {
          onLandUpdated(newRec);
          setShowEditModal(false);
        }}
      />
    </>
  );
}
