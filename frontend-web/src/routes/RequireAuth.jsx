import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RequireAuth = ({ children, redirectTo, area }) => {
  const { isAuthenticatedStaff, isAuthenticatedFarmer, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400 text-sm animate-pulse">Authenticating session...</p>
      </div>
    );
  }

  const isStaffRoute = area === 'staff' ||
    location.pathname.startsWith('/staff') ||
    ['/guard-terminal', '/weighmaster-desk', '/supervisor-exceptions', '/admin-dashboard', '/admin', '/planning'].some((p) => location.pathname.startsWith(p));

  // Area-specific authentication check
  if (isStaffRoute) {
    if (!isAuthenticatedStaff) {
      return <Navigate to={redirectTo || '/staff-login'} state={{ from: location }} replace />;
    }
  } else {
    if (!isAuthenticatedFarmer) {
      return <Navigate to={redirectTo || '/farmer-login'} state={{ from: location }} replace />;
    }
  }

  return children;
};

export default RequireAuth;
