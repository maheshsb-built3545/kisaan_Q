import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Search,
  Crosshair,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Navigation,
  Sparkles,
  Info,
  Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { centresApi } from '../../api/centres.api';
import { haversineDistanceKm } from '../../services/routingService';

// Default Maharashtra / Kopargaon region coordinates
const DEFAULT_CENTER = { lat: 19.8370, lng: 74.4829, address: 'कोपरगाव, Ahilyanagar District, Maharashtra, India' };

// Reference 6 Official APMC Centres fallback with verified coordinates
const DEFAULT_APMC_CENTRES = [
  { code: 'KPG-01', name: 'APMC Kopargaon', nameMarathi: 'कोपरगाव कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar', lat: 19.8370, lng: 74.4829 },
  { code: 'SRD-02', name: 'APMC Shirdi', nameMarathi: 'शिर्डी कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar', lat: 19.7668, lng: 74.4754 },
  { code: 'RHT-03', name: 'APMC Rahata', nameMarathi: 'राहाता कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar', lat: 19.7171, lng: 74.4800 },
  { code: 'VJP-04', name: 'APMC Vaijapur', nameMarathi: 'वैजापूर कृषी उत्पन्न बाजार समिती', district: 'Chhatrapati Sambhajinagar', lat: 19.9489, lng: 74.8332 },
  { code: 'SRP-05', name: 'APMC Shrirampur', nameMarathi: 'श्रीरामपूर कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar', lat: 19.6420, lng: 74.7007 },
  { code: 'LSG-06', name: 'APMC Lasalgaon', nameMarathi: 'लासलगाव कांदा बाजार समिती', district: 'Nashik', lat: 20.1427, lng: 74.2378 }
];

