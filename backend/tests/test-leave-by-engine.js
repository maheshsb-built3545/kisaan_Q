import assert from 'assert';
import { calculateLeaveBy } from './frontend-web/src/services/routingService.js';
import { TOKEN_STATUS } from './frontend-web/src/utils/statusEnums.js';

console.log('🚀 Running Leave-By Engine & Date Handling Unit Tests...\n');

// Test Case 1: Past Slot Date (e.g., 10 Sep 2026 when current date is 11 Sep 2026)
console.log('▶ [1/5] Testing Past Slot Date Calculation...');
const pastToken = {
  id: 'KQ-KPG-2026-9367',
  tokenNumber: 'KQ-KPG-2026-9367',
  slotDate: '10 Sep 2026',
  slotTime: 'Morning 08:00 – 11:00 AM',
  status: 'Booked',
  stages: [{ id: 'GATE_CHECKIN', status: 'pending' }]
};

const pastResult = calculateLeaveBy({
  token: pastToken,
  travelDurationMins: 15,
  bufferMins: 15
});

console.log('Result for Past Token:', {
  badge: pastResult.urgency.badge,
  label: pastResult.urgency.label,
  windowMins: pastResult.windowMins,
  isExpired: pastResult.isExpired
});

assert.strictEqual(pastResult.isExpired, true);
assert.strictEqual(pastResult.urgency.label, 'SLOT EXPIRED / OVERDUE');
assert.ok(pastResult.windowMins < 0, 'Window minutes should be negative for past date');
console.log('✔ Passed: Past date correctly flagged as SLOT EXPIRED / OVERDUE!\n');

// Test Case 2: Gate-Exit-Requested status
console.log('▶ [2/5] Testing Gate-Exit-Requested Terminal Banner...');
const exitReqToken = {
  id: 'KQ-KPG-2026-9367',
  tokenNumber: 'KQ-KPG-2026-9367',
  slotDate: 'Today',
  slotTime: 'Morning 08:00 – 11:00 AM',
  status: 'Gate-Exit-Requested',
  stages: [{ id: 'GATE_CHECKIN', status: 'completed' }]
};

const exitReqResult = calculateLeaveBy({
  token: exitReqToken,
  travelDurationMins: 15,
  bufferMins: 15
});

console.log('Result for Exit Request Token:', {
  badge: exitReqResult.urgency.badge,
  label: exitReqResult.urgency.label,
  isTerminal: exitReqResult.isTerminal
});

assert.strictEqual(exitReqResult.urgency.label, 'Gate Exit In Review');
assert.strictEqual(exitReqResult.isTerminal, true);
console.log('✔ Passed: Gate Exit correctly displays "Gate Exit In Review" banner!\n');

// Test Case 3: Cancelled Token
console.log('▶ [3/5] Testing Cancelled Terminal Banner...');
const cancelledToken = {
  id: 'KQ-KPG-2026-1122',
  status: 'Cancelled',
  stages: []
};

const cancelResult = calculateLeaveBy({ token: cancelledToken });
assert.strictEqual(cancelResult.urgency.label, 'Booking Cancelled');
assert.strictEqual(cancelResult.isTerminal, true);
console.log('✔ Passed: Cancelled token displays terminal banner!\n');

// Test Case 4: Inside Yard Token (Stage 1 Completed)
console.log('▶ [4/5] Testing In Yard Token...');
const inYardToken = {
  id: 'KQ-KPG-2026-3344',
  status: 'In-Progress',
  stages: [{ id: 'GATE_CHECKIN', status: 'completed' }]
};

const inYardResult = calculateLeaveBy({ token: inYardToken });
assert.strictEqual(inYardResult.urgency.label, 'Inside Mandi Yard');
console.log('✔ Passed: In Yard token displays "Inside Mandi Yard"!\n');

// Test Case 5: Today Upcoming Slot
console.log('▶ [5/5] Testing Today Upcoming Slot Departure Calculation...');
const futureSlot = new Date();
futureSlot.setHours(futureSlot.getHours() + 3);
const futureHourStr = `${String(futureSlot.getHours()).padStart(2, '0')}:00`;

const futureToken = {
  id: 'KQ-KPG-2026-7788',
  slotDate: 'Today',
  slotTime: `Afternoon ${futureHourStr} – 05:00 PM`,
  status: 'Booked',
  queuePosition: 1,
  stages: [{ id: 'GATE_CHECKIN', status: 'pending' }]
};

const futureResult = calculateLeaveBy({
  token: futureToken,
  travelDurationMins: 20,
  bufferMins: 15
});

console.log('Result for Upcoming Slot:', {
  badge: futureResult.urgency.badge,
  label: futureResult.urgency.label,
  windowMins: futureResult.windowMins,
  leaveTimeFormatted: futureResult.leaveTimeFormatted
});

assert.ok(futureResult.windowMins > 0, 'Window minutes should be positive for upcoming slot');
assert.strictEqual(futureResult.isExpired, false);
console.log('✔ Passed: Upcoming slot calculates positive departure countdown!\n');

console.log('===============================================================');
console.log('🏆 ALL LEAVE-BY ENGINE UNIT TESTS PASSED 100%!');
console.log('===============================================================');
