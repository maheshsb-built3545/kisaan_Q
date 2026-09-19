const { errorResponse } = require('../utils/apiResponse');

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string} allowedRoles - List of permitted roles (e.g. 'operator', 'supervisor', 'district_admin')
 */
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required before checking permissions.', 401);
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return errorResponse(
        res,
        `Access forbidden. Role '${userRole}' is not authorized to access this resource. Required roles: [${allowedRoles.join(', ')}]`,
        403
      );
    }

    next();
  };
};

module.exports = {
  checkRole
};
