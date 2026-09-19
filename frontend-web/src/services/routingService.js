/**
 * KisanQ Live Geolocation & Dynamic "Leave-By" Departure Recommendation Engine
 * Powered by Open Source Routing Machine (OSRM) Public Routing API with Haversine Fallback.
 */

// Master Coordinates for Mandis in Nashik / Ahilyanagar / Chhatrapati Sambhajinagar APMC Region
export const APMC_COORDINATES = {
  'KPG-01': { lat: 19.8370, lng: 74.4829, name: 'APMC Kopargaon', mrName: 'कोपरगाव कृषी उत्पन्न बाजार समिती', city: 'Kopargaon', district: 'Ahilyanagar' },
  'SRD-02': { lat: 19.7668, lng: 74.4754, name: 'APMC Shirdi', mrName: 'कृषी उत्पन्न बाजार समिती शिर्डी', city: 'Shirdi', district: 'Ahilyanagar' },
  'RHT-03': { lat: 19.7171, lng: 74.4800, name: 'APMC Rahata', mrName: 'कृषी उत्पन्न बाजार समिती राहाता', city: 'Rahata', district: 'Ahilyanagar' },
  'VJP-04': { lat: 19.9489, lng: 74.8332, name: 'APMC Vaijapur', mrName: 'कृषी उत्पन्न बाजार समिती वैजापूर', city: 'Vaijapur', district: 'Chhatrapati Sambhajinagar' },
  'SRP-05': { lat: 19.6420, lng: 74.7007, name: 'APMC Shrirampur', mrName: 'कृषी उत्पन्न बाजार समिती श्रीरामपूर', city: 'Shrirampur', district: 'Ahilyanagar' },
  'LSG-06': { lat: 20.1427, lng: 74.2378, name: 'APMC Lasalgaon', mrName: 'कृषी उत्पन्न बाजार समिती लासलगाव', city: 'Lasalgaon', district: 'Nashik' },
  'YLA-07': { lat: 20.0429, lng: 74.4880, name: 'APMC Yeola', mrName: 'कृषी उत्पन्न बाजार समिती येवला', city: 'Yeola', district: 'Nashik' },
  'SGM-08': { lat: 19.4906, lng: 74.2467, name: 'APMC Sangamner', mrName: 'कृषी उत्पन्न बाजार समिती संगमनेर', city: 'Sangamner', district: 'Ahilyanagar' },
  'NPD-09': { lat: 20.0797, lng: 74.1071, name: 'APMC Niphad', mrName: 'कृषी उत्पन्न बाजार समिती निफाड', city: 'Niphad', district: 'Nashik' },
};

// Default fallback coordinates: Kopargaon rural farmer origin
export const DEFAULT_FARMER_COORDINATES = {
  lat: 19.8370,
  lng: 74.4829,
  address: 'कोपरगाव, Ahilyanagar District, Maharashtra, India',
  isLive: false,
};


/**
 * Acquire farmer coordinates using browser's native navigator.geolocation.
 * Falls back gracefully to Kopargaon coordinates if permission denied or unavailable.
 */
