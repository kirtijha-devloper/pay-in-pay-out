import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  Send,
  Building2,
  LogOut,
  Menu,
  X,
  Wallet,
  Settings,
  ShieldCheck,
  Banknote,
  Coins,
  Bell,
} from 'lucide-react';
import api from '../../lib/api';
import NotificationPanel from '../notifications/NotificationPanel';
import './AppShell.css';

export default function AppShell() {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const normalizedPath = location.pathname;
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const { data } = await api.get('/notifications');
      if (data.success) {
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications unread count:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    ...(user.role !== 'RETAILER' ? [
      { name: 'Charges', path: '/commissions', icon: Settings },
      { name: 'Commissions', path: '/commission-report', icon: Coins },
    ] : []),
    { name: 'Wallet', path: '/wallet', icon: Wallet },
    // { name: 'KYC Verification', path: '/kyc-verification', icon: ShieldCheck },
    { name: 'Fund Requests', path: '/funds', icon: Banknote },
    { name: 'Bank Verification', path: '/bank-verify', icon: Building2 },
    { name: 'Payout', path: '/payout', icon: Send },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  if (['ADMIN', 'SUPER', 'DISTRIBUTOR'].includes(user.role)) {
    // Insert User Management after Dashboard if it's missing or after Charges/Commissions
    const insertIdx = user.role === 'RETAILER' ? 1 : 3;
    navLinks.splice(insertIdx, 0, { name: 'User Management', path: '/users', icon: Users });
  }

  useEffect(() => {
    refreshUser();
    const pageName = navLinks.find((l) => l.path === normalizedPath)?.name || 'Page';
    document.title = `${pageName} | Payverse`;
  }, [location.pathname, refreshUser]);

  useEffect(() => {
    const handleFocus = () => refreshUser();
    const handleWalletUpdate = () => refreshUser();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('wallet-balance-updated', handleWalletUpdate);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('wallet-balance-updated', handleWalletUpdate);
    };
  }, [refreshUser]);

  return (
    <div className="app-layout">
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-area">
            <div className="logo-circle">PV</div>
            <span className="brand-name">Payverse</span>
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
            { !['ADMIN', 'SUPER'].includes(user.role) && (
              <div className="user-wallet">₹ {Number(user.wallet?.balance || 0).toFixed(2)}</div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = normalizedPath === link.path;
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

      <main className="main-content">
        <header className="top-header glass-panel">
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>

          <div className="header-breadcrumbs">
            <span className="text-muted text-sm font-semibold">Payverse</span>
            <span className="breadcrumb-separator">/</span>
            <span className="text-primary font-medium text-sm">
              {navLinks.find((l) => l.path === normalizedPath)?.name || 'Page'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors relative text-gray-600"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {isNotificationsOpen && (
                <NotificationPanel 
                  onClose={() => setIsNotificationsOpen(false)} 
                  onReadUpdate={setUnreadCount}
                />
              )}
            </div>
          </div>
        </header>

        <div className="page-container animate-fade-in">
          <Outlet />
        </div>
      </main>

      {isMobileMenuOpen && <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} />}
    </div>
  );
}
