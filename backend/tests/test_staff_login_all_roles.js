'use strict';

require('dotenv').config();
const assert = require('assert');
const jwt = require('jsonwebtoken');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

const ALL_ROLES = [
  {
    role: 'security_gate',
    phone: '9800000001',
    name: 'Ramesh Shinde',
    category: 'Desk Checkpoint',
    expectedLanding: '/admin-dashboard/desk',
    landingEndpoint: '/api/tokens/mandi/KPG-01'
  },
  {
    role: 'quality_assayer',
    phone: '9800000002',
    name: 'S. Patil',
    category: 'Desk Checkpoint',
    expectedLanding: '/admin-dashboard/desk',
    landingEndpoint: '/api/tokens/mandi/KPG-01'
  },
  {
    role: 'weighmaster',
    phone: '9800000003',
    name: 'Suresh Jadhav',
    category: 'Desk Checkpoint',
    expectedLanding: '/admin-dashboard/desk',
    landingEndpoint: '/api/tokens/mandi/KPG-01'
  },
  {
    role: 'procurement',
    phone: '9800000004',
    name: 'Secretary Deshmukh',
    category: 'Desk Checkpoint',
    expectedLanding: '/admin-dashboard/desk',
    landingEndpoint: '/api/tokens/mandi/KPG-01'
  },
  {
    role: 'accounts_settlement',
    phone: '9800000005',
    name: 'Treasurer Deshmukh',
    category: 'Desk Checkpoint',
    expectedLanding: '/admin-dashboard/desk',
    landingEndpoint: '/api/tokens/mandi/KPG-01'
  },
  {
    role: 'resource_officer',
    phone: '9800000006',
    name: 'P. Kulkarni',
    category: 'Management',
    expectedLanding: '/planning',
    landingEndpoint: '/api/planning/forecast?centreId=KPG-01'
  },
  {
    role: 'supervisor',
    phone: '9800000007',
    name: 'V. Pawar',
    category: 'Management',
    expectedLanding: '/supervisor-exceptions',
    landingEndpoint: '/api/exceptions'
  },
  {
    role: 'district_admin',
    phone: '9800000008',
    name: 'Collector Nagar',
    category: 'Management',
    expectedLanding: '/admin-dashboard',
    landingEndpoint: '/api/centres'
  }
];

const DEFAULT_PASSWORD = 'Staff@KisanQ2026';
const VALID_OTP = '123456';