export function getFarmerCoordinates() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('[Geolocation] Browser does not support geolocation, using Kopargaon fallback.');
      return resolve({ ...DEFAULT_FARMER_COORDINATES });
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          address: 'Live GPS Location',
          isLive: true,
        });
      },
      (error) => {
        console.debug('[Geolocation] Location request skipped or denied:', error.message);
        resolve({ ...DEFAULT_FARMER_COORDINATES });
      },
      {
        enableHighAccuracy: true,
        timeout: 4000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Calculate straight-line distance in kilometres using Haversine formula
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fallback transit calculation using Haversine distance and assumed 25 km/h rural transport speed
 */
export function calculateHaversineFallback(farmerLat, farmerLng, mandiLat, mandiLng, speedKmh = 25) {
  const straightLineKm = haversineDistanceKm(farmerLat, farmerLng, mandiLat, mandiLng);
  // Apply a 1.25x road curvature factor for rural Maharashtra roads
  const roadKm = Math.max(1.0, straightLineKm * 1.25);
  const durationMins = Math.max(2, Math.round((roadKm / speedKmh) * 60));

  return {
    distanceKm: roadKm.toFixed(1),
    durationMins,
    source: 'Haversine Fallback (25 km/h)',
    isOsrm: false,
  };
}

/**
 * Query OSRM's public routing endpoint (no API key required)
 * Endpoint: https://router.project-osrm.org/route/v1/driving/{farmerLng},{farmerLat};{mandiLng},{mandiLat}?overview=false
 * Note: OSRM expects coordinates in longitude,latitude order.
 */
export async function fetchOsrmRoute(farmerLng, farmerLat, mandiLng, mandiLat) {
  const fLng = Number(farmerLng) || DEFAULT_FARMER_COORDINATES.lng;
  const fLat = Number(farmerLat) || DEFAULT_FARMER_COORDINATES.lat;
  const mLng = Number(mandiLng);
  const mLat = Number(mandiLat);

  const url = `https://router.project-osrm.org/route/v1/driving/${fLng},${fLat};${mLng},${mLat}?overview=false`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) {
      throw new Error(`OSRM response status: ${res.status}`);
    }
    const data = await res.json();
    if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const distanceKm = (primaryRoute.distance / 1000).toFixed(1);
      const durationMins = Math.max(1, Math.round(primaryRoute.duration / 60));

      return {
        distanceKm,
        durationMins,
        source: 'OSRM Live Road Network',
        isOsrm: true,
      };
    }
  } catch (err) {
    console.debug('[OSRM Routing] Public router timeout/error, using Haversine fallback:', err.message);
  }

  // Graceful fallback to Haversine rural transit model
  return calculateHaversineFallback(fLat, fLng, mLat, mLng, 25);
}

/**
 * Calculate dynamic real-time road transit duration to a specific mandi
 */
export async function calculateRealTimeTravel({
  origin = DEFAULT_FARMER_COORDINATES,
  mandiId = 'KPG-01',
}) {
  const dest = APMC_COORDINATES[mandiId] || APMC_COORDINATES['KPG-01'];
  const farmerLat = origin?.lat || DEFAULT_FARMER_COORDINATES.lat;
  const farmerLng = origin?.lng || DEFAULT_FARMER_COORDINATES.lng;

  return fetchOsrmRoute(farmerLng, farmerLat, dest.lng, dest.lat);
}

/**
 * Multi-Mandi Distance Matrix Update:
 * Calculates real driving distances and transit times from the farmer's location to all 5 mandis.
 */
export async function calculateAllMandiDistances(origin = DEFAULT_FARMER_COORDINATES) {
  const farmerLat = origin?.lat || DEFAULT_FARMER_COORDINATES.lat;
  const farmerLng = origin?.lng || DEFAULT_FARMER_COORDINATES.lng;

  const entries = Object.entries(APMC_COORDINATES);
  const matrix = {};

  await Promise.all(
    entries.map(async ([mandiId, mandiCoord]) => {
      const result = await fetchOsrmRoute(farmerLng, farmerLat, mandiCoord.lng, mandiCoord.lat);
      matrix[mandiId] = result;
    })
  );

  return matrix;
}

/**
 * Format a Date object into 12-hour AM/PM string, e.g. "08:45 AM"
 */
