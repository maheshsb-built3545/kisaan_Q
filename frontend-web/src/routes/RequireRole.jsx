import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RequireRole = ({ allowedRoles = [], children }) => {
  const { user, staffUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400 text-sm">Verifying permissions...</p>
      </div>
    );
  }

  const activeUser = staffUser || user;
  const userRole = activeUser?.role;
  const isAuthorized = !allowedRoles.length || (userRole && allowedRoles.includes(userRole));

  if (!isAuthorized) {
    if (!userRole) {
      return <Navigate to="/staff/login" replace />;
    }
    if (userRole === 'resource_officer') {
      return <Navigate to="/planning" replace />;
    }
    if (userRole === 'supervisor') {
      return <Navigate to="/supervisor-exceptions" replace />;
    }
    if (userRole === 'district_admin') {
      return <Navigate to="/admin-dashboard" replace />;
    }
    // Default fallback for operational checkpoint desk roles
    return <Navigate to="/admin-dashboard/desk" replace />;
  }

  return children;
};

export default RequireRole;

