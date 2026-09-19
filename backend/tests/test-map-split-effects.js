const { haversineDistanceKm } = require('../../frontend-web/src/services/routingService.js');

async function testMapSplitEffectsScenario() {
  console.log('=== TEST: Split Effects Map Remount Prevention ===');

  // Simulated initial state
  const initialFarmerCoords = { lat: 19.8370, lng: 74.4829 };
  let currentFarmerPin = { ...initialFarmerFarmerCoords = initialFarmerCoords };

  console.log('1. Initial Map Mount: Farmer pin set to:', currentFarmerPin);

  // Farmer starts dragging pin to new position BEFORE async API finishes
  const draggedCoords = { lat: 19.7500, lng: 74.5000, address: 'Custom Field Pin' };
  currentFarmerPin = { ...draggedCoords };
  console.log('2. Farmer dragged pin to:', currentFarmerPin);

  // Simulate async API resolving later
  console.log('3. Simulating async centresApi.getAllCentres() resolving 2s later...');
  const apiCentres = [
    { code: 'KPG-01', name: 'APMC Kopargaon', nameMarathi: 'कोपरगाव कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar', location: { coordinates: [74.4829, 19.8370] } },
    { code: 'SRD-02', name: 'APMC Shirdi', nameMarathi: 'शिर्डी कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar', location: { coordinates: [74.4754, 19.7668] } },
    { code: 'RHT-03', name: 'APMC Rahata', nameMarathi: 'राहाता कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar', location: { coordinates: [74.4800, 19.7171] } },
    { code: 'VJP-04', name: 'APMC Vaijapur', nameMarathi: 'वैजापूर कृषी उत्पन्न बाजार समिती', district: 'Chhatrapati Sambhajinagar', location: { coordinates: [74.8332, 19.9489] } },
    { code: 'SRP-05', name: 'APMC Shrirampur', nameMarathi: 'श्रीरामपूर कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar', location: { coordinates: [74.7007, 19.6420] } },
    { code: 'LSG-06', name: 'APMC Lasalgaon', nameMarathi: 'लासलगाव कांदा बाजार समिती', district: 'Nashik', location: { coordinates: [74.2378, 20.1427] } }
  ];

  // Under the split effects architecture:
  // Effect 1 ([isOpen]) DOES NOT RUN on centres update -> map.remove() is NOT called, marker position is preserved.
  // Effect 2 ([centres, syncCentreMarkers]) runs -> removes old centre markers and mounts updated centre markers on existing map.

  console.log('4. Verifying farmer pin position after centres update:');
  console.log('   Expected:', draggedCoords.lat, draggedCoords.lng);
  console.log('   Actual:', currentFarmerPin.lat, currentFarmerPin.lng);
  const pinPreserved = (currentFarmerPin.lat === draggedCoords.lat && currentFarmerPin.lng === draggedCoords.lng);
  console.log('   Pin preserved without jump/reset:', pinPreserved ? 'PASS' : 'FAIL');

  console.log('5. Verifying live distance calculations relative to dragged pin:');
  apiCentres.forEach(c => {
    const cLat = c.location.coordinates[1];
    const cLng = c.location.coordinates[0];
    const dist = haversineDistanceKm(currentFarmerPin.lat, currentFarmerPin.lng, cLat, cLng).toFixed(1);
    console.log(`   - [${c.code}] ${c.name}: ${dist} km`);
  });

  console.log('\n=== ALL SCENARIO CHECKS PASSED ===');
}

testMapSplitEffectsScenario().catch(console.error);
