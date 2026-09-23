/**
 * centreDisplayNames.js
 * 
 * Centralized mapping and lookup utilities for anonymized centre display names
 * (e.g. "Centre A", "Centre B", "Centre C", etc.) while preserving real underlying
 * centreId / mandiId values for all API payloads and backend communications.
 */

export const CENTRE_DISPLAY_MAP = {
  'KPG-01': 'Centre A',
  'MH-KPG-01': 'Centre A',
  'SRD-02': 'Centre B',
  'SHR-01': 'Centre B',
  'MH-SRD-02': 'Centre B',
  'RHT-03': 'Centre C',
  'RHT-01': 'Centre C',
  'RDG-02': 'Centre C',
  'MH-RHT-03': 'Centre C',
  'VJP-04': 'Centre D',
  'VRP-06': 'Centre D',
  'MH-VJP-04': 'Centre D',
  'SRP-05': 'Centre E',
  'MH-SRP-05': 'Centre E',
  'LSG-06': 'Centre F',
  'NSK-01': 'Centre F',
  'MH-LSG-06': 'Centre F',
  'YLA-07': 'Centre G',
  'SGM-08': 'Centre H',
  'NPD-09': 'Centre I',
};

export const MANDI_NAME_MAP = {
  // Kopargaon
  'APMC Kopargaon': 'Centre A',
  'Kopargaon': 'Centre A',
  'कोपरगाव कृषी उत्पन्न बाजार समिती': 'Centre A',
  'कोपरगाव': 'Centre A',

  // Shirdi / Shrirampur-North
  'APMC Shirdi': 'Centre B',
  'Shirdi': 'Centre B',
  'APMC Shirdi Sub-Yard': 'Centre B',
  'शिर्डी उपबाजार समिती': 'Centre B',
  'कृषी उत्पन्न बाजार समिती शिर्डी': 'Centre B',
  'शिर्डी': 'Centre B',

  // Rahata
  'APMC Rahata': 'Centre C',
  'Rahata': 'Centre C',
  'राहाता कृषी उत्पन्न बाजार समिती': 'Centre C',
  'कृषी उत्पन्न बाजार समिती राहाता': 'Centre C',
  'राहाता': 'Centre C',

  // Vaijapur
  'APMC Vaijapur': 'Centre D',
  'Vaijapur': 'Centre D',
  'वैजापूर कृषी उत्पन्न बाजार समिती': 'Centre D',
  'कृषी उत्पन्न बाजार समिती वैजापूर': 'Centre D',
  'वैजापूर': 'Centre D',

  // Shrirampur
  'APMC Shrirampur': 'Centre E',
  'Shrirampur': 'Centre E',
  'श्रीरामपूर कृषी उत्पन्न बाजार समिती': 'Centre E',
  'कृषी उत्पन्न बाजार समिती श्रीरामपूर': 'Centre E',
  'श्रीरामपूर': 'Centre E',

  // Lasalgaon
  'APMC Lasalgaon': 'Centre F',
  'Lasalgaon': 'Centre F',
  'APMC Lasalgaon (Nashik)': 'Centre F',
  'लासलगाव मुख्य बाजार समिती': 'Centre F',
  'लासलगाव मुख्य कांदा बाजार समिती': 'Centre F',
  'कृषी उत्पन्न बाजार समिती लासलगाव': 'Centre F',
  'लासलगाव': 'Centre F',

  // Regional
  'APMC Yeola': 'Centre G',
  'Yeola': 'Centre G',
  'APMC Sangamner': 'Centre H',
  'Sangamner': 'Centre H',
  'APMC Niphad': 'Centre I',
  'Niphad': 'Centre I',
};

/**
 * Look up the anonymized display name for a given centre/mandi identifier or name.
 * 
 * @param {string} identifier - e.g. "KPG-01", "SRD-02", "APMC Kopargaon", etc.
 * @param {string} [fallback] - optional custom fallback if not found
 * @returns {string} e.g. "Centre A", "Centre B", or fallback
 */
export function getCentreDisplayName(identifier, fallback = null) {
  if (!identifier || typeof identifier !== 'string') {
    return fallback || 'Centre';
  }

  const trimmed = identifier.trim();

  // 1. Direct ID lookup (case-insensitive)
  const upper = trimmed.toUpperCase();
  if (CENTRE_DISPLAY_MAP[upper]) {
    return CENTRE_DISPLAY_MAP[upper];
  }

  // 2. Direct Name lookup
  if (MANDI_NAME_MAP[trimmed]) {
    return MANDI_NAME_MAP[trimmed];
  }

  // 3. Normalized name lookup (strip "APMC " prefix if present)
  const withoutApmc = trimmed.replace(/^APMC\s+/i, '').trim();
  if (MANDI_NAME_MAP[withoutApmc]) {
    return MANDI_NAME_MAP[withoutApmc];
  }

  // 4. Substring / Prefix matching for known centre codes
  for (const [code, display] of Object.entries(CENTRE_DISPLAY_MAP)) {
    if (upper.includes(code)) {
      return display;
    }
  }

  // 5. Substring matching for known names
  for (const [name, display] of Object.entries(MANDI_NAME_MAP)) {
    if (trimmed.toLowerCase().includes(name.toLowerCase())) {
      return display;
    }
  }

  return fallback || trimmed;
}

/**
 * Get formatted label with display letter and original code, e.g. "Centre A (KPG-01)"
 */
export function getCentreLabelWithCode(centreId, originalCode = null) {
  const display = getCentreDisplayName(centreId);
  const code = originalCode || centreId;
  return code ? `${display} (${code})` : display;
}
