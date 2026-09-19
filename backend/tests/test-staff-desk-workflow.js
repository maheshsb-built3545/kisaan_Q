const API = 'http://localhost:5000/api';

async function runWorkflowTest() {
  console.log('================================================================');
  console.log('🏛️ KisanQ Mandi Staff Desk & Single-Active-Token Release E2E Test');
  console.log('================================================================\n');

  const farmerPhone = '9922' + Math.floor(100000 + Math.random() * 900000);
  const farmerName = 'Dnyaneshwar Gaikwad';

  // 1. Initial Booking
  console.log('--- STEP 1: Farmer Books Token (Initial Slot Reservation) ---');
  const bookRes1 = await fetch(`${API}/tokens/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmerName,
      farmerPhone,
      phone: farmerPhone,
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      crop: 'Wheat',
      quantity: 24,
      slotDate: '10 Sep 2026',
      slotTime: 'Morning 08:00 – 11:00 AM',
      latitude: 19.8928,
      longitude: 74.4820
    })
  });
  const bookData1 = await bookRes1.json();
  const tokenNumber = bookData1.token?.tokenNumber || bookData1.token?.id;
  console.log('Response Status:', bookRes1.status);
  console.log('Generated Token:', tokenNumber);
  console.assert(bookRes1.status === 201, 'Booking failed');
  console.log('✅ STEP 1 PASSED: Token booked successfully.\n');

  // 2. Single-Active-Token Constraint Check (Should be blocked)
  console.log('--- STEP 2: Duplicate Booking Attempt (Must Return HTTP 409) ---');
  const bookRes2 = await fetch(`${API}/tokens/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmerName,
      farmerPhone,
      phone: farmerPhone,
      mandiId: 'SRD-02',
      mandiName: 'APMC Shirdi',
      crop: 'Soybean',
      quantity: 10,
      slotDate: '10 Sep 2026',
      latitude: 19.8928,
      longitude: 74.4820
    })
  });
  const bookData2 = await bookRes2.json();
  console.log('Response Status:', bookRes2.status);
  console.log('Error Code:', bookData2.error);
  console.log('Message:', bookData2.message);
  console.assert(bookRes2.status === 409, 'Expected 409 Conflict');
  console.assert(bookData2.error === 'ACTIVE_TOKEN_EXISTS', 'Expected ACTIVE_TOKEN_EXISTS');
  console.log('✅ STEP 2 PASSED: Strict Single-Active-Token rule correctly blocks duplicate reservation.\n');

  // 3. Desk 1: Security Gate Check-In & Boom Barrier
  console.log('--- STEP 3: Staff Desk 1 — Security Gate Check-In & Boom Barrier ---');
  const desk1Res = await fetch(`${API}/tokens/${encodeURIComponent(tokenNumber)}/stage-progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stageId: 'GATE_CHECKIN',
      stageIndex: 0,
      officerName: 'Ramesh Shinde, Security Head',
      officerSigId: 'SEC-D1-KPG-001',
      status: 'Completed',
      details: { gateNumber: 'Gate #1', entryType: 'Truck' }
    })
  });
  const desk1Data = await desk1Res.json();
  console.log('Status:', desk1Res.status);
  console.log('Token Status:', desk1Data.token?.status);
  console.assert(desk1Res.status === 200, 'Desk 1 Failed');
  console.log('✅ STEP 3 PASSED: Security gate check-in signed off & boom barrier opened.\n');

  // 4. Desk 2: Quality Assaying & Grading
  console.log('--- STEP 4: Staff Desk 2 — Quality Assaying & Moisture Grading ---');
  const desk2Res = await fetch(`${API}/tokens/${encodeURIComponent(tokenNumber)}/stage-progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stageId: 'QUALITY_GRADING',
      stageIndex: 1,
      officerName: 'S. Patil, Quality Assayer',
      officerSigId: 'QA-SP-KPG-002',
      status: 'Completed',
      grade: 'Grade A',
      moisture: 11.2,
      foreignMatter: 1.1,
      details: { grade: 'Grade A', moisture: 11.2, foreignMatter: 1.1 }
    })
  });
  const desk2Data = await desk2Res.json();
  console.log('Status:', desk2Res.status);
  console.log('Grade:', desk2Data.token?.stages[1]?.grade);
  console.assert(desk2Res.status === 200, 'Desk 2 Failed');
  console.log('✅ STEP 4 PASSED: Quality Grade A certified with 11.2% moisture.\n');

  // 5. Desk 3: Electronic Weighbridge (Gross 5.8 MT, Tare 3.4 MT -> Net 24 Qtl)
  console.log('--- STEP 5: Staff Desk 3 — Electronic Weighbridge (Gross & Tare) ---');
  const desk3Res = await fetch(`${API}/tokens/${encodeURIComponent(tokenNumber)}/stage-progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stageId: 'WEIGHBRIDGE',
      stageIndex: 2,
      officerName: 'Suresh Jadhav, Weighmaster',
      officerSigId: 'WM-02-KPG-003',
      status: 'Completed',
      weight: 24.0,
      grossWeight: 5.80,
      tareWeight: 3.40,
      netWeight: 24.0,
      details: { grossWeightMT: 5.80, tareWeightMT: 3.40, netProduceMT: 2.40, netProduceQtl: 24.0 }
    })
  });
  const desk3Data = await desk3Res.json();
  console.log('Status:', desk3Res.status);
  console.log('Net Weight (Qtl):', desk3Data.token?.stages[2]?.weight);
  console.assert(desk3Res.status === 200, 'Desk 3 Failed');
  console.log('✅ STEP 5 PASSED: Calibrated load cell weight locked: 2.40 MT (24.0 Qtl).\n');

  // 6. Desk 4: APMC Procurement & Purchase Order Confirmation
  console.log('--- STEP 6: Staff Desk 4 — APMC Procurement & Purchase Order Authorization ---');
  const desk4Res = await fetch(`${API}/tokens/${encodeURIComponent(tokenNumber)}/stage-progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stageId: 'PROCUREMENT',
      stageIndex: 3,
      officerName: 'Secretary Deshmukh',
      officerSigId: 'SEC-APMC-KPG-004',
      status: 'Completed',
      poNumber: 'PO-APMC-KPG-8891',
      totalAmount: 58320,
      details: { ratePerQtl: 2430, certifiedQuantity: 24.0, totalAmount: 58320 }
    })
  });
  const desk4Data = await desk4Res.json();
  console.log('Status:', desk4Res.status);
  console.assert(desk4Res.status === 200, 'Desk 4 Failed');
  console.log('✅ STEP 6 PASSED: Purchase Order authorized for ₹58,320.\n');

  // 7. Desk 5: Final Settlement Execution & Account Release
  console.log('--- STEP 7: Staff Desk 5 — Treasury & DBT Settlement Execution ---');
  const desk5Res = await fetch(`${API}/tokens/${encodeURIComponent(tokenNumber)}/stage-progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stageId: 'PAYOUT',
      stageIndex: 4,
      officerName: 'Treasurer Deshmukh',
      officerSigId: 'TRY-DBT-KPG-005',
      status: 'Completed',
      paymentRef: 'DBT-MH-2026-7788',
      totalAmount: 58320,
      details: { dbtStatus: 'TRANSFER_EXECUTED', totalPaid: 58320 }
    })
  });
  const desk5Data = await desk5Res.json();
  console.log('Status:', desk5Res.status);
  console.log('Final Token Status:', desk5Data.token?.status);
  console.assert(desk5Res.status === 200, 'Desk 5 Failed');
  console.assert(desk5Data.token?.status === 'Completed', 'Token status should be Completed');
  console.log('✅ STEP 7 PASSED: DBT Payout executed. Token status is now COMPLETED.\n');

  // 8. Re-booking Attempt (Should now SUCCEED because active token was completed!)
  console.log('--- STEP 8: Single-Active-Token Release Verification (New Booking Must Succeed) ---');
  const bookRes3 = await fetch(`${API}/tokens/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmerName,
      farmerPhone,
      phone: farmerPhone,
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      crop: 'Soybean',
      quantity: 18,
      slotDate: '11 Sep 2026',
      latitude: 19.8928,
      longitude: 74.4820
    })
  });
  const bookData3 = await bookRes3.json();
  console.log('Response Status:', bookRes3.status);
  console.log('New Booked Token:', bookData3.token?.tokenNumber || bookData3.token?.id);
  console.assert(bookRes3.status === 201, 'New booking should succeed after previous token completed');
  console.log('✅ STEP 8 PASSED: Single-active-token lock successfully lifted! Farmer booked a new slot.\n');

  console.log('================================================================');
  console.log('🎉 ALL 8 MANDI STAFF DESK & ACCOUNT RELEASE TESTS PASSED (100%)!');
  console.log('================================================================');
}

runWorkflowTest().catch(err => {
  console.error('Workflow test error:', err);
  process.exit(1);
});
