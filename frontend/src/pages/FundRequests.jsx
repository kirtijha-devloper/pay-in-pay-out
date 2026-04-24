import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react';

const REQUEST_STATUS_OPTIONS = ['PENDING', 'SUCCESS', 'FAILED'];

function formatAmount(value) {
  return `₹ ${Number(value || 0).toFixed(2)}`;
}

function resolveUploadUrl(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const baseUrl = getApiOrigin();
  return `${baseUrl}/${String(filePath).replace(/^\/+/, '')}`;
}

function formatParty(user) {
  if (!user) return 'Unknown';
  return user.profile?.ownerName || user.profile?.shopName || user.email;
}

function StatusBadge({ status }) {
  const classes =
    status === 'SUCCESS' ? 'badge-success' : status === 'FAILED' ? 'badge-danger' : 'badge-warning';
  return <span className={`badge ${classes}`}>{status}</span>;
}

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
    if (!isOpen) return;
    setError('');
    setLoading(false);
    setReceiptFile(null);
    setFormData((current) => ({
      ...current,
      amount: '',
      bankAccountId: bankAccounts[0]?.id || '',
      bankRef: '',
    }));
  }, [bankAccounts, isOpen]);

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
      setError(err.response?.data?.message || 'Unable to submit wallet request');
    }
    setLoading(false);
  };

  const selectedAccount = bankAccounts.find((a) => a.id === formData.bankAccountId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl relative animate-zoom-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight">ADD FUNDS</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">Direct Bank Deposit</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-600 border border-red-100 animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Transfer Amount</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-900 font-black text-lg pointer-events-none">₹</div>
                <input
                  type="number"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-10 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl text-xl font-black transition-all outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Account Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Deposit To</label>
              <select
                required
                value={formData.bankAccountId}
                onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                className="w-full px-4 py-4 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none appearance-none cursor-pointer"
              >
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} (****{String(acc.accountNumber).slice(-4)})
                  </option>
                ))}
              </select>
            </div>

            {/* Info Card */}
            {selectedAccount && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-center opacity-40">
                  <span className="text-[10px] font-black uppercase tracking-widest">Bank Details</span>
                  <Building2 size={14} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Bank Name</p>
                    <p className="text-xs font-black text-gray-900">{selectedAccount.bankName}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Holder Name</p>
                    <p className="text-xs font-black text-gray-900 truncate">{selectedAccount.accountHolderName}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Account No</p>
                    <p className="text-xs font-black text-gray-900 font-mono tracking-tighter">{selectedAccount.accountNumber}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">IFSC Code</p>
                    <p className="text-xs font-black text-gray-900 font-mono tracking-tighter">{selectedAccount.ifscCode}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Mode & UTR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Payment Mode</label>
                <select
                  value={formData.paymentMode}
                  onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                >
                  <option value="IMPS">IMPS</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI / GPay</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">UTR Number</label>
                <input
                  type="text"
                  required
                  value={formData.bankRef}
                  onChange={(e) => setFormData({ ...formData, bankRef: e.target.value })}
                  placeholder="Enter reference"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                />
              </div>
            </div>

            {/* Proof */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Proof Receipt (Image)</label>
              <div className="relative">
                <input
                  type="file"
                  required
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-200 hover:border-primary rounded-xl text-[10px] font-bold text-gray-400 cursor-pointer transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                'SUBMIT REQUEST'
              )}
            </button>
            
            <button type="button" onClick={onClose} className="w-full text-center text-[10px] font-black text-gray-400 uppercase tracking-widest py-2 hover:text-gray-600">
              Cancel Transfer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


export default function FundRequests() {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [requests, setRequests] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    setLoading(true);
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

  useEffect(() => { fetchAll(); }, [filter]);

  const [actionInProgress, setActionInProgress] = useState(null);

  const approveRequest = async (id) => {
    if (actionInProgress) return;
    setActionInProgress(id);
    try {
      await api.patch(`/services/fund-request/${id}/approve`);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error processing request');
    } finally {
      setActionInProgress(null);
    }
  };

  const rejectRequest = async (id) => {
    if (actionInProgress) return;
    setActionInProgress(id);
    try {
      await api.patch(`/services/fund-request/${id}/reject`);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error processing request');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Fund Requests</h1>
          <p className="text-muted text-sm mt-1">
            {isAdmin ? 'Approve or reject incoming wallet top-up requests.' : 'Submit a request to top up your wallet balance.'}
          </p>
        </div>
        {!isAdmin && (
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus size={18} /> New Request
          </button>
        )}
      </div>

      <div className="card">
        <div className="p-4 border-b flex gap-2 overflow-x-auto">
          {['PENDING', 'SUCCESS', 'FAILED', ''].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {f || 'ALL'}
            </button>
          ))}
        </div>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">User / Date</th>
                <th>Amount</th>
                <th>Bank Info</th>
                <th>Receipt</th>
                <th>Status</th>
                {isAdmin && <th className="sticky-col-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-10">Loading...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-10 text-gray-400">No requests found.</td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td className="sticky-col">
                      <div className="flex flex-col">
                        <span className="font-semibold">{formatParty(r.user)}</span>
                        <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="font-bold">{formatAmount(r.amount)}</td>
                    <td>
                      <div className="text-xs">{r.companyBankAccount?.bankName || r.bankName}</div>
                      <div className="text-[10px] text-gray-400">A/C: {r.companyBankAccount?.accountNumber || r.accountNumber}</div>
                      {r.bankRef && <div className="text-[10px] text-primary font-bold mt-1">UTR: {r.bankRef}</div>}
                    </td>
                    <td>
                      {r.receiptPath && (
                        <a href={resolveUploadUrl(r.receiptPath)} target="_blank" rel="noreferrer" className="text-primary text-xs flex items-center gap-1">
                          <Eye size={14} /> View
                        </a>
                      )}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    {isAdmin && (
                      <td className="sticky-col-right">
                        {r.status === 'PENDING' && (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => approveRequest(r.id)}
                              className="btn btn-primary btn-sm bg-emerald-600 border-emerald-600 min-w-[80px]"
                              disabled={actionInProgress === r.id}
                            >
                              {actionInProgress === r.id ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => rejectRequest(r.id)}
                              className="btn btn-outline btn-sm text-red-600 border-red-200 hover:bg-red-50 min-w-[80px]"
                              disabled={actionInProgress === r.id}
                            >
                              {actionInProgress === r.id ? 'Processing...' : 'Reject'}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <RequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSaved={fetchAll} bankAccounts={bankAccounts} />
    </div>
  );
}
import { getApiOrigin } from '../lib/apiBaseUrl';