// Custom HTML pin icon for crystal-clear SVG rendering in Vite without asset path issues
const createCustomPinIcon = () => {
  return L.divIcon({
    className: 'kisanq-custom-map-pin',
    html: `
      <div style="position: relative; width: 40px; height: 40px; transform: translate(-20px, -40px); filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35)); cursor: grab;">
        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #10b981 0%, #047857 100%); border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center;">
          <div style="width: 14px; height: 14px; background: #ffffff; border-radius: 50%; transform: rotate(45deg); box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);"></div>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

// Distinct APMC Centre marker icon (blue badge with building icon, non-draggable)
const createCentreMarkerIcon = (code = '') => {
  const shortCode = code.replace('APMC ', '').split('-')[0] || 'APMC';
  return L.divIcon({
    className: 'kisanq-centre-map-marker',
    html: `
      <div style="position: relative; width: 34px; height: 34px; transform: translate(-17px, -17px); filter: drop-shadow(0 3px 5px rgba(0,0,0,0.35)); cursor: pointer;">
        <div style="width: 34px; height: 34px; background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%); border: 2.5px solid #ffffff; border-radius: 9px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ffffff; box-shadow: inset 0 1px 2px rgba(255,255,255,0.3);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
            <path d="M10 6h4"/>
            <path d="M10 10h4"/>
            <path d="M10 14h4"/>
            <path d="M10 18h4"/>
          </svg>
          <span style="font-size: 7.5px; font-weight: 800; line-height: 1; margin-top: 1px; letter-spacing: -0.2px;">${shortCode}</span>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
};

// Formatter for Centre Popup showing English + Marathi Name, District, and Live Distance
const formatCentrePopup = (centre, farmerCoords) => {
  const cLat = centre.location?.coordinates ? Number(centre.location.coordinates[1]) : Number(centre.lat);
  const cLng = centre.location?.coordinates ? Number(centre.location.coordinates[0]) : Number(centre.lng);

  let distText = 'Calculating...';
  if (farmerCoords?.lat && farmerCoords?.lng && !isNaN(cLat) && !isNaN(cLng)) {
    const dKm = haversineDistanceKm(Number(farmerCoords.lat), Number(farmerCoords.lng), cLat, cLng);
    distText = `${dKm.toFixed(1)} km`;
  }

  const enName = centre.name || `APMC ${centre.code || 'Mandi'}`;
  const mrName = centre.nameMarathi || centre.mrName || '';
  const distName = centre.district || centre.locationName || 'Ahilyanagar';
  const code = centre.code || 'APMC';

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; padding: 2px; min-width: 210px; color: #0f172a;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe;">
          🏛️ ${code}
        </span>
        <span style="font-size: 10px; color: #059669; font-weight: 700; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">
          APMC Reference
        </span>
      </div>
      <div style="font-weight: 800; font-size: 13px; color: #0f172a; line-height: 1.25;">
        ${enName}
      </div>
      ${mrName ? `<div style="font-size: 11px; font-weight: 600; color: #475569; margin-top: 2px;">${mrName}</div>` : ''}
      <div style="font-size: 11px; color: #64748b; margin-top: 5px; display: flex; align-items: center; gap: 4px;">
        📍 <span>${distName.includes('District') ? distName : `${distName} District`}</span>
      </div>
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 11px; color: #64748b; font-weight: 600;">Distance to pin:</span>
        <span style="font-size: 12px; font-weight: 800; color: #047857; background: #f0fdf4; padding: 1px 6px; border-radius: 4px; border: 1px solid #bbf7d0;">
          ${distText}
        </span>
      </div>
    </div>
  `;
};

/**
 * PickupLocationPicker Component
 * Interactive Leaflet Map modal with OSM Nominatim Village Search & Draggable Marker.
 * No API keys required.
 */
export default function PickupLocationPicker({
  isOpen = true,
  onClose,
  onConfirm,
  initialCoords = null,
}) {
  const { user, updateFarmerPickupLocation } = useAuth();

  const [selectedCoords, setSelectedCoords] = useState(() => {
    if (initialCoords && initialCoords.lat && initialCoords.lng) {
      return { lat: Number(initialCoords.lat), lng: Number(initialCoords.lng), address: initialCoords.address || '' };
    }
    if (user?.pickupLocation?.coordinates?.length === 2) {
      return {
        lat: Number(user?.pickupLocation?.coordinates?.[1]),
        lng: Number(user?.pickupLocation?.coordinates?.[0]),
        address: user?.pickupLocation?.address || 'Saved Farm Pickup Location'
      };
    }
    return DEFAULT_CENTER;
  });

  const [centres, setCentres] = useState(DEFAULT_APMC_CENTRES);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [locationAddress, setLocationAddress] = useState(selectedCoords.address || 'Kopargaon Farm Location');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const centreMarkersRef = useRef([]);
  const searchDebounceTimerRef = useRef(null);

  // Fetch real centre data from existing backend API
  useEffect(() => {
    let isMounted = true;
    async function loadCentres() {
      try {
        const res = await centresApi.getAllCentres();
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (isMounted && list.length > 0) {
          setCentres(list);
        }
      } catch (err) {
        console.warn('[PickupLocationPicker] Using default APMC centre coordinates', err.message);
        if (isMounted) {
          setCentres(DEFAULT_APMC_CENTRES);
        }
      }
    }
    loadCentres();
    return () => { isMounted = false; };
  }, []);

  // Ref to always access current farmer coordinates synchronously
  const selectedCoordsRef = useRef(selectedCoords);
  useEffect(() => {
    selectedCoordsRef.current = selectedCoords;
  }, [selectedCoords]);

  // Helper to live-update all centre marker popups with latest distance
  const updateAllCentrePopups = useCallback((currentFarmerCoords) => {
    const coords = currentFarmerCoords || (markerRef.current ? markerRef.current.getLatLng() : selectedCoordsRef.current);
    centreMarkersRef.current.forEach(({ marker, centre }) => {
      if (marker) {
        marker.setPopupContent(formatCentrePopup(centre, coords));
      }
    });
  }, []);

  // Synchronize centre reference markers onto the existing map instance without map rebuilds
  const syncCentreMarkers = useCallback((map, centresList) => {
    if (!map) return;

    // Remove previously-added centre markers only
    centreMarkersRef.current.forEach(({ marker }) => {
      if (marker) marker.remove();
    });
    centreMarkersRef.current = [];

    const currentCoords = markerRef.current ? markerRef.current.getLatLng() : selectedCoordsRef.current;

    centresList.forEach((centre) => {
      const cLat = centre.location?.coordinates ? Number(centre.location.coordinates[1]) : Number(centre.lat);
      const cLng = centre.location?.coordinates ? Number(centre.location.coordinates[0]) : Number(centre.lng);
      if (isNaN(cLat) || isNaN(cLng)) return;

      const cIcon = createCentreMarkerIcon(centre.code || centre.name);
      const cMarker = L.marker([cLat, cLng], {
        icon: cIcon,
        draggable: false,
        interactive: true,
        title: `${centre.name} (${centre.nameMarathi || ''})`,
      }).addTo(map);

      cMarker.bindPopup(formatCentrePopup(centre, currentCoords), {
        closeButton: true,
        className: 'kisanq-apmc-centre-popup',
        offset: [0, -12],
      });

      centreMarkersRef.current.push({ marker: cMarker, centre });
    });
  }, []);

  // 1. Map & Farmer Draggable Pin initialization (Created once, NEVER torn down when centres change)
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Destroy existing map on full modal close/open
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }

    const initialLat = selectedCoords.lat || DEFAULT_CENTER.lat;
    const initialLng = selectedCoords.lng || DEFAULT_CENTER.lng;

    // Zoom level 11 displays the 2-3 nearest APMC centres (Kopargaon, Shirdi, Rahata) alongside starting pin
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 11,
      zoomControl: false,
    });

    // Add Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap Tile Layer (Free, no API key required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Create draggable farmer marker
    const pinIcon = createCustomPinIcon();
    const marker = L.marker([initialLat, initialLng], {
      icon: pinIcon,
      draggable: true,
      autoPan: true,
      zIndexOffset: 1000,
    }).addTo(map);

    // Listen for marker drag events with live distance recalculation
    marker.on('drag', () => {
      const position = marker.getLatLng();
      const liveCoords = { lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) };
      updateAllCentrePopups(liveCoords);
    });

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      const updated = {
        lat: Number(position.lat.toFixed(6)),
        lng: Number(position.lng.toFixed(6)),
        address: `Custom Farm Pin (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`
      };
      setSelectedCoords(updated);
      updateAllCentrePopups(updated);
      reverseGeocode(position.lat, position.lng);
    });

    // Listen for map clicks to move marker
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      const updated = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        address: `Selected Farm Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      };
      setSelectedCoords(updated);
      updateAllCentrePopups(updated);
      reverseGeocode(lat, lng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    // Initial mount of centre markers
    syncCentreMarkers(map, centres);

    // Force map redraw to prevent grey tiles in modal transitions
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  // 2. Separate Effect for Centre Reference Markers (Updates markers on EXISTING map without map teardown)
  useEffect(() => {
    if (mapInstanceRef.current) {
      syncCentreMarkers(mapInstanceRef.current, centres);
    }

    return () => {
      centreMarkersRef.current.forEach(({ marker }) => {
        if (marker) marker.remove();
      });
      centreMarkersRef.current = [];
    };
  }, [centres, syncCentreMarkers]);

  // Reverse Geocoding with OSM Nominatim (Debounced & with descriptive User-Agent)
  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'KisanQ-PickupLocationPicker/1.0 (contact@kisanq.gov.in)',
          'Accept-Language': 'en,mr,hi'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const parts = data.display_name.split(',');
          const shortAddress = parts.slice(0, 3).join(',').trim();
          setLocationAddress(shortAddress || data.display_name);
          setSelectedCoords((prev) => ({ ...prev, address: shortAddress || data.display_name }));
        }
      }
    } catch {
      // Gracefully retain current coordinates display if reverse geocode is slow/fails
    }
  }, []);

  // Debounced search with OSM Nominatim (min 1 second between requests, restricted to India)
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setErrorMessage('');

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceTimerRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=6&q=${encodeURIComponent(query.trim())}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'KisanQ-PickupLocationPicker/1.0 (contact@kisanq.gov.in)',
            'Accept-Language': 'en,mr,hi'
          }
        });

        if (!res.ok) {
          throw new Error('Search rate limit or network error');
        }

        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn('[Nominatim Search]', err.message);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 1000); // 1-second debounce enforced per Nominatim policy
  };

  // Select place from search suggestions
  const handleSelectSearchResult = (result) => {
    const lat = Number(parseFloat(result.lat).toFixed(6));
    const lng = Number(parseFloat(result.lon).toFixed(6));
    const address = result.display_name.split(',').slice(0, 3).join(',').trim() || result.display_name;

    const updated = { lat, lng, address };
    setSelectedCoords(updated);
    updateAllCentrePopups(updated);
    setLocationAddress(address);
    setSearchResults([]);
    setSearchQuery('');

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([lat, lng], 14, { animate: true });
      markerRef.current.setLatLng([lat, lng]);
    }
  };

  // Acquire farmer device GPS
  const handleUseDeviceGps = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Device GPS is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setErrorMessage('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const gpsAddress = 'Current Device GPS Location';

        const updated = { lat, lng, address: gpsAddress };
        setSelectedCoords(updated);
        updateAllCentrePopups(updated);
        setLocationAddress(gpsAddress);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 15, { animate: true });
          markerRef.current.setLatLng([lat, lng]);
        }
        reverseGeocode(lat, lng);
      },
      (error) => {
        setIsLocating(false);
        setErrorMessage(`GPS error: ${error.message}. Please click directly on the map or search your village.`);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  // Quick Preset Selection (Maharashtra APMC Hubs)
  const handleSelectPreset = (preset) => {
    const address = preset.fullAddress || `${preset.mrName || preset.name}, Maharashtra`;
    const updated = { lat: preset.lat, lng: preset.lng, address };
    setSelectedCoords(updated);
    updateAllCentrePopups(updated);
    setLocationAddress(address);
    setErrorMessage('');

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([preset.lat, preset.lng], 14, { animate: true });
      markerRef.current.setLatLng([preset.lat, preset.lng]);
    }
  };

  // Submit and save pickup location
  const handleConfirmLocation = async () => {
    if (!selectedCoords.lat || !selectedCoords.lng) {
      setErrorMessage('Please select a valid location on the map.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const payload = {
        latitude: selectedCoords.lat,
        longitude: selectedCoords.lng,
        address: locationAddress || selectedCoords.address || 'Farmer Pickup Origin',
        phone: user?.phone
      };

      await updateFarmerPickupLocation(payload);
      setSuccessMessage('Pickup location saved successfully!');

      setTimeout(() => {
        if (onConfirm) {
          onConfirm({
            lat: selectedCoords.lat,
            lng: selectedCoords.lng,
            address: payload.address,
            pickupLocation: {
              type: 'Point',
              coordinates: [selectedCoords.lng, selectedCoords.lat],
              address: payload.address
            }
          });
        }
      }, 500);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save pickup location. Please try again.');
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const PRESETS = [
    { name: 'Kopargaon', mrName: 'कोपरगाव', lat: 19.8370, lng: 74.4829, fullAddress: 'कोपरगाव, Ahilyanagar District, Maharashtra, India' },
    { name: 'Shirdi', mrName: 'शिर्डी', lat: 19.7668, lng: 74.4754, fullAddress: 'Shirdi, Rahta, Ahilyanagar District, Maharashtra, India' },
    { name: 'Rahata', mrName: 'राहाता', lat: 19.7171, lng: 74.4800, fullAddress: 'राहाता, Rahta, Ahilyanagar District, Maharashtra, India' },
    { name: 'Vaijapur', mrName: 'वैजापूर', lat: 19.9489, lng: 74.8332, fullAddress: 'Vaijapur, Chhatrapati Sambhajinagar, Maharashtra, India' },
    { name: 'Shrirampur', mrName: 'श्रीरामपूर', lat: 19.6420, lng: 74.7007, fullAddress: 'श्रीरामपूर, Ahilyanagar District, Maharashtra, India' },
    { name: 'Lasalgaon', mrName: 'लासलगाव', lat: 20.1427, lng: 74.2378, fullAddress: 'Lasalgaon, Niphad Taluka, Nashik, Maharashtra, India' },
    { name: 'Yeola', mrName: 'येवला', lat: 20.0429, lng: 74.4880, fullAddress: 'Yeola, Yeola Taluka, Nashik, Maharashtra, India' },
    { name: 'Sangamner', mrName: 'संगमनेर', lat: 19.4906, lng: 74.2467, fullAddress: 'संगमनेर, Ahilyanagar District, Maharashtra, India' },
    { name: 'Niphad', mrName: 'निफाड', lat: 20.0797, lng: 74.1071, fullAddress: 'निफाड, Niphad Taluka, Nashik, Maharashtra, India' },
  ];


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 px-6 py-4 text-white shrink-0 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-emerald-100 text-xs font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>APMC Logistics & Freight Pooling</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-300" />
              Set Produce Pickup Pin
            </h2>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              Pin your farm location to enable live departure alerts & 500m AgriPool micro-freight sharing.
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2.5">
          {/* Nominatim Search Input */}
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search village, taluka, or town (e.g. Kopargaon, Lasalgaon, Rahata)..."
                className="w-full pl-9 pr-24 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin absolute right-24" />
              )}
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="p-1 text-slate-400 hover:text-slate-600 absolute right-20"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleUseDeviceGps}
                disabled={isLocating}
                className="absolute right-1.5 px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                title="Detect current device location"
              >
                {isLocating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5 text-emerald-700" />
                )}
                <span className="hidden sm:inline">Use GPS</span>
              </button>
            </div>

            {/* Nominatim Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20 max-h-48 overflow-y-auto">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSearchResult(result)}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-start gap-2 border-b border-slate-100 last:border-b-0 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{result.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Village Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Quick Hubs:
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleSelectPreset(preset)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 text-xs font-medium transition-all shadow-2xs flex items-center gap-1"
                title={preset.fullAddress}
              >
                <span>{preset.mrName || preset.name}</span>
                {preset.mrName && <span className="text-[10px] text-slate-400">({preset.name})</span>}
              </button>
            ))}
          </div>
        </div>


        {/* Map View Canvas */}
        <div className="relative flex-1 min-h-[280px] sm:min-h-[340px] bg-slate-100">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

          {/* Floating Instructions Helper */}
          <div className="absolute top-3 left-3 z-10 bg-slate-900/80 backdrop-blur-md text-white text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md border border-white/10 pointer-events-none">
            <Navigation className="w-3 h-3 text-emerald-400" />
            <span>Drag the pin or click on map to position exactly at your farm</span>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="absolute top-12 left-3 right-3 z-10 bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2 shadow-lg">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="absolute top-12 left-3 right-3 z-10 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2 shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Selected Coordinates & Confirmation Footer */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800">
                {selectedCoords.lat.toFixed(4)}° N, {selectedCoords.lng.toFixed(4)}° E
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate max-w-sm mt-0.5" title={locationAddress}>
              {locationAddress || 'Selected Farm Pin'}
            </p>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirmLocation}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Pin...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Confirm Pickup Location</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
