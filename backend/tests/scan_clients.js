const fs = require('fs');
const path = require('path');

function scanDir(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results = results.concat(scanDir(full));
    } else if (e.name.endsWith('.jsx') || e.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const basePages = path.resolve(__dirname, '../../frontend-web/src/pages');
const baseComponents = path.resolve(__dirname, '../../frontend-web/src/components');

const files = [...scanDir(basePages), ...scanDir(baseComponents)];

const table = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(path.resolve(__dirname, '../../frontend-web/src'), file).replace(/\\/g, '/');
  
  const usesFarmerClient = /\bfarmerClient\b/.test(content);
  const usesStaffClient = /\bstaffClient\b/.test(content);
  const usesApiClient = /\bapiClient\b/.test(content);
  const usesRawFetch = /\bfetch\s*\(/.test(content);
  const usesRawAxios = /\baxios\b/.test(content);

  const apiImports = [];
  if (/\bpricesApi\b/.test(content)) apiImports.push('pricesApi');
  if (/\bfastTrackApi\b/.test(content)) apiImports.push('fastTrackApi');
  if (/\bstaffFastTrackApi\b/.test(content)) apiImports.push('staffFastTrackApi');
  if (/\bcomplaintsApi\b/.test(content)) apiImports.push('complaintsApi');
  if (/\bexceptionsApi\b/.test(content)) apiImports.push('exceptionsApi');
  if (/\bnotificationsApi\b/.test(content)) apiImports.push('notificationsApi');
  if (/\bstaffNotificationsApi\b/.test(content)) apiImports.push('staffNotificationsApi');
  if (/\bauditApi\b/.test(content)) apiImports.push('auditApi');
  if (/\bcentresApi\b/.test(content)) apiImports.push('centresApi');
  if (/\bwaitlistApi\b/.test(content)) apiImports.push('waitlistApi');

  let directClient = 'none';
  if (usesFarmerClient && usesStaffClient) directClient = 'both';
  else if (usesFarmerClient) directClient = 'farmerClient';
  else if (usesStaffClient) directClient = 'staffClient';
  else if (usesApiClient) directClient = 'apiClient';

  table.push({
    file: rel,
    directClient,
    rawFetch: usesRawFetch,
    rawAxios: usesRawAxios,
    apiModules: apiImports
  });
}

console.log(JSON.stringify(table, null, 2));
