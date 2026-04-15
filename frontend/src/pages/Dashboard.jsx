import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Users, Wallet, Activity, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBalance: 0,
    totalTransactions: 0,
    pendingRequests: 0,
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/reports/dashboard');
        if (data.success) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error('Failed to fetch stats', err);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <div>Loading Dashboard...</div>;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS': return <span className="badge badge-success">Success</span>;
      case 'PENDING': return <span className="badge badge-warning">Pending</span>;
      case 'FAILED': return <span className="badge badge-danger">Failed</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl">Overview</h1>
        <div className="text-sm text-muted">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)' }}>
        
        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm text-secondary font-semibold uppercase tracking-wide">Wallet Balance</h3>
            <div className="p-2 bg-primary-light rounded-full text-primary">
              <Wallet size={20} />
            </div>
          </div>
          <div className="text-3xl">₹ {Number(stats.totalBalance).toFixed(2)}</div>
        </div>

        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm text-secondary font-semibold uppercase tracking-wide">Total Users</h3>
            <div className="p-2 bg-primary-light rounded-full text-primary">
              <Users size={20} />
            </div>
          </div>
          <div className="text-3xl">{stats.totalUsers}</div>
        </div>

        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm text-secondary font-semibold uppercase tracking-wide">Total Services</h3>
            <div className="p-2 bg-primary-light rounded-full text-primary">
              <Activity size={20} />
            </div>
          </div>
          <div className="text-3xl">{stats.totalTransactions}</div>
        </div>

        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm text-secondary font-semibold uppercase tracking-wide">Pending Action</h3>
            <div className="p-2 bg-warning-light rounded-full text-warning">
              <Clock size={20} />
            </div>
          </div>
          <div className="text-3xl">{stats.pendingRequests}</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card mt-6">
        <div className="flex justify-between items-center p-5 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
          <h2 className="text-lg">Recent Service Requests</h2>
          <button className="btn btn-outline">
            View All <ArrowRight size={16} />
          </button>
        </div>
        <div className="data-table-container border-none shadow-none rounded-none">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Request By</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="font-medium text-primary">
                    {tx.serviceType.replace('_', ' ')}
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span>{tx.user?.profile?.ownerName || tx.user?.email}</span>
                      <span className="text-xs text-muted">{tx.user?.role}</span>
                    </div>
                  </td>
                  <td className="font-medium">
                    {tx.amount ? `₹ ${Number(tx.amount).toFixed(2)}` : '-'}
                  </td>
                  <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '-'}</td>
                  <td>{getStatusBadge(tx.status)}</td>
                </tr>
              ))}
              {stats.recentTransactions.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                    No recent service requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
