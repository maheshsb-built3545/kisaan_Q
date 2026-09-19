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

async function runTests() {
  console.log('--- Testing CropPrice API Endpoints ---');

  // Test 1: GET /api/centres/KPG-01/prices
  console.log('\n[1] Testing GET /api/centres/KPG-01/prices');
  const res1 = await fetchJson('/api/centres/KPG-01/prices');
  console.log('Status:', res1.status);
  console.log('Data summary:', res1.data?.data?.length, 'prices found:');
  console.log(JSON.stringify(res1.data?.data, null, 2));

  // Test 2: GET /api/prices/Soybean
  console.log('\n[2] Testing GET /api/prices/Soybean');
  const res2 = await fetchJson('/api/prices/Soybean');
  console.log('Status:', res2.status);
  console.log('Data summary:', res2.data?.data?.length, 'mandi prices found for Soybean:');
  console.log(JSON.stringify(res2.data?.data, null, 2));

  // Test 3: GET /api/prices
  console.log('\n[3] Testing GET /api/prices');
  const res3 = await fetchJson('/api/prices');
  console.log('Status:', res3.status);
  console.log('Total price records:', res3.data?.data?.length);

  console.log('\n✅ All tests completed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