export function formatClockTime(date) {
  if (!date || isNaN(date.getTime())) return '08:45 AM';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

import { TOKEN_STATUS, normalizeStatus } from '../utils/statusEnums.js';

/**
 * Core Dynamic "Leave-By" Recommendation Logic
 * 
 * Formula:
 *   T_turn  = Scheduled gate slot start time + queue delay based on full token date/time
 *   D_travel = Real-time driving duration from OSRM
 *   B_buffer = 15-minute standard intake buffer
 *   T_leave  = T_turn - (D_travel + B_buffer)
 *   ΔT       = T_leave - T_now
 * 
 * State Conditions:
 *   - Gate-Exit-Requested -> Terminal banner: "Gate Exit In Review"
 *   - Cancelled / Completed -> Terminal state banner
 *   - In Yard (Stage >= 1) -> "Inside Mandi Yard"
 *   - ΔT < 0 & Pre-gate -> Red badge: "SLOT EXPIRED / OVERDUE"
 *   - ΔT >= 0 -> Accurate countdown: "Depart in X mins"
 */
export function calculateLeaveBy({
  token,
  travelDurationMins = 15,
  bufferMins = 15,
  isOsrm = true,
}) {
  const now = new Date();
  const normStatus = normalizeStatus(token?.status);
  const queuePos = Number(token?.queuePosition) || 1;
  const stages = Array.isArray(token?.stages) ? token.stages : [];
  const completedStages = stages.filter((s) => (s?.status || '').toLowerCase() === 'completed').length;
  const isGateInDone = completedStages >= 1 || (token?.status || '').toUpperCase() === 'GATE_IN';

  // 1. Handle Terminal / Special States First
  if (normStatus === TOKEN_STATUS.GATE_EXIT_REQUESTED) {
    return {
      urgency: {
        badge: 'EXIT_REVIEW',
        label: 'Gate Exit In Review',
        color: 'amber',
        bg: 'bg-amber-50 text-amber-900 border-amber-300 ring-amber-400/30',
        dot: 'bg-amber-500 animate-pulse',
        headline: 'Exit Request In Review',
        statusText: 'Gate Officer reviewing vehicle exit. Boom barrier will open upon authorization.',
      },
      displayText: 'Gate exit requested. Waiting for Security Officer clearance.',
      travelDurationMins: Number(travelDurationMins),
      turnTimeFormatted: 'Exit In Review',
      leaveTimeFormatted: 'Exit In Review',
      windowMins: 0,
      isExpired: false,
      isTerminal: true,
    };
  }

  if (normStatus === TOKEN_STATUS.CANCELLED) {
    return {
      urgency: {
        badge: 'CANCELLED',
        label: 'Booking Cancelled',
        color: 'rose',
        bg: 'bg-rose-50 text-rose-800 border-rose-300 ring-rose-400/20',
        dot: 'bg-rose-500',
        headline: 'Slot Cancelled',
        statusText: 'This slot was cancelled. Single-active-token lock has been lifted.',
      },
      displayText: 'Booking cancelled. You may book a new slot anytime.',
      travelDurationMins: Number(travelDurationMins),
      turnTimeFormatted: 'Cancelled',
      leaveTimeFormatted: 'Cancelled',
      windowMins: 0,
      isExpired: false,
      isTerminal: true,
    };
  }

  if (normStatus === TOKEN_STATUS.COMPLETED) {
    return {
      urgency: {
        badge: 'COMPLETED',
        label: 'Delivery Completed',
        color: 'emerald',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-emerald-400/20',
        dot: 'bg-emerald-500',
        headline: 'Settlement Completed',
        statusText: 'Produce weighed, PO authorized, and DBT payout disbursed.',
      },
      displayText: 'Procurement lifecycle completed.',
      travelDurationMins: Number(travelDurationMins),
      turnTimeFormatted: 'Completed',
      leaveTimeFormatted: 'Completed',
      windowMins: 0,
      isExpired: false,
      isTerminal: true,
    };
  }

  if (isGateInDone) {
    return {
      urgency: {
        badge: 'IN_YARD',
        label: 'Inside Mandi Yard',
        color: 'emerald',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-emerald-400/20',
        dot: 'bg-emerald-500 animate-pulse',
        headline: 'Vehicle In Yard',
        statusText: 'Vehicle passed Gate Check-In. Proceeding through physical checkpoints.',
      },
      displayText: 'Vehicle currently undergoing APMC intake inspection.',
      travelDurationMins: Number(travelDurationMins),
      turnTimeFormatted: 'In Yard',
      leaveTimeFormatted: 'Checked In',
      windowMins: 0,
      isExpired: false,
      isTerminal: false,
    };
  }

  // 2. Parse Scheduled Date & Slot Start Time using full date context
  let targetDate = new Date();
  const slotDateStr = token?.slotDate;

  if (slotDateStr && slotDateStr !== 'Today') {
    const parsed = new Date(slotDateStr);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  } else if (token?.createdAt) {
    const created = new Date(token.createdAt);
    if (!isNaN(created.getTime())) {
      targetDate = new Date(created);
    }
  }

  const slotStr = token?.slotTime || token?.slotLabel || '08:00 – 11:00 AM';
  const timeMatch = slotStr.match(/(\d{1,2}):(\d{2})/);
  let slotHour = 8;
  let slotMin = 0;

  if (timeMatch) {
    slotHour = parseInt(timeMatch[1], 10);
    slotMin = parseInt(timeMatch[2], 10);
    const isPM = slotStr.toUpperCase().includes('PM') && slotHour < 12;
    if (isPM) slotHour += 12;
  }

  targetDate.setHours(slotHour, slotMin, 0, 0);

  // Turn time includes slot start + queue progression delay (8 mins per vehicle ahead)
  const turnDate = new Date(targetDate.getTime() + Math.max(0, queuePos - 1) * 8 * 60 * 1000);

  // Recommended Departure Deadline: T_leave = T_turn - (D_travel + 15 mins buffer)
  const totalOffsetMins = Number(travelDurationMins || 15) + Number(bufferMins || 15);
  const leaveDate = new Date(turnDate.getTime() - totalOffsetMins * 60 * 1000);

  // Calculate Delta T (Minutes until recommended departure)
  const windowMins = Math.round((leaveDate.getTime() - now.getTime()) / (60 * 1000));

  const turnTimeFormatted = formatClockTime(turnDate);
  const leaveTimeFormatted = formatClockTime(leaveDate);
  const providerLabel = isOsrm ? 'via OSRM' : 'Est.';

  // 3. Determine Urgency & Expiration
  let urgency;
  let displayText;

  if (windowMins < -15) {
    // Past slot window
    const overdueMins = Math.abs(windowMins);
    urgency = {
      badge: 'EXPIRED',
      label: 'SLOT EXPIRED / OVERDUE',
      color: 'rose',
      bg: 'bg-rose-50 text-rose-900 border-rose-300 ring-rose-400/30',
      dot: 'bg-rose-500 animate-ping',
      headline: overdueMins > 120 ? 'Slot Window Expired' : `Overdue by ${overdueMins}m`,
      statusText: 'Scheduled departure deadline has passed. Proceed to Gate Desk for intake review.',
    };
    displayText = overdueMins > 120
      ? `Slot date (${token?.slotDate || 'Past date'}) has expired.`
      : `Departure overdue by ${overdueMins} mins. Depart immediately!`;
  } else if (windowMins <= 0) {
    urgency = {
      badge: 'RED',
      label: 'Depart Immediately',
      color: 'rose',
      bg: 'bg-rose-50 text-rose-800 border-rose-300 ring-rose-400/30',
      dot: 'bg-rose-500 animate-ping',
      headline: windowMins === 0 ? 'Depart Now!' : `Depart Immediately`,
      statusText: 'Gate slot opening shortly. Depart immediately to avoid slot forfeiture.',
    };
    displayText = `Leave home now (${providerLabel} ~${travelDurationMins}m) to reach gate before turn.`;
  } else if (windowMins <= 30) {
    urgency = {
      badge: 'AMBER',
      label: 'Prepare to Depart',
      color: 'amber',
      bg: 'bg-amber-50 text-amber-900 border-amber-300 ring-amber-400/20',
      dot: 'bg-amber-500 animate-pulse',
      headline: `Depart in ${windowMins} mins`,
      statusText: 'Prepare vehicle and load. Head to APMC intake gate shortly.',
    };
    displayText = `Live Road ETA: ${travelDurationMins} mins (${providerLabel}) | Leave Home By: ${leaveTimeFormatted} (in ${windowMins}m)`;
  } else {
    urgency = {
      badge: 'GREEN',
      label: 'On Schedule',
      color: 'emerald',
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-emerald-400/20',
      dot: 'bg-emerald-500',
      headline: `Depart in ${windowMins} mins`,
      statusText: 'Comfortable buffer to reach by your designated weighbridge turn.',
    };
    displayText = `Live Road ETA: ${travelDurationMins} mins (${providerLabel}) | Leave Home By: ${leaveTimeFormatted}`;
  }

  return {
    turnTimeFormatted,
    leaveTimeFormatted,
    travelDurationMins: Number(travelDurationMins),
    bufferMins: Number(bufferMins),
    windowMins,
    urgency,
    displayText,
    isOsrm,
    isExpired: windowMins < -15,
    isTerminal: false,
  };
}
