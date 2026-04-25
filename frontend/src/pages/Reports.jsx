import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, Download, Filter, ArrowDownLeft, ArrowUpRight, 
  Clock, History, List, Users, CreditCard, RefreshCw 
} from 'lucide-react';
import UserSearch from '../components/common/UserSearch';

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
    reportTabs.push({ id: 'super', label: 'Super Distributor Report', icon: Users });
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
  }, [activeTab, filters.from, filters.to, filters.status, filters.userId]);

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

  const downloadCSV = () => {
    if (!data || data.length === 0) return alert('No data to export');
    
    let csvContent = "";
    
    if (activeTab === 'ledger') {
      csvContent += "Date,Description,Type,Amount,After Balance\n";
      data.forEach(txn => {
        const date = new Date(txn.createdAt).toLocaleString().replace(/,/g, ' ');
        const desc = (txn.description || '').replace(/,/g, ' ');
        const type = txn.type;
        const amount = Number(txn.amount).toFixed(2);
        const bal = Number(txn.type === 'CREDIT' ? txn.receiverBalAfter : txn.senderBalAfter).toFixed(2);
        csvContent += `${date},${desc},${type},${amount},${bal}\n`;
      });
    } else {
      csvContent += "Date,ID,User,Role,Service,Amount,Status\n";
      data.forEach(req => {
        const date = new Date(req.createdAt).toLocaleDateString().replace(/,/g, ' ');
        const id = req.id;
        const user = (req.user?.profile?.ownerName || '').replace(/,/g, ' ');
        const role = req.user?.role || '';
        const service = req.serviceType || '';
        const amount = Number(req.amount).toFixed(2);
        const status = req.status;
        csvContent += `${date},${id},${user},${role},${service},${amount},${status}\n`;
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `report_${activeTab}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-8 animate-slide-up">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">System Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Comprehensive financial logs and transaction histories.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-premium btn-premium-secondary" onClick={downloadCSV}>
            <FileText size={18} />
            Export CSV
          </button>
          <button className="btn-premium btn-premium-primary" onClick={() => window.print()}>
            <Download size={18} />
            Export PDF
          </button>
        </div>
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
          <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center bg-white">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                <Filter size={16} className="text-gray-400" />
                <input 
                  type="date" className="bg-transparent border-none text-xs focus:ring-0 p-0" 
                  value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})}
                />
                <span className="text-gray-300 text-[10px] font-bold uppercase">To</span>
                <input 
                  type="date" className="bg-transparent border-none text-xs focus:ring-0 p-0" 
                  value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})}
                />
              </div>
            </div>

            <div className="flex-1 max-w-xs">
              <UserSearch 
                onSelect={(u) => setFilters({...filters, userId: u?.id || ''})}
                placeholder="Filter by user..."
                className="h-9"
              />
            </div>

            <button 
              onClick={fetchData} 
              disabled={loading}
              className="btn-premium btn-premium-secondary h-9 px-4 ml-auto"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="ml-2">Refresh</span>
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
