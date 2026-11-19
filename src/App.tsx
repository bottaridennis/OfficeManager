/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OnboardingProvider } from './contexts/OnboardingContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import Login from './pages/Login';
import PendingApproval from './pages/PendingApproval';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetails from './pages/DeviceDetails';
import Users from './pages/Users';
import UserDetails from './pages/UserDetails';
import Tickets from './pages/Tickets';
import Consumables from './pages/Consumables';
import Licenses from './pages/Licenses';
import Loans from './pages/Loans';
import Logs from './pages/Logs';
import QATesting from './pages/QATesting';
import Layout from './components/Layout';
import MyInventory from './pages/MyInventory';
import NotificationSystem from './components/NotificationSystem';

export default function App() {
  return (
    <AuthProvider>
      <NotificationSystem />
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <OnboardingProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/pending" element={
              <ProtectedRoute requireApproved={false}>
                <PendingApproval />
              </ProtectedRoute>
            } />
            
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="my-inventory" element={<MyInventory />} />
              <Route path="devices" element={<Devices />} />
              <Route path="devices/:id" element={<DeviceDetails />} />
              <Route path="consumables" element={<Consumables />} />
              <Route path="licenses" element={<Licenses />} />
              <Route path="loans" element={<Loans />} />
              <Route path="users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="users/:id" element={
                <ProtectedRoute allowedRoles={['admin', 'tecnico', 'utente']}>
                  <UserDetails />
                </ProtectedRoute>
              } />
              <Route path="tickets" element={<Tickets />} />
              <Route path="qa-testing" element={
                <ProtectedRoute allowedRoles={['admin', 'tecnico']}>
                  <QATesting />
                </ProtectedRoute>
              } />
              <Route path="logs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Logs />
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
        </OnboardingProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
