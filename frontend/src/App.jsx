import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import Commissions from './pages/Commissions';
import Wallet from './pages/Wallet';
import BankVerify from './pages/BankVerify';
import Payout from './pages/Payout';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

// Placeholder Pages
const Placeholder = ({ title }) => (
  <div className="card p-6">
    <h2>{title}</h2>
    <p className="text-muted mt-2">This module is under construction.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/funds" element={<Wallet />} />
            <Route path="/bank-verify" element={<BankVerify />} />
            <Route path="/payout" element={<Payout />} />
            <Route path="/commissions" element={<Commissions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