async function req(endpoint, options = {}) {
  const url = `${BACKEND_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// Emulate RequireRole logic from RequireRole.jsx
function checkRequireRole(userRole, allowedRoles) {
  const isAuthorized = !allowedRoles.length || (userRole && allowedRoles.includes(userRole));
  if (!isAuthorized) {
    if (!userRole) return { allowed: false, redirect: '/staff/login' };
    if (userRole === 'resource_officer') return { allowed: false, redirect: '/planning' };
    if (userRole === 'supervisor') return { allowed: false, redirect: '/supervisor-exceptions' };
    if (userRole === 'district_admin') return { allowed: false, redirect: '/admin-dashboard' };
    return { allowed: false, redirect: '/admin-dashboard/desk' };
  }
  return { allowed: true, redirect: null };
}

// Emulate post-login destination logic from StaffLogin.jsx
function getPostLoginRedirect(loggedRole) {
  if (loggedRole === 'resource_officer') return '/planning';
  if (loggedRole === 'supervisor') return '/supervisor-exceptions';
  if (loggedRole === 'district_admin') return '/admin-dashboard';
  return '/admin-dashboard/desk';
}

async function run() {
  console.log('================================================================');
  console.log('  🏢 STAFF AUTHENTICATION & MANAGEMENT ROLES VERIFICATION TEST');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function ok(label, cond) {
    total++;
    if (cond) {
      console.log(`  ✅ [PASS] ${label}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${label}`);
    }
  }

  const roleTokens = {};

  // Part 1: Test Step 1 & Step 2 for all 8 roles
  console.log('--- PART 1: 2-Step 2FA Authentication & Token Claims Across All 8 Roles ---');

  for (const staff of ALL_ROLES) {
    console.log(`\n▶ Authenticating: ${staff.name} [Role: ${staff.role}] (${staff.category})`);

    // Step 1: verify-credentials
    const credRes = await req('/api/auth/staff/verify-credentials', {
      method: 'POST',
      body: JSON.stringify({
        phone: staff.phone,
        password: DEFAULT_PASSWORD,
        role: staff.role
      })
    });

    ok(`${staff.role} verify-credentials status 200`, credRes.status === 200);
    ok(`${staff.role} challengeToken received`, Boolean(credRes.data.data?.challengeToken));
    const challengeToken = credRes.data.data?.challengeToken;
    const maskedMobile = credRes.data.data?.maskedMobile;
    console.log(`   ↳ Step 1 output: challengeToken=[Issued], maskedMobile=${maskedMobile}, officerName=${credRes.data.data?.officerName}`);

    // Step 2: verify-otp
    const otpRes = await req('/api/auth/staff/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        challengeToken,
        otp: VALID_OTP
      })
    });

    ok(`${staff.role} verify-otp status 200`, otpRes.status === 200);
    const token = otpRes.data.data?.token;
    const user = otpRes.data.data?.user;
    ok(`${staff.role} token generated with user.role = ${staff.role}`, user?.role === staff.role);

    roleTokens[staff.role] = token;

    // Verify JWT payload claims
    const decoded = jwt.verify(token, JWT_SECRET);
    ok(`${staff.role} JWT claim role === ${staff.role}`, decoded.role === staff.role);
    console.log(`   ↳ Step 2 output: JWT role="${decoded.role}", assignedMandi="${decoded.assignedMandi}", name="${decoded.name}"`);

    // Verify post-login redirection target matches requirements
    const redirectTarget = getPostLoginRedirect(decoded.role);
    ok(`${staff.role} redirects to ${staff.expectedLanding}`, redirectTarget === staff.expectedLanding);
    console.log(`   ↳ Post-login navigation: ${redirectTarget}`);

    // Step 3: First authenticated GET on landing page
    const landingRes = await req(staff.landingEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    ok(`${staff.role} landing endpoint GET ${staff.landingEndpoint} status ${landingRes.status}`, landingRes.status === 200);

    // Trimmed response preview without secrets
    let summary = '';
    if (Array.isArray(landingRes.data)) {
      summary = `Array of ${landingRes.data.length} items`;
    } else if (landingRes.data && typeof landingRes.data === 'object') {
      const keys = Object.keys(landingRes.data);
      const preview = {};
      for (const k of keys.slice(0, 4)) {
        const val = landingRes.data[k];
        preview[k] = Array.isArray(val) ? `[${val.length} items]` : typeof val === 'object' && val !== null ? '{...}' : val;
      }
      summary = JSON.stringify(preview);
    }
    console.log(`   ↳ Landing page GET response (${landingRes.status}): ${summary}`);
  }

  // Part 2: RequireRole Guard Enforcement & Redirection Tests
  console.log('\n--- PART 2: RequireRole Guard Enforcement & Cross-Role Redirection ---');

  // Scenario 1: quality_assayer tries to open /planning (allowed: resource_officer, supervisor, district_admin)
  const qaOnPlanning = checkRequireRole('quality_assayer', ['resource_officer', 'supervisor', 'district_admin']);
  ok('quality_assayer opening /planning is blocked by RequireRole', qaOnPlanning.allowed === false);
  ok('quality_assayer redirected to /admin-dashboard/desk', qaOnPlanning.redirect === '/admin-dashboard/desk');
  console.log(`   ↳ quality_assayer on /planning => Blocked! Redirected to: ${qaOnPlanning.redirect}`);

  // Scenario 2: resource_officer opens /planning (allowed)
  const roOnPlanning = checkRequireRole('resource_officer', ['resource_officer', 'supervisor', 'district_admin']);
  ok('resource_officer opening /planning is allowed', roOnPlanning.allowed === true && roOnPlanning.redirect === null);

  // Scenario 3: resource_officer tries to open /supervisor-exceptions (allowed: supervisor, district_admin)
  const roOnSupervisor = checkRequireRole('resource_officer', ['supervisor', 'district_admin']);
  ok('resource_officer opening /supervisor-exceptions is blocked', roOnSupervisor.allowed === false);
  ok('resource_officer redirected to /planning', roOnSupervisor.redirect === '/planning');
  console.log(`   ↳ resource_officer on /supervisor-exceptions => Blocked! Redirected to: ${roOnSupervisor.redirect}`);

  // Scenario 4: supervisor opens /supervisor-exceptions (allowed)
  const supOnSupervisor = checkRequireRole('supervisor', ['supervisor', 'district_admin']);
  ok('supervisor opening /supervisor-exceptions is allowed', supOnSupervisor.allowed === true);

  // Scenario 5: district_admin opens /admin-dashboard (allowed)
  const daOnAdmin = checkRequireRole('district_admin', ['district_admin', 'supervisor']);
  ok('district_admin opening /admin-dashboard is allowed', daOnAdmin.allowed === true);

  // Scenario 6: weighmaster tries to open /admin-dashboard (allowed: district_admin, supervisor)
  const wmOnAdmin = checkRequireRole('weighmaster', ['district_admin', 'supervisor']);
  ok('weighmaster opening /admin-dashboard is blocked', wmOnAdmin.allowed === false);
  ok('weighmaster redirected to /admin-dashboard/desk', wmOnAdmin.redirect === '/admin-dashboard/desk');
  console.log(`   ↳ weighmaster on /admin-dashboard => Blocked! Redirected to: ${wmOnAdmin.redirect}`);

  // Scenario 7: Unauthenticated user accessing protected route
  const unauthCheck = checkRequireRole(null, ['district_admin']);
  ok('Unauthenticated session redirected to /staff/login', unauthCheck.allowed === false && unauthCheck.redirect === '/staff/login');

  // Part 3: Backend RBAC Cross-Check with Real Tokens
  console.log('\n--- PART 3: Backend RBAC API Enforcement ---');
  // quality_assayer staff token calling /api/planning/forecast
  const qaPlanningApiRes = await req('/api/planning/forecast?centreId=KPG-01', {
    method: 'GET',
    headers: { Authorization: `Bearer ${roleTokens['quality_assayer']}` }
  });
  ok('quality_assayer token calling GET /planning/forecast returns 403 Forbidden', qaPlanningApiRes.status === 403);
  console.log(`   ↳ quality_assayer token on /api/planning/forecast => [${qaPlanningApiRes.status}] ${qaPlanningApiRes.data.message || qaPlanningApiRes.data.error}`);

  // resource_officer staff token calling /api/planning/forecast
  const roPlanningApiRes = await req('/api/planning/forecast?centreId=KPG-01', {
    method: 'GET',
    headers: { Authorization: `Bearer ${roleTokens['resource_officer']}` }
  });
  ok('resource_officer token calling GET /planning/forecast returns 200 OK', roPlanningApiRes.status === 200);

  console.log('\n================================================================');
  console.log(`  🎉 ALL ROLES VERIFICATION: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
