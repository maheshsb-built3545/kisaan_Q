import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import RequireRole from './RequireRole';
import { PageErrorBoundary } from '../components/common/ErrorBoundary';

// Public & Common Pages
import Landing from '../pages/Landing';
import NotFound from '../pages/NotFound';

// Farmer Experience Pages
import FarmerLogin from '../pages/FarmerLogin';
import OTPVerify from '../pages/OTPVerify';
import FarmerCommandCenter from '../pages/FarmerCommandCenter';

// Staff Operations Pages
import StaffLogin from '../pages/StaffLogin';
import StaffDesk from '../pages/StaffDesk';
import SupervisorExceptions from '../pages/SupervisorExceptions';
import AdminDashboard from '../pages/AdminDashboard';

export const AppRoutes = () => {
  const location = useLocation();

  return (
    <Routes>
      {/* Landing Portal */}
      <Route
        path="/"
        element={
          <PageErrorBoundary title="Landing Page" resetKey={location.pathname}>
            <Landing />
          </PageErrorBoundary>
        }
      />

      {/* Farmer Journey Routes */}
      <Route
        path="/farmer-login"
        element={
          <PageErrorBoundary title="Farmer Login" resetKey={location.pathname}>
            <FarmerLogin />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/farmer/login"
        element={
          <PageErrorBoundary title="Farmer Login" resetKey={location.pathname}>
            <FarmerLogin />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/otp-verify"
        element={
          <PageErrorBoundary title="OTP Verification" resetKey={location.pathname}>
            <OTPVerify />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/farmer/verify"
        element={
          <PageErrorBoundary title="OTP Verification" resetKey={location.pathname}>
            <OTPVerify />
          </PageErrorBoundary>
        }
      />

      {/* Unified Farmer Command Center (Mandi discovery, slot booking, live token HUD) */}
      <Route
        path="/mandi-selection"
        element={
          <RequireAuth>
            <PageErrorBoundary title="Farmer Command Center" resetKey={location.pathname}>
              <FarmerCommandCenter />
            </PageErrorBoundary>
          </RequireAuth>
        }
      />
      <Route
        path="/farmer/mandis"
        element={
          <RequireAuth>
            <PageErrorBoundary title="Farmer Command Center" resetKey={location.pathname}>
              <FarmerCommandCenter />
            </PageErrorBoundary>
          </RequireAuth>
        }
      />

      <Route
        path="/book-slot"
        element={
          <RequireAuth>
            <PageErrorBoundary title="Farmer Command Center" resetKey={location.pathname}>
              <FarmerCommandCenter />
            </PageErrorBoundary>
          </RequireAuth>
        }
      />
      <Route
        path="/farmer/book"
        element={
          <RequireAuth>
            <PageErrorBoundary title="Farmer Command Center" resetKey={location.pathname}>
              <FarmerCommandCenter />
            </PageErrorBoundary>
          </RequireAuth>
        }
      />

      <Route
        path="/live-token"
        element={
          <RequireAuth>
            <PageErrorBoundary title="Farmer Command Center" resetKey={location.pathname}>
              <FarmerCommandCenter />
            </PageErrorBoundary>
          </RequireAuth>
        }
      />
      <Route
        path="/farmer/token"
        element={
          <RequireAuth>
            <PageErrorBoundary title="Farmer Command Center" resetKey={location.pathname}>
              <FarmerCommandCenter />
            </PageErrorBoundary>
          </RequireAuth>
        }
      />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <PageErrorBoundary title="Farmer Command Center" resetKey={location.pathname}>
              <FarmerCommandCenter />
            </PageErrorBoundary>
          </RequireAuth>
        }
      />

      <Route
        path="/farmer/command-center"
        element={
          <RequireAuth>
            <PageErrorBoundary title="Farmer Command Center" resetKey={location.pathname}>
              <FarmerCommandCenter />
            </PageErrorBoundary>
          </RequireAuth>
        }
      />

      {/* Legacy dashboard redirect */}
      <Route
        path="/dashboard/legacy"
        element={<Navigate to="/farmer/command-center" replace />}
      />

      {/* Staff Operations Routes */}
      <Route
        path="/staff-login"
        element={
          <PageErrorBoundary title="Staff Authentication" resetKey={location.pathname}>
            <StaffLogin />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/staff/login"
        element={
          <PageErrorBoundary title="Staff Authentication" resetKey={location.pathname}>
            <StaffLogin />
          </PageErrorBoundary>
        }
      />

      {/* Unified Staff Operations Desk (Desks 1-5) */}
      <Route
        path="/guard-terminal"
        element={
          <RequireRole allowedRoles={['operator', 'staff', 'supervisor', 'security_gate', 'quality_assayer', 'weighmaster', 'procurement', 'accounts_settlement', 'district_admin']}>
            <PageErrorBoundary title="Staff Operations Desk" resetKey={location.pathname}>
              <StaffDesk />
            </PageErrorBoundary>
          </RequireRole>
        }
      />
      <Route
        path="/staff/guard"
        element={
          <RequireRole allowedRoles={['operator', 'staff', 'supervisor', 'security_gate', 'quality_assayer', 'weighmaster', 'procurement', 'accounts_settlement', 'district_admin']}>
            <PageErrorBoundary title="Staff Operations Desk" resetKey={location.pathname}>
              <StaffDesk />
            </PageErrorBoundary>
          </RequireRole>
        }
      />

      <Route
        path="/weighmaster-desk"
        element={
          <RequireRole allowedRoles={['operator', 'staff', 'supervisor', 'security_gate', 'quality_assayer', 'weighmaster', 'procurement', 'accounts_settlement', 'district_admin']}>
            <PageErrorBoundary title="Staff Operations Desk" resetKey={location.pathname}>
              <StaffDesk />
            </PageErrorBoundary>
          </RequireRole>
        }
      />
      <Route
        path="/staff/weighmaster"
        element={
          <RequireRole allowedRoles={['operator', 'staff', 'supervisor', 'security_gate', 'quality_assayer', 'weighmaster', 'procurement', 'accounts_settlement', 'district_admin']}>
            <PageErrorBoundary title="Staff Operations Desk" resetKey={location.pathname}>
              <StaffDesk />
            </PageErrorBoundary>
          </RequireRole>
        }
      />

      <Route
        path="/supervisor-exceptions"
        element={
          <RequireRole allowedRoles={['supervisor', 'district_admin']}>
            <PageErrorBoundary title="Supervisor Exception Terminal" resetKey={location.pathname}>
              <SupervisorExceptions />
            </PageErrorBoundary>
          </RequireRole>
        }
      />
      <Route
        path="/staff/supervisor"
        element={
          <RequireRole allowedRoles={['supervisor', 'district_admin']}>
            <PageErrorBoundary title="Supervisor Exception Terminal" resetKey={location.pathname}>
              <SupervisorExceptions />
            </PageErrorBoundary>
          </RequireRole>
        }
      />

      <Route
        path="/admin-dashboard/desk"
        element={
          <PageErrorBoundary title="Staff Operations Desk" resetKey={location.pathname}>
            <StaffDesk />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/staff/desk"
        element={
          <PageErrorBoundary title="Staff Operations Desk" resetKey={location.pathname}>
            <StaffDesk />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/admin-desk"
        element={
          <PageErrorBoundary title="Staff Operations Desk" resetKey={location.pathname}>
            <StaffDesk />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/admin-dashboard"
        element={
          <PageErrorBoundary title="Admin Analytics Dashboard" resetKey={location.pathname}>
            <AdminDashboard />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/admin"
        element={
          <PageErrorBoundary title="Admin Analytics Dashboard" resetKey={location.pathname}>
            <AdminDashboard />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <PageErrorBoundary title="Admin Analytics Dashboard" resetKey={location.pathname}>
            <AdminDashboard />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/staff/admin"
        element={
          <PageErrorBoundary title="Admin Analytics Dashboard" resetKey={location.pathname}>
            <AdminDashboard />
          </PageErrorBoundary>
        }
      />

      {/* Catch-all 404 Route */}
      <Route
        path="*"
        element={
          <PageErrorBoundary title="Page Not Found" resetKey={location.pathname}>
            <NotFound />
          </PageErrorBoundary>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
