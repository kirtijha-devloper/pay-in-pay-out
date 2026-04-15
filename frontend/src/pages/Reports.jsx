import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, Download, Filter, ArrowDownLeft, ArrowUpRight, 
  Clock, History, List, Users, CreditCard 
} from 'lucide-react';

export default function Reports() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('payout_pending');
  
  const [filters, setFilters] = useState({
    from: '', to: '', userId: '', status: ''
  });

  const reportTabs = [
    { id: 'payout_pending', label: 'Payout Pending', icon: Clock },
    { id: 'payout_history', label: 'Payout History', icon: History },
    { id: 'transaction', label: 'Transaction Report', icon: List },
    { id: 'ledger', label: 'Account Ledger', icon: CreditCard },
    { id: 'retailer', label: 'Retailer Report', icon: Users },
  ];

  if (['ADMIN', 'SUPER'].includes(user.role)) {
    reportTabs.push({ id: 'distributor', label: 'Distributor Report', icon: Users });
  }
  if (user.role === 'ADMIN') {
    reportTabs.push({ id: 'super', label: 'Super Report', icon: Users });
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...filters, type: activeTab });
      const endpoint = activeTab === 'ledger' ? '/reports/ledger' : `/reports/general?${params.toString()}`;
      const { data: res } = await api.get(endpoint);
      if (res.success) {
        setData(res.requests || res.transactions || []);
        setTotal(res.total || 0);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, filters.from, filters.to, filters.status]);

  const renderTable = () => {
    if (activeTab === 'ledger') {
      return (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th>Amount</th>
              <th>After Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.map(txn => (
              <tr key={txn.id}>
                <td className="text-xs text-gray-500">{new Date(txn.createdAt).toLocaleString()}</td>
                <td><span className="font-medium text-sm">{txn.description}</span></td>
                <td><span className={`badge ${txn.type === 'CREDIT' ? 'badge-success' : 'badge-danger'}`}>{txn.type}</span></td>
                <td className={txn.type === 'CREDIT' ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                  {txn.type === 'CREDIT' ? '+' : '-'} ₹{Number(txn.amount).toFixed(2)}
                </td>
                <td className="font-mono text-gray-500">
                  ₹{Number(txn.type === 'CREDIT' ? txn.receiverBalAfter : txn.senderBalAfter).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>ID</th>
            <th>User Details</th>
            <th>Service</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map(req => (
            <tr key={req.id}>
              <td className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</td>
              <td><span className="text-[10px] font-mono font-bold text-gray-400">#{req.id.substring(0, 6)}</span></td>
              <td>
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">{req.user?.profile?.ownerName}</span>
                  <span className="text-[10px] text-gray-400">{req.user?.role}</span>
                </div>
              </td>
              <td className="text-primary font-medium text-xs">{req.serviceType}</td>
              <td className="font-bold">₹{Number(req.amount).toFixed(2)}</td>
              <td>
                <span className={`badge ${req.status === 'SUCCESS' ? 'badge-success' : req.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                  {req.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">System Reports</h1>
          <p className="text-muted text-sm mt-1">Official logs and financial statements (Section 10 Compliant).</p>
        </div>
        <button className="btn btn-outline" onClick={() => window.print()}>
          <Download size={18} /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="card h-fit lg:col-span-1 p-2">
          {reportTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setData([]); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Report Content */}
        <div className="lg:col-span-3 card">
          {/* Filters */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <input 
                type="date" className="py-1 px-3 text-xs" 
                value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})}
              />
              <span className="text-gray-400 text-xs">to</span>
              <input 
                type="date" className="py-1 px-3 text-xs" 
                value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})}
              />
            </div>
            <button onClick={fetchData} className="btn btn-primary py-1 px-4 text-xs ml-auto">
              Refresh
            </button>
          </div>

          <div className="data-table-container border-none shadow-none rounded-none min-h-[400px]">
            {loading ? (
              <div className="p-20 text-center text-gray-400 animate-pulse">Loading report data...</div>
            ) : data.length === 0 ? (
              <div className="p-20 text-center text-gray-400">No records found for this category.</div>
            ) : (
              renderTable()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
