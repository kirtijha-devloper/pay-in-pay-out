import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Building2, 
  Calendar, 
  RefreshCw,
  Wallet as WalletIcon,
  ChevronRight,
  MoreVertical,
  Download
} from 'lucide-react';

function RequestModal({ isOpen, onClose, onSaved, bankAccounts }) {
  const [formData, setFormData] = useState({
    amount: '',
    bankAccountId: '',
    bankRef: '',
    paymentMode: 'IMPS',
    paymentDate: new Date().toISOString().split('T')[0],
    remark: '',
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setLoading(false);
      setReceiptFile(null);
      setFormData({
        amount: '',
        bankAccountId: bankAccounts[0]?.id || '',
        bankRef: '',
        paymentMode: 'IMPS',
        paymentDate: new Date().toISOString().split('T')[0],
        remark: '',
      });
    }
  }, [isOpen]); // Only reset when opening

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = new FormData();
      payload.append('amount', formData.amount);
      payload.append('bankAccountId', formData.bankAccountId);
      payload.append('bankRef', formData.bankRef);
      payload.append('paymentMode', formData.paymentMode);
      payload.append('paymentDate', formData.paymentDate);
      payload.append('remark', formData.remark);
      if (receiptFile) payload.append('receipt', receiptFile);

      const response = await api.post('/services/fund-request', payload);
      if (response.data.success) {
        onSaved();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to submit fund request');
    }
    setLoading(false);
  };

  const selectedAccount = bankAccounts.find((a) => a.id === formData.bankAccountId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl relative animate-slide-up overflow-hidden border border-gray-100">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase">New Fund Request</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Transfer funds to wallet</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 animate-shake text-[10px] font-bold uppercase">
              <XCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group md:col-span-2">
                <label className="form-label text-[10px] mb-1">Transfer Amount</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-900 font-black text-lg pointer-events-none">₹</div>
                  <input
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="form-input pl-10 text-xl font-black h-14 bg-gray-50/50 border-gray-100 focus:bg-white"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label text-[10px] mb-1">Deposit To Account</label>
                <select
                  required
                  value={formData.bankAccountId}
                  onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                  className="form-input h-12 bg-gray-50/50 border-gray-100 focus:bg-white text-sm font-bold"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} (****{String(acc.accountNumber).slice(-4)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedAccount && (
                <div className="md:col-span-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50/30 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Account Holder</p>
                      <p className="text-xs font-black text-gray-800">{selectedAccount.accountHolderName}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">IFSC Code</p>
                      <p className="text-xs font-black text-gray-800 font-mono">{selectedAccount.ifscCode}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Account Number</p>
                      <p className="text-sm font-black text-primary font-mono tracking-wider">{selectedAccount.accountNumber}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label text-[10px] mb-1">Mode</label>
                <select
                  value={formData.paymentMode}
                  onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                  className="form-input h-12 bg-gray-50/50 border-gray-100 text-xs font-bold"
                >
                  <option value="IMPS">IMPS</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label text-[10px] mb-1">UTR / Ref Number</label>
                <input
                  type="text"
                  required
                  value={formData.bankRef}
                  onChange={(e) => setFormData({ ...formData, bankRef: e.target.value })}
                  placeholder="Reference #"
                  className="form-input h-12 bg-gray-50/50 border-gray-100 text-xs font-bold font-mono"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label text-[10px] mb-1">Proof of Deposit</label>
              <div className="relative group">
                <input
                  type="file"
                  required
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="form-input h-12 opacity-0 absolute inset-0 cursor-pointer z-10"
                />
                <div className="form-input h-12 flex items-center justify-between px-4 bg-gray-50/50 border-gray-100 group-hover:border-primary/30 transition-all">
                  <span className="text-[10px] font-bold text-gray-500 truncate">
                    {receiptFile ? receiptFile.name : 'Click to upload receipt...'}
                  </span>
                  <Plus size={16} className="text-gray-400" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-premium btn-premium-primary w-full py-4 shadow-xl text-xs tracking-widest font-black"
            >
              {loading ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                'SUBMIT REQUEST'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


export default function FundRequests() {
  const { user } = useAuth();
  const isAdmin = ['ADMIN', 'SUPER', 'DISTRIBUTOR'].includes(user.role);
  const [requests, setRequests] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null);

  const fetchAll = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [reqRes, bankRes] = await Promise.all([
        api.get(`/services?serviceType=FUND_REQUEST${filter ? `&status=${filter}` : ''}`),
        api.get('/services/bank-accounts'),
      ]);
      setRequests(reqRes.data.success ? reqRes.data.requests : []);
      setBankAccounts(bankRes.data.success ? bankRes.data.accounts : []);
    } catch (err) {
      setError('Unable to load fund requests');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => fetchAll(false), 10000); // Polling every 10s (silent)
    return () => clearInterval(interval);
  }, [filter]);

  const approveRequest = async (id) => {
    if (actionInProgress) return;
    if (!window.confirm('Approve this fund request?')) return;
    setActionInProgress(id);
    try {
      await api.patch(`/services/fund-request/${id}/approve`);
      await fetchAll(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Error processing request');
    } finally {
      setActionInProgress(null);
    }
  };

  const rejectRequest = async (id) => {
    if (actionInProgress) return;
    if (!window.confirm('Reject this fund request?')) return;
    setActionInProgress(id);
    try {
      await api.patch(`/services/fund-request/${id}/reject`);
      await fetchAll(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Error processing request');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">FUND REQUESTS</h1>
          <p className="text-gray-400 font-medium mt-1 uppercase text-xs tracking-widest">Manage your wallet deposits</p>
        </div>
        {!isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-premium btn-premium-primary flex items-center justify-center gap-3 px-8 py-4 shadow-xl"
          >
            <Plus size={20} />
            <span>ADD NEW FUNDS</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-2 flex flex-wrap items-center gap-2 max-w-max">
        {['PENDING', 'SUCCESS', 'FAILED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              filter === s 
                ? 'bg-gray-900 text-white shadow-lg scale-105' 
                : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table Section */}
      <div className="glass-panel overflow-hidden border border-gray-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">User / Date</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Info</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reference</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                {isAdmin && filter === 'PENDING' && (
                  <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <RefreshCw className="animate-spin text-primary" size={32} />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fetching Requests...</span>
                    </div>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <Clock size={48} />
                      <span className="text-[10px] font-black uppercase tracking-widest">No Requests Found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black">
                          {r.user?.profile?.ownerName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 tracking-tight">
                            {r.user?.profile?.ownerName || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar size={10} className="text-gray-400" />
                            <p className="text-[10px] font-bold text-gray-400">
                              {new Date(r.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <p className="text-lg font-black text-gray-900 tracking-tighter">
                        ₹ {Number(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                      {r.creditedAmount && (
                        <p className="text-[9px] font-black text-emerald-500 mt-1 uppercase">
                          Credited: ₹{Number(r.creditedAmount).toFixed(2)}
                        </p>
                      )}
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Building2 size={12} className="text-gray-400" />
                          <span className="text-[11px] font-black text-gray-700 uppercase">{r.paymentMode}</span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 truncate max-w-[150px]">
                          {r.companyBankAccount?.bankName || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <p className="text-xs font-mono font-bold text-gray-900 uppercase tracking-tighter bg-gray-100 px-2 py-1 rounded">
                          {r.bankRef || 'N/A'}
                        </p>
                        {r.receiptPath && (
                          <a
                            href={`${getApiOrigin()}/${r.receiptPath.replace(/\\/g, '/')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-gray-50 text-gray-400 hover:bg-primary hover:text-white rounded-xl transition-all"
                            title="View Receipt"
                          >
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className={`inline-flex px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        r.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' :
                        r.status === 'FAILED' ? 'bg-red-50 text-red-600' :
                        'bg-orange-50 text-orange-600 animate-pulse'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    {isAdmin && filter === 'PENDING' && (
                      <td className="p-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => approveRequest(r.id)}
                            disabled={actionInProgress === r.id}
                            className="p-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-2xl transition-all disabled:opacity-50"
                            title="Approve"
                          >
                            {actionInProgress === r.id ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                          </button>
                          <button
                            onClick={() => rejectRequest(r.id)}
                            disabled={actionInProgress === r.id}
                            className="p-3 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl transition-all disabled:opacity-50"
                            title="Reject"
                          >
                            {actionInProgress === r.id ? <RefreshCw className="animate-spin" size={16} /> : <XCircle size={16} />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RequestModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSaved={() => fetchAll(false)} 
        bankAccounts={bankAccounts} 
      />
    </div>
  );
}

const getApiOrigin = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};
