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
    totalCredit: 0,
    totalDebit: 0,
    netProfit: 0,
    pendingFundRequests: 0,
    pendingPayouts: 0,
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  
  // Date filter state
  const [dateRange, setDateRange] = useState({
    preset: '15D',
    from: '',
    to: ''
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      let url = '/reports/dashboard';
      const params = new URLSearchParams();
      
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);
      else if (dateRange.preset) {
        const d = new Date();
        if (dateRange.preset === '1D') d.setHours(0, 0, 0, 0);
        else if (dateRange.preset === '7D') d.setDate(d.getDate() - 7);
        else if (dateRange.preset === '15D') d.setDate(d.getDate() - 15);
        params.append('from', d.toISOString());
      }

      const queryString = params.toString();
      const { data } = await api.get(`${url}${queryString ? `?${queryString}` : ''}`);
      if (data.success) {
        setStats(data.stats);
        setChartData(data.stats.chartData || []);
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const handlePresetChange = (preset) => {
    setDateRange({ preset, from: '', to: '' });
  };

  const handleCustomDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value, preset: '' }));
  };

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
    <div className="flex-col gap-4 md:gap-6 space-y-6 md:space-y-8">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 lh-1.2">Welcome back, {user.profile?.ownerName || 'User'}!</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Here is what's happening with your business today.</p>
        </div>
        
        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex bg-gray-50 p-1 rounded-xl">
            {['1D', '7D', '15D'].map(p => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${dateRange.preset === p ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {p === '1D' ? 'Today' : p === '7D' ? '1 Week' : '15 Days'}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-gray-200 hide-mobile"></div>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              name="from"
              value={dateRange.from.split('T')[0]} 
              onChange={handleCustomDateChange}
              className="text-xs border-none bg-gray-50 rounded-lg p-1.5 focus:ring-1 focus:ring-primary/20 w-32" 
            />
            <span className="text-gray-300 text-xs">-</span>
            <input 
              type="date" 
              name="to"
              value={dateRange.to.split('T')[0]} 
              onChange={handleCustomDateChange}
              className="text-xs border-none bg-gray-50 rounded-lg p-1.5 focus:ring-1 focus:ring-primary/20 w-32" 
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Wallet Balance */}
        <div className="card group hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white border border-gray-100">
          <div className="p-4 md:p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Wallet size={20} />
              </div>
              <div className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">Overall</div>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Wallet Balance</h3>
            <div className="text-xl md:text-2xl font-black text-gray-900 mt-1">₹ {Number(stats.totalBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="card group hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white border border-gray-100">
          <div className="p-4 md:p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Period</div>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Net Profit</h3>
            <div className="text-xl md:text-2xl font-black text-emerald-600 mt-1">₹ {Number(stats.netProfit).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
        </div>

        {/* Charges Deducted */}
        <div className="card group hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white border border-gray-100">
          <div className="p-4 md:p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <TrendingDown size={20} />
              </div>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Charges Deducted</h3>
            <div className="text-xl md:text-2xl font-black text-rose-600 mt-1">₹ {Number(stats.totalCharges || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
        </div>

        {/* Total Credit */}
        <div className="card group hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white border border-gray-100">
          <div className="p-4 md:p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-gray-50 text-gray-600 rounded-xl">
                <DollarSign size={20} />
              </div>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Total Credit</h3>
            <div className="text-xl md:text-2xl font-black text-gray-900 mt-1">₹ {Number(stats.totalCredit).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
        </div>

        {/* Total Debit */}
        <div className="card group hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white border border-gray-100">
          <div className="p-4 md:p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                <TrendingDown size={20} />
              </div>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Total Debit</h3>
            <div className="text-xl md:text-2xl font-black text-gray-900 mt-1">₹ {Number(stats.totalDebit).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
        </div>

        {/* Pending Fund Request */}
        <div className="card group hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white border border-gray-100">
          <div className="p-4 md:p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Clock size={20} />
              </div>
              <div className="text-xs font-bold text-amber-600">Pending</div>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Fund Requests</h3>
            <div className="text-xl md:text-2xl font-black text-gray-900 mt-1">{stats.pendingFundRequests}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Analytics Chart */}
        <div className="lg:col-span-2 card">
          <div className="p-4 md:p-6 border-b flex justify-between items-center">
            <div>
              <h2 className="text-base md:text-lg font-bold">Transaction Trends</h2>
              <p className="text-[10px] md:text-xs text-gray-500">
                {dateRange.preset === '1D' ? 'Today\'s activity' : 
                 dateRange.preset === '7D' ? 'Last 7 days' : 
                 dateRange.preset === '15D' ? 'Last 15 days' : 'Custom range summary'}
              </p>
            </div>
            <div className="flex gap-4">
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                <div className="w-2 h-2 rounded-full bg-primary"></div> Volume
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                <div className="w-2 h-2 rounded-full bg-purple-400"></div> Count
              </span>
            </div>
          </div>
          <div className="p-6 h-[320px] w-full relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                  formatter={(value, name) => [name === 'revenue' ? `₹${value}` : value, name === 'revenue' ? 'Volume' : 'Transactions']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="transactions" stroke="#A855F7" strokeWidth={2} fill="transparent" />
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
