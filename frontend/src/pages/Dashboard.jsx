import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Users, Wallet, Activity, Clock, ArrowRight, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

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

  // Sample data for charts (in a real app, this would come from the API)
  const chartData = [
    { name: 'Mon', revenue: 4000, transactions: 24 },
    { name: 'Tue', revenue: 3000, transactions: 18 },
    { name: 'Wed', revenue: 2000, transactions: 12 },
    { name: 'Thu', revenue: 2780, transactions: 20 },
    { name: 'Fri', revenue: 1890, transactions: 15 },
    { name: 'Sat', revenue: 2390, transactions: 22 },
    { name: 'Sun', revenue: 3490, transactions: 26 },
  ];

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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted font-medium">Loading your dashboard...</p>
      </div>
    </div>
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS': return <span className="badge badge-success">Success</span>;
      case 'PENDING': return <span className="badge badge-warning">Pending</span>;
      case 'FAILED': return <span className="badge badge-danger">Failed</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="flex-col gap-6 space-y-8">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 lh-1.2">Welcome back, {user.profile?.ownerName || 'User'}!</h1>
          <p className="text-gray-500 mt-1">Here is what's happening with your business today.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm font-medium shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          System Live: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-all group-hover:bg-primary/10"></div>
          <div className="p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Wallet size={24} />
              </div>
              <TrendingUp size={20} className="text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Wallet Balance</h3>
            <div className="text-2xl font-black text-gray-900 mt-1">₹ {Number(stats.totalBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
        </div>

        <div className="card group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full -mr-16 -mt-16 transition-all group-hover:bg-emerald-100/50"></div>
          <div className="p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Users size={24} />
              </div>
            </div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Downline</h3>
            <div className="text-2xl font-black text-gray-900 mt-1">{stats.totalUsers} <span className="text-xs font-normal text-gray-400 ml-1">accounts</span></div>
          </div>
        </div>

        <div className="card group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50/50 rounded-full -mr-16 -mt-16 transition-all group-hover:bg-purple-100/50"></div>
          <div className="p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                <Activity size={24} />
              </div>
            </div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Service Requests</h3>
            <div className="text-2xl font-black text-gray-900 mt-1">{stats.totalTransactions}</div>
          </div>
        </div>

        <div className="card group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50/50 rounded-full -mr-16 -mt-16 transition-all group-hover:bg-amber-100/50"></div>
          <div className="p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Clock size={24} />
              </div>
            </div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Pending Action</h3>
            <div className="text-2xl font-black text-gray-900 mt-1">{stats.pendingRequests}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Analytics Chart */}
        <div className="lg:col-span-2 card">
          <div className="p-6 border-b flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold">Transaction Trends</h2>
              <p className="text-xs text-gray-500">Weekly business volume analysis</p>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                <div className="w-2 h-2 rounded-full bg-primary"></div> Revenue
              </span>
            </div>
          </div>
          <div className="p-6 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94A3B8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94A3B8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Service Requests */}
        <div className="card overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50/30">
            <h2 className="text-lg font-bold">Recent Requests</h2>
            <Link to="/reports" className="text-xs font-bold text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recentTransactions.length === 0 ? (
              <div className="p-10 text-center text-gray-400 italic text-sm">No recent activity</div>
            ) : (
              stats.recentTransactions.map((tx) => (
                <div key={tx.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${tx.serviceType === 'PAYOUT' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                        {tx.serviceType === 'PAYOUT' ? <DollarSign size={16} /> : <TrendingUp size={16} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">{tx.serviceType.replace('_', ' ')}</div>
                        <div className="text-[10px] text-gray-500">{tx.user?.profile?.ownerName || tx.user?.email} • {new Date(tx.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-gray-900">{tx.amount ? `₹${Number(tx.amount).toFixed(2)}` : '-'}</div>
                      <div className="mt-1">{getStatusBadge(tx.status)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
