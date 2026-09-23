import React, { useState, useEffect } from 'react';
import { farmerApi } from '../../api/farmer.api';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';

export default function FarmerLandDetailsModal({
  isOpen,
  onClose,
  initialData = null,
  lang = 'en',
  onSaved = () => {}
}) {
  const [formData, setFormData] = useState({
    surveyNumber: '',
    gatNumber: '',
    village: '',
    taluka: '',
    district: '',
    rawArea: '',
    areaUnit: 'acres', // 'acres' | 'hectares' | 'guntha'
    ownershipType: 'owner',
    ownerNameOn712: '',
    source: 'self'
  });

  const [extractedSnapshot, setExtractedSnapshot] = useState(null);
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Translations dictionary
  const t = {
    title: lang === 'mr' ? 'जमिनीचा तपशील (७/१२ उतारा)' : lang === 'hi' ? 'भूमि विवरण (7/12 खतौनी)' : 'Land Details (7/12 Extract)',
    subtitle: lang === 'mr'
      ? 'आपल्या शेतजमिनीचा अधिकृत तपशील नोंदवा किंवा ७/१२ अपलोड करून माहिती भरा.'
      : lang === 'hi'
      ? 'अपनी कृषि भूमि का विवरण दर्ज करें या 7/12 अपलोड करके भरें।'
      : 'Enter your agricultural land details or upload 7/12 to auto-fill.',
    uploadBtn: lang === 'mr' ? '७/१२ अपलोड करून माहिती भरा' : lang === 'hi' ? '7/12 अपलोड कर स्वतः भरें' : 'Upload 7/12 to Auto-Fill',
    uploadHint: lang === 'mr' ? 'PDF, JPG किंवा PNG (कमाल ५ MB)' : lang === 'hi' ? 'PDF, JPG या PNG (अधिकतम 5 MB)' : 'PDF, JPG or PNG (Max 5 MB)',
    ephemeralNotice: lang === 'mr'
      ? 'आम्ही हे फॉर्म भरण्यासाठी AI सेवेद्वारे तुमचा ७/१२ फक्त एकदा वाचतो. किसानक्यू ही फाईल सेव्ह करत नाही.'
      : lang === 'hi'
      ? 'हम इन फ़ील्ड्स को भरने के लिए AI सेवा द्वारा आपके 7/12 को केवल एक बार पढ़ते हैं। किसानक्यू इस फ़ाइल को सहेजता नहीं है।'
      : 'We read your 7/12 once with an AI service to fill these fields. KisanQ does not keep the file.',
    autoFilledBadge: lang === 'mr' ? '✨ ७/१२ वरून आपोआप भरले — कृपया तपासा' : lang === 'hi' ? '✨ 7/12 से स्वतः भरा गया — कृपया जाँचें' : '✨ Auto-filled from 7/12 — Please review',
    surveyNo: lang === 'mr' ? 'सर्व्हे / गट क्रमांक' : lang === 'hi' ? 'सर्वे / गट संख्या' : 'Survey / Gat Number',
    village: lang === 'mr' ? 'गाव / मौजे' : lang === 'hi' ? 'गांव' : 'Village',
    taluka: lang === 'mr' ? 'तालुका' : lang === 'hi' ? 'तालुका / तहसील' : 'Taluka',
    district: lang === 'mr' ? 'जिल्हा' : lang === 'hi' ? 'ज़िला' : 'District',
    villagePlaceholder: lang === 'mr' ? 'उदा. रामगाव' : lang === 'hi' ? 'उदा. रामगांव' : 'e.g. Ramgaon',
    talukaPlaceholder: lang === 'mr' ? 'उदा. सुंदरपूर' : lang === 'hi' ? 'उदा. सुंदरपुर' : 'e.g. Sundarpur',
    districtPlaceholder: lang === 'mr' ? 'उदा. देवनगर' : lang === 'hi' ? 'उदा. देवनगर' : 'e.g. Devnagar',
    area: lang === 'mr' ? 'जमिनीचे क्षेत्र' : lang === 'hi' ? 'भूमि का क्षेत्रफल' : 'Land Area',
    unitAcres: lang === 'mr' ? 'एकर (Acres)' : lang === 'hi' ? 'एकड़' : 'Acres',
    unitHectares: lang === 'mr' ? 'हेक्टर (Hectares)' : lang === 'hi' ? 'हेक्टेयर' : 'Hectares',
    unitGuntha: lang === 'mr' ? 'गुंठा (Guntha)' : lang === 'hi' ? 'गुंठा' : 'Guntha (Are)',
    calculatedAcres: lang === 'mr' ? 'एकूण एकर:' : lang === 'hi' ? 'कुल एकड़:' : 'Calculated Acres:',
    ownership: lang === 'mr' ? 'मालकी प्रकार' : lang === 'hi' ? 'स्वामित्व प्रकार' : 'Ownership Type',
    owner: lang === 'mr' ? 'स्वतः मालक (Owner)' : lang === 'hi' ? 'स्वयं स्वामी (Owner)' : 'Owner',
    coOwner: lang === 'mr' ? 'सह-मालक (Co-Owner)' : lang === 'hi' ? 'सह-स्वामी (Co-Owner)' : 'Co-Owner',
    tenant: lang === 'mr' ? 'कुळ / बटाईदार (Tenant)' : lang === 'hi' ? 'बटाईदार / किरायेदार (Tenant)' : 'Tenant',
    familyHolding: lang === 'mr' ? 'कौटुंबिक सामाईक (Family Holding)' : lang === 'hi' ? 'पारिवारिक साझा (Family Holding)' : 'Family Holding',
    ownerName: lang === 'mr' ? '७/१२ वरील खातेदाराचे नाव' : lang === 'hi' ? '7/12 पर दर्ज नाम' : 'Owner Name as on 7/12',
    saveBtn: lang === 'mr' ? 'जमिनीचा तपशील जतन करा' : lang === 'hi' ? 'भूमि विवरण सहेजें' : 'Save Land Details',
    saving: lang === 'mr' ? 'जतन करत आहे…' : lang === 'hi' ? 'सहेजा जा रहा है…' : 'Saving…',
    cancel: lang === 'mr' ? 'रद्द करा' : lang === 'hi' ? 'रद्द करें' : 'Cancel'
  };

  useEffect(() => {
    if (initialData) {
      setFormData({
        surveyNumber: initialData.surveyNumber || initialData.gatNumber || '',
        gatNumber: initialData.gatNumber || initialData.surveyNumber || '',
        village: initialData.village || '',
        taluka: initialData.taluka || '',
        district: initialData.district || 'Ahilyanagar',
        rawArea: initialData.areaAcres ? String(initialData.areaAcres) : '',
        areaUnit: 'acres',
        ownershipType: initialData.ownershipType || 'owner',
        ownerNameOn712: initialData.ownerNameOn712 || '',
        source: initialData.source || 'self'
      });
      setIsAutoFilled(initialData.source === 'auto_filled');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Convert rawArea + unit to decimal acres
  const getCalculatedAcres = () => {
    const raw = parseFloat(formData.rawArea);
    if (isNaN(raw) || raw <= 0) return 0;
    if (formData.areaUnit === 'hectares') {
      return Math.round(raw * 2.47105 * 100) / 100;
    }
    if (formData.areaUnit === 'guntha') {
      return Math.round((raw / 40) * 100) / 100;
    }
    return Math.round(raw * 100) / 100;
  };

  // Handle ephemeral 7/12 OCR Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('File size must be under 5 MB.');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMsg('Only PDF, JPG, or PNG files are supported.');
      return;
    }

    try {
      setIsExtracting(true);
      setErrorMsg('');
      const uploadData = new FormData();
      uploadData.append('file', file);

      const response = await farmerApi.extractLandRecord(uploadData);
      const suggestions = response.data?.suggestions || response.suggestions || {};

      const snapshot = {
        surveyNumber: suggestions.surveyNumber || suggestions.gatNumber || '',
        gatNumber: suggestions.gatNumber || suggestions.surveyNumber || '',
        village: suggestions.village || '',
        taluka: suggestions.taluka || '',
        district: (suggestions.district || 'Ahilyanagar').replace(/Ahmednagar/i, 'Ahilyanagar'),
        rawArea: suggestions.areaAcres ? String(suggestions.areaAcres) : '',
        ownershipType: suggestions.ownershipType || 'owner',
        ownerNameOn712: suggestions.ownerNameOn712 || ''
      };

      setExtractedSnapshot(snapshot);

      setFormData((prev) => ({
        ...prev,
        surveyNumber: snapshot.surveyNumber || prev.surveyNumber,
        gatNumber: snapshot.gatNumber || prev.gatNumber,
        village: snapshot.village || prev.village,
        taluka: snapshot.taluka || prev.taluka,
        district: snapshot.district || prev.district,
        rawArea: snapshot.rawArea || prev.rawArea,
        areaUnit: 'acres',
        ownershipType: snapshot.ownershipType || prev.ownershipType,
        ownerNameOn712: snapshot.ownerNameOn712 || prev.ownerNameOn712,
        source: 'auto_filled'
      }));

      setIsAutoFilled(true);
      setSuccessMsg('7/12 read successfully. Suggestions filled — please verify details.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.warn('[7/12 Extract] Extraction notice:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Could not auto-extract fields. Please fill manually.');
    } finally {
      setIsExtracting(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const areaAcres = getCalculatedAcres();
    if (areaAcres <= 0) {
      setErrorMsg('Please enter a valid land area greater than 0.');
      return;
    }

    if (!formData.surveyNumber.trim() && !formData.gatNumber.trim()) {
      setErrorMsg('Survey or Gat number is required.');
      return;
    }

    // Source is auto_filled ONLY if farmer confirms extracted values without editing them
    let finalSource = 'self';
    if (isAutoFilled && extractedSnapshot) {
      const isUnchanged = (
        formData.surveyNumber.trim() === extractedSnapshot.surveyNumber.trim() &&
        formData.village.trim() === extractedSnapshot.village.trim() &&
        formData.taluka.trim() === extractedSnapshot.taluka.trim() &&
        formData.rawArea.trim() === extractedSnapshot.rawArea.trim() &&
        formData.ownershipType === extractedSnapshot.ownershipType &&
        formData.ownerNameOn712.trim() === extractedSnapshot.ownerNameOn712.trim()
      );
      if (isUnchanged) {
        finalSource = 'auto_filled';
      }
    }

    try {
      setIsSubmitting(true);
      const payload = {
        surveyNumber: formData.surveyNumber.trim(),
        gatNumber: formData.gatNumber.trim() || formData.surveyNumber.trim(),
        village: formData.village.trim(),
        taluka: formData.taluka.trim(),
        district: (formData.district.trim() || 'Ahilyanagar').replace(/Ahmednagar/i, 'Ahilyanagar'),
        areaAcres,
        ownershipType: formData.ownershipType,
        ownerNameOn712: formData.ownerNameOn712.trim(),
        source: finalSource
      };

      const res = await farmerApi.updateLandRecord(payload);
      const updatedRecord = res.data?.landRecord || res.landRecord || payload;

      onSaved(updatedRecord);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update land details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedAcres = getCalculatedAcres();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-7 text-left my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">{t.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7/12 Ephemeral Upload Section */}
        <div className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border border-emerald-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>{t.uploadBtn}</span>
              </div>
              <p className="text-[11px] text-emerald-800/90 mt-0.5">{t.uploadHint}</p>
            </div>

            <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0">
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Reading 7/12…</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Choose 7/12 File</span>
                </>
              )}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                disabled={isExtracting}
                className="hidden"
              />
            </label>
          </div>

          {/* Strict Ephemeral Privacy Disclaimer */}
          <div className="mt-2.5 pt-2 border-t border-emerald-200/60 flex items-center gap-1.5 text-[11px] text-emerald-900 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>{t.ephemeralNotice}</span>
          </div>
        </div>

        {/* Auto-filled Badge Notice */}
        {isAutoFilled && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t.autoFilledBadge}</span>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950">
              Auto-filled
            </span>
          </div>
        )}

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          {/* Row 1: Survey/Gat Number & Ownership Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                {t.surveyNo} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.surveyNumber}
                onChange={(e) => setFormData({ ...formData, surveyNumber: e.target.value, gatNumber: e.target.value })}
                placeholder="उदा. 142/2 किंवा गट क्र. 88"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                {t.ownership} <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.ownershipType}
                onChange={(e) => setFormData({ ...formData, ownershipType: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-xs font-medium"
              >
                <option value="owner">{t.owner}</option>
                <option value="co_owner">{t.coOwner}</option>
                <option value="tenant">{t.tenant}</option>
                <option value="family_holding">{t.familyHolding}</option>
              </select>
            </div>
          </div>

          {/* Row 2: Land Area with Unit Selector */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[10px]">
              {t.area} <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-7">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.rawArea}
                  onChange={(e) => setFormData({ ...formData, rawArea: e.target.value })}
                  placeholder="उदा. 4.5"
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-5">
                <select
                  value={formData.areaUnit}
                  onChange={(e) => setFormData({ ...formData, areaUnit: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs"
                >
                  <option value="acres">{t.unitAcres}</option>
                  <option value="hectares">{t.unitHectares}</option>
                  <option value="guntha">{t.unitGuntha}</option>
                </select>
              </div>
            </div>

            {/* Live Calculation Display */}
            {calculatedAcres > 0 && formData.areaUnit !== 'acres' && (
              <div className="mt-2 text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{t.calculatedAcres} <strong className="font-mono text-emerald-950">{calculatedAcres} Acres</strong></span>
              </div>
            )}
          </div>

          {/* Row 3: Village, Taluka, District */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                {t.village}
              </label>
              <input
                type="text"
                value={formData.village}
                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                placeholder={t.villagePlaceholder || 'e.g. Ramgaon'}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                {t.taluka}
              </label>
              <input
                type="text"
                value={formData.taluka}
                onChange={(e) => setFormData({ ...formData, taluka: e.target.value })}
                placeholder={t.talukaPlaceholder || 'e.g. Sundarpur'}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                {t.district}
              </label>
              <input
                type="text"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                placeholder={t.districtPlaceholder || 'e.g. Devnagar'}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 text-xs"
              />
            </div>
          </div>

          {/* Row 4: Owner Name as on 7/12 */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
              {t.ownerName}
            </label>
            <input
              type="text"
              value={formData.ownerNameOn712}
              onChange={(e) => setFormData({ ...formData, ownerNameOn712: e.target.value })}
              placeholder="उदा. रमेश विठ्ठल कदम"
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 text-xs font-medium"
            />
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.saving}</span>
                </>
              ) : (
                <span>{t.saveBtn}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
