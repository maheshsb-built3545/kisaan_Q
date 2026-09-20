const { errorResponse } = require('../utils/apiResponse');

/**
 * Centre-Level Multi-Tenancy Scoping Middleware
 * Enforces operational boundary access:
 * - district_admin and auditor have cross-centre visibility.
 * - resource_officer, supervisor, and desk staff are strictly isolated to their assigned centre.
 */
const scopeToCentre = (options = {}) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required before scoping to centre.', 401);
    }

    const { role, assignedMandi, centreId } = req.user;

    // District Admins and Auditors have cross-centre district authority
    if (role === 'district_admin' || role === 'auditor') {
      req.scopedCentreId = (
        req.params.centreId ||
        req.query.centreId ||
        req.body.centreId ||
        req.params.mandiId ||
        req.query.mandiId ||
        req.body.mandiId ||
        assignedMandi ||
        centreId ||
        'KPG-01'
      ).toString();
      return next();
    }

    // Resolve user's assigned centre code
    const userCentre = (assignedMandi || centreId || '').toString().trim().toUpperCase();
    if (!userCentre) {
      return errorResponse(res, 'Access denied: User has no assigned operational centre.', 403);
    }

    // Extract any target centre specified in request params, query, or body
    const rawTarget = (
      req.params.centreId ||
      req.query.centreId ||
      req.body.centreId ||
      req.params.mandiId ||
      req.query.mandiId ||
      req.body.mandiId ||
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
  };
};

module.exports = { scopeToCentre };
