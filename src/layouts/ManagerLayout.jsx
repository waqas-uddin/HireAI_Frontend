import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const ManagerLayout = ({ user, userRole, onLogout }) => {
  if (user && userRole !== 'recruiter') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="manager-layout flex">
      <Sidebar user={user} userRole={userRole} onLogout={onLogout} />
      <main className="manager-main flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default ManagerLayout;
