import React, { useState } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, FileText, Send, Building2,
  LogOut, Menu, X, Wallet, Settings
} from 'lucide-react';
import './AppShell.css';

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Fund Requests', path: '/funds', icon: Wallet },
    { name: 'Bank Verification', path: '/bank-verify', icon: Building2 },
    { name: 'Payout', path: '/payout', icon: Send },
    { name: 'Reports', path: '/reports', icon: FileText },
  ];

  // Admin/Super/Distributor can manage users and commissions
  if (['ADMIN', 'SUPER', 'DISTRIBUTOR'].includes(user.role)) {
    navLinks.splice(1, 0, { name: 'User Management', path: '/users', icon: Users });
    navLinks.splice(2, 0, { name: 'Commissions', path: '/commissions', icon: Settings });
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-area">
            <div className="logo-circle">AP</div>
            <span className="brand-name">AbheePay</span>
          </div>
          <button className="mobile-close" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-user-card">
          <div className="user-avatar">{user.profile?.ownerName?.charAt(0) || 'U'}</div>
          <div className="user-info">
            <div className="user-name">{user.profile?.ownerName || 'Unknown User'}</div>
            <div className="user-role badge badge-primary">{user.role}</div>
            <div className="user-wallet">₹ {user.wallet?.balance || '0.00'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon size={18} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={logout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header glass-panel">
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
          
          <div className="header-breadcrumbs">
            <span className="text-muted text-sm">Pages</span>
            <span className="breadcrumb-separator">/</span>
            <span className="text-primary font-medium text-sm">
              {navLinks.find(l => l.path === location.pathname)?.name || 'Page'}
            </span>
          </div>
        </header>

        <div className="page-container animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </div>
  );
}
