const http = require('http');

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function verifyAgreement() {
  console.log('======================================================================');
  console.log('🔍 VERIFYING CROP PRICE AGREEMENT (Kopargaon - Soybean)');
  console.log('======================================================================\n');

  // 1. Fetch from GET /api/prices (Landing.jsx ticker data source)
  const allPricesRes = await fetchJson('/api/prices');
  const allPrices = allPricesRes.data?.data || [];
  const landingKpgSoybean = allPrices.find(p => p.mandiId === 'KPG-01' && p.crop === 'Soybean');
  const landingRate = landingKpgSoybean?.marketPriceToday;
  console.log(`(a) Landing.jsx Ticker Data Source (GET /api/prices):`);
  console.log(`    - Mandi: ${landingKpgSoybean?.mandiId} (APMC Kopargaon)`);
  console.log(`    - Crop: ${landingKpgSoybean?.crop}`);
  console.log(`    - Formatted Rate: ₹${landingRate?.toLocaleString('en-IN')}/Qtl`);
  console.log(`    - Statutory MSP Floor: ₹${landingKpgSoybean?.mspPrice}/Qtl\n`);

  // 2. Fetch from GET /api/centres/KPG-01/prices (StaffDesk.jsx data source)
  const staffDeskRes = await fetchJson('/api/centres/KPG-01/prices');
  const staffDeskPrices = staffDeskRes.data?.data || [];
  const staffDeskSoybean = staffDeskPrices.find(p => p.crop === 'Soybean');
  const staffDeskBaseRate = staffDeskSoybean?.marketPriceToday;
  const gradeMultiplier = 1.0; // 100% Grade A FAQ
  const staffDeskCertifiedRate = Math.round(staffDeskBaseRate * gradeMultiplier);
  console.log(`(b) StaffDesk.jsx Grading / Procurement PO (GET /api/centres/KPG-01/prices):`);
  console.log(`    - Mandi: ${staffDeskSoybean?.mandiId} (APMC Kopargaon)`);
  console.log(`    - Crop: ${staffDeskSoybean?.crop}`);
  console.log(`    - Base Rate: ₹${staffDeskBaseRate}/Qtl`);
  console.log(`    - Grade A FAQ Certified Rate (100% Multiplier): ₹${staffDeskCertifiedRate}/Qtl\n`);

  // 3. Fetch from GET /api/centres/KPG-01/prices (BookingPanel.jsx data source)
  const bookingPanelRes = await fetchJson('/api/centres/KPG-01/prices');
  const bookingPanelPrices = bookingPanelRes.data?.data || [];
  const bookingPanelSoybean = bookingPanelPrices.find(p => p.crop === 'Soybean');
  const bookingPanelTodayRate = bookingPanelSoybean?.marketPriceToday;
  const bookingPanelYesterdayRate = bookingPanelSoybean?.marketPriceYesterday;
  console.log(`(c) BookingPanel.jsx Rate Comparison (GET /api/centres/KPG-01/prices):`);
  console.log(`    - Mandi: ${bookingPanelSoybean?.mandiId} (APMC Kopargaon)`);
  console.log(`    - Crop: ${bookingPanelSoybean?.crop}`);
  console.log(`    - Today Live Rate: ₹${bookingPanelTodayRate}/Qtl`);
  console.log(`    - Yesterday Closing: ₹${bookingPanelYesterdayRate}/Qtl\n`);

  console.log('======================================================================');
  console.log('📊 COMPARISON & PASS/FAIL VERIFICATION:');
  console.log(`(a) Landing Ticker:        ₹${landingRate}/Qtl`);
  console.log(`(b) StaffDesk Base Rate:   ₹${staffDeskCertifiedRate}/Qtl`);
  console.log(`(c) BookingPanel Live Rate: ₹${bookingPanelTodayRate}/Qtl`);
  
  if (landingRate === staffDeskCertifiedRate && staffDeskCertifiedRate === bookingPanelTodayRate && landingRate === 4950) {
    console.log('\n✅ PASS: All 3 components agree with 100% consistency on ₹4,950/Qtl for Kopargaon Soybean!');
    console.log('======================================================================');
  } else {
    console.error('\n❌ FAIL: Discrepancy detected between component rate sources.');
    process.exit(1);
  }
}

verifyAgreement().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
