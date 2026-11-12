import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requireApproved = true
}: { 
  children: React.ReactNode; 
  allowedRoles?: Role[];
  requireApproved?: boolean;
}) {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return null;

  if (!currentUser || !userData) {
    return <Navigate to="/login" replace />;
  }

  if (requireApproved && userData.status !== 'approved') {
    return <Navigate to="/pending" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userData.role)) {
    return <Navigate to="/" replace />; // unauthorized
  }

  return <>{children}</>;
}
