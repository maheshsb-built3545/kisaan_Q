// Test script for KisanQ production features: Single Active Token & 500m AgriPool Match
const http = require('http');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const body = JSON.stringify(data);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let resBody = '';
      res.on('data', (chunk) => { resBody += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(resBody);
        } catch {
          parsed = resBody;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('=== TEST 1: Single-Active-Token Constraint ===');
  const testPhone = '9876543210';
  
  const tokenPayload1 = {
    farmerName: 'Ramesh Patil',
    farmerPhone: testPhone,
    mandiId: 'KPG-01',
    crop: 'Soybean',
    quantity: 45,
    slotDate: '2026-09-12',
    slotTime: '09:00 AM - 10:00 AM',
    latitude: 19.8928,
    longitude: 74.4820
  };

  console.log('Posting Booking 1 (Ramesh Patil)...');
  const res1 = await postJson('http://localhost:5000/api/tokens/book', tokenPayload1);
  console.log(`Booking 1 Status: ${res1.status}`);
  console.log('Booking 1 Response:', JSON.stringify(res1.data, null, 2));

  console.log('\nPosting Booking 2 with same phone (9876543210) to verify HTTP 409 Conflict rejection...');
  const res2 = await postJson('http://localhost:5000/api/tokens/book', tokenPayload1);
  console.log(`Booking 2 Status: ${res2.status}`);
  console.log('Booking 2 Response:', JSON.stringify(res2.data, null, 2));

  if (res2.status === 409 && res2.data?.error === 'ACTIVE_TOKEN_EXISTS') {
    console.log('✅ TEST 1 PASSED: Strict Single-Active-Token rule enforced with 409 Conflict!');
  } else {
    console.log('❌ TEST 1 FAILED: Expected 409 Conflict with error ACTIVE_TOKEN_EXISTS');
  }

  console.log('\n=== TEST 2: 500m AgriPool Proximity Alert Engine ===');
  // Register second farmer nearby (approx 200m away in Kopargaon, same mandi KPG-01, same date 2026-09-12)
  // 1 degree latitude ~ 111 km => 0.001 deg ~ 111 m.
  // Farmer 2 at lat: 19.8940, lng: 74.4830 (~170 meters away)
  const tokenPayload2 = {
    farmerName: 'Suresh More',
    farmerPhone: '9822001122',
    mandiId: 'KPG-01',
    crop: 'Maize',
    quantity: 30,
    slotDate: '2026-09-12',
    slotTime: '10:00 AM - 11:00 AM',
    latitude: 19.8940,
    longitude: 74.4830
  };

  console.log('Posting Booking 2 for Suresh More within 200m of Ramesh Patil on same date & mandi...');
  const resPool = await postJson('http://localhost:5000/api/tokens/book', tokenPayload2);
  console.log(`AgriPool Booking Status: ${resPool.status}`);
  console.log('AgriPool Response:', JSON.stringify(resPool.data, null, 2));

  if (resPool.data?.agripoolPeer) {
    console.log(`✅ TEST 2 PASSED: 500m AgriPool peer detected: ${resPool.data.agripoolPeer.farmerName} (${resPool.data.agripoolPeer.distanceMeters}m away)!`);
  } else {
    console.log('Peer detection details:', resPool.data);
  }
}

runTests().catch(console.error);
