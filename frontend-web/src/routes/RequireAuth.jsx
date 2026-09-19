import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RequireAuth = ({ children, redirectTo }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400 text-sm animate-pulse">Authenticating session...</p>
      </div>
    );
  }

  // Guard Check: Cleanly redirect unauthenticated users to login/landing
  if (!isAuthenticated) {
    const isStaffRoute = location.pathname.startsWith('/staff') ||
      ['/guard-terminal', '/weighmaster-desk', '/supervisor-exceptions', '/admin-dashboard', '/admin'].includes(location.pathname);

    const targetRedirect = redirectTo || (isStaffRoute ? '/staff-login' : '/');
    return <Navigate to={targetRedirect} state={{ from: location }} replace />;
  }

  return children;
};

export default RequireAuth;
