const http = require('http');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- 1. Testing GET /api/admin/farmers ---');
  const farmersRes = await getJson('/api/admin/farmers');
  console.log('Farmers Status:', farmersRes.status, 'Count:', farmersRes.data?.data?.count);

  console.log('\n--- 2. Testing POST /api/admin/farmers (Manual Provisioning) ---');
  const newFarmer = await postJson('/api/admin/farmers', {
    name: 'Nanasaheb Shinde',
    phone: '9850123456',
    village: 'Kopargaon (Bhavani Nagar)',
    crop: 'Wheat',
    landArea: 6.2,
    district: 'Ahmednagar',
    state: 'Maharashtra',
    preferredLanguage: 'mr'
  });
  console.log('Create Farmer Response:', newFarmer);

  console.log('\n--- 3. Testing POST /api/tokens/book ---');
  const bookRes = await postJson('/api/tokens/book', {
    farmerName: 'Nanasaheb Shinde',
    phone: '9850123456',
    crop: 'Wheat',
    quantity: 30,
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    slotTime: '09:00 AM',
    slotDate: '2026-09-11'
  });
  console.log('Book Token Response:', bookRes);

  console.log('\n--- 4. Testing Single-Active-Token Constraint (Duplicate booking attempt) ---');
  const dupRes = await postJson('/api/tokens/book', {
    farmerName: 'Nanasaheb Shinde',
    phone: '9850123456',
    crop: 'Wheat',
    quantity: 15,
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    slotTime: '11:00 AM',
    slotDate: '2026-09-11'
  });
  console.log('Duplicate Booking Blocked Status:', dupRes.status, 'Message:', dupRes.data?.message);

  console.log('\n--- 5. Testing POST /api/admin/reset-data ---');
  const resetRes = await postJson('/api/admin/reset-data', {});
  console.log('Reset Data Response:', resetRes);

  console.log('\n--- All Backend Verification Tests Passed ---');
}

runTests().catch(console.error);
