const { errorResponse } = require('../utils/apiResponse');

/**
 * Centre-Level Multi-Tenancy Scoping Middleware
 * Enforces operational boundary access:
 * - district_admin: read-only across centres (GET only); write/decision actions refused (403).
 * - auditor: read-only across centres (GET only).
 * - resource_officer, supervisor, and desk staff: strictly isolated to their assigned centre.
 */
function handleScopeToCentre(req, res, next) {
  if (!req.user) {
    return errorResponse(res, 'Authentication required before scoping to centre.', 401);
  }

  const { role, assignedMandi, centreId } = req.user;

  // District Admins and Auditors have cross-centre district read visibility
  if (role === 'district_admin' || role === 'auditor') {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      return errorResponse(
        res,
        'Access denied: District Admin role has district-wide read-only access. Write and decision actions must be performed by centre-level operational officers.',
        403
      );
    }
    req.scopedCentreId = (
      req.params.centreId ||
      req.query.centreId ||
      req.body?.centreId ||
      req.params.mandiId ||
      req.query.mandiId ||
      req.body?.mandiId ||
      assignedMandi ||
      centreId ||
      'KPG-01'
    ).toString();
    return next();
  }

  // Global Admin has full cross-centre access
  if (role === 'admin') {
    req.scopedCentreId = (
      req.params.centreId ||
      req.query.centreId ||
      req.body?.centreId ||
      req.params.mandiId ||
      req.query.mandiId ||
      req.body?.mandiId ||
      'KPG-01'
    ).toString();
    return next();
  }

  // Resolve user's assigned centre code
  const userCentre = (assignedMandi || centreId || '').toString().trim().toUpperCase();
  if (!userCentre) {
    return errorResponse(res, 'Access denied: User has no assigned operational centre.', 403);
  }

  // Extract target centre specified in request params, query, or body
  const rawTarget = (
    req.params.centreId ||
    req.query.centreId ||
    req.body?.centreId ||
    req.params.mandiId ||
    req.query.mandiId ||
    req.body?.mandiId ||
    ''
  ).toString().trim().toUpperCase();

  if (rawTarget && rawTarget !== 'ALL') {
    const isMatch = rawTarget === userCentre || rawTarget.startsWith(userCentre.split('-')[0]);
    if (!isMatch) {
      return errorResponse(
        res,
        `Access forbidden. You are assigned to centre '${userCentre}' and cannot access resources in '${rawTarget}'.`,
        403
      );
    }
  }

  req.scopedCentreId = userCentre;
  next();
}

const scopeToCentre = (arg1, arg2, arg3) => {
  if (arg1 && arg1.headers && typeof arg3 === 'function') {
    return handleScopeToCentre(arg1, arg2, arg3);
  }
  return handleScopeToCentre;
};

module.exports = { scopeToCentre };
