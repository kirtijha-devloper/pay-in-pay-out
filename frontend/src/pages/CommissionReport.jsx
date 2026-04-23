import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Filter, FileText, User, ArrowRight } from 'lucide-react';

const ROLE_LABELS = {
  ADMIN: 'Admin',
  SUPER: 'Super Distributor',
  DISTRIBUTOR: 'Distributor',
  RETAILER: 'Retailer',
};

const SERVICE_LABELS = {
  PAYOUT: 'Payout',
  FUND_REQUEST: 'Fund Request',
  BANK_VERIFICATION: 'Bank Verify',
};

export default function CommissionReport() {
  const { user } = useAuth();
  const [data, setData] = useState({ requests: [], total: 0, users: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/reports/commissions?page=${page}&limit=10`);
      if (res.success) {
        setData(res);
        setTotalPages(Math.ceil(res.total / 10) || 1);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const findUser = (id) => data.users.find(u => u.id === id);

  const renderDistribution = (req) => {
    const distStr = req.chargeDistribution;
    const chargeAmount = Number(req.chargeAmount || 0);

    if (!distStr) {
      if (chargeAmount > 0) {
        return (
          <div className="flex flex-wrap gap-2">
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 flex flex-col min-w-[100px]">
              <span className="text-[10px] font-bold text-gray-500 uppercase">System</span>
              <span className="text-xs font-semibold text-gray-900">Admin</span>
              <span className="text-[11px] text-emerald-600 font-mono">+₹{chargeAmount.toFixed(2)}</span>
            </div>
          </div>
        );
      }
      return <span className="text-gray-400 text-xs italic">No charge applied</span>;
    }

    try {
      const dist = JSON.parse(distStr);
      if (!Array.isArray(dist) || dist.length === 0) {
        if (chargeAmount > 0) {
          return (
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 flex flex-col min-w-[100px]">
              <span className="text-[10px] font-bold text-gray-500 uppercase">System</span>
              <span className="text-xs font-semibold text-gray-900">Admin</span>
              <span className="text-[11px] text-emerald-600 font-mono">+₹{chargeAmount.toFixed(2)}</span>
            </div>
          );
        }
        return <span className="text-gray-400 text-xs italic">No charge applied</span>;
      }

      return (
        <div className="flex flex-wrap gap-x-3 gap-y-2 items-center">
          {dist.map((entry, idx) => {
            const receiver = findUser(entry.receiverId);
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ArrowRight size={12} className="text-gray-300" />}
                <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 flex flex-col shadow-sm min-w-[110px]">
                  <span className="text-[9px] font-bold text-primary uppercase tracking-tighter">
                    {receiver ? ROLE_LABELS[receiver.role] : 'Admin'}
                  </span>
                  <span className="text-[11px] font-bold text-gray-800 truncate max-w-[100px]">
                    {receiver ? (receiver.profile?.ownerName || receiver.email.split('@')[0]) : 'System Admin'}
                  </span>
                  <span className="text-xs text-emerald-600 font-bold mt-0.5">
                    +₹{Number(entry.amount).toFixed(2)}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      );
    } catch (e) {
      return <span className="text-red-400 text-xs italic">Distribution error</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Commission Ledger</h1>
          <p className="text-muted text-sm mt-1">Track how charges are distributed across the hierarchy.</p>
        </div>
        <button onClick={fetchData} className="btn btn-outline flex items-center gap-2">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="data-table-container border-none shadow-none rounded-none">
          <table className="data-table">
            <thead>
              <tr>
                <th>Txn Info</th>
                <th>Requested By</th>
                <th>Total Charge</th>
                <th>Profit Distribution (Who earned what?)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="text-center py-10">Loading...</td></tr>
              ) : data.requests.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-10">No commission records found.</td></tr>
              ) : (
                data.requests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{SERVICE_LABELS[req.serviceType] || req.serviceType}</span>
                        <span className="text-[10px] text-gray-400 font-mono uppercase">#{req.id.substring(0, 8)}</span>
                        <span className="text-[11px] text-gray-500">{new Date(req.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-full">
                          <User size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{req.user?.profile?.ownerName || req.user?.email}</span>
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded self-start font-bold uppercase">
                            {ROLE_LABELS[req.user?.role] || req.user?.role}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-red-600">-₹{Number(req.chargeAmount).toFixed(2)}</span>
                        <span className="text-[10px] text-gray-400">Total Deducted</span>
                      </div>
                    </td>
                    <td>
                      {renderDistribution(req)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Prev</button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
