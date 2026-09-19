async function verifyCentres() {
  const res = await fetch('http://localhost:5000/api/centres');
  const body = await res.json();
  const centres = body.data;

  console.log('=== APMC CENTRES VERIFICATION ===');
  console.log('Total centres returned:', centres.length);

  // Haversine formula
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
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

  const farmerPin = { lat: 19.8370, lng: 74.4829 }; // Kopargaon

  centres.forEach(c => {
    const lat = c.location.coordinates[1];
    const lng = c.location.coordinates[0];
    const dist = haversineKm(farmerPin.lat, farmerPin.lng, lat, lng).toFixed(1);
    console.log(`[${c.code}] ${c.name} (${c.nameMarathi}) | District: ${c.district} | Lat: ${lat}, Lng: ${lng} | Dist to Farmer Pin: ${dist} km`);
  });

  const expectedCodes = ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'];
  const actualCodes = centres.map(c => c.code);
  const allPresent = expectedCodes.every(code => actualCodes.includes(code));
  console.log('\nAll 6 expected APMC centres present:', allPresent ? 'PASS' : 'FAIL');
}

verifyCentres().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
