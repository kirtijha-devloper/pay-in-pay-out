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
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
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
      bankAccountId: current.bankAccountId || bankAccounts[0]?.id || '',
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">New Fund Request</h2>
            <p className="text-sm text-gray-500">Choose a company bank account and attach your receipt.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={24} />
          </button>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase text-gray-500">Amount</label>
              <input type="number" min="0" step="0.01" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase text-gray-500">Company Bank Account</label>
              <select required value={formData.bankAccountId} onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}>
                <option value="">Select company bank account</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.bankName} - {account.accountNumber}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-500">Bank Reference / UTR</label>
              <input type="text" required value={formData.bankRef} onChange={(e) => setFormData({ ...formData, bankRef: e.target.value })} placeholder="Enter UTR / reference" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-500">Payment Mode</label>
              <select value={formData.paymentMode} onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}>
                <option value="IMPS">IMPS</option>
                <option value="NEFT">NEFT</option>
                <option value="UPI">UPI / QR</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase text-gray-500">Receipt Image / PDF</label>
              <input type="file" required accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
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

  const approveRequest = async (id) => {
    if (!window.confirm('Approve this request?')) return;
    try {
      await api.patch(`/services/fund-request/${id}/approve`);
      fetchAll();
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const rejectRequest = async (id) => {
    if (!window.confirm('Reject this request?')) return;
    try {
      await api.patch(`/services/fund-request/${id}/reject`);
      fetchAll();
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  return (
    <div className="flex-col gap-6">
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
                <th>User / Date</th>
                <th>Amount</th>
                <th>Bank Info</th>
                <th>Receipt</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
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
                    <td>
                      <div className="flex flex-col">
                        <span className="font-semibold">{formatParty(r.user)}</span>
                        <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="font-bold">{formatAmount(r.amount)}</td>
                    <td>
                      <div className="text-xs">{r.companyBankAccount?.bankName || r.bankName}</div>
                      <div className="text-[10px] text-gray-400">{r.companyBankAccount?.accountNumber || r.accountNumber}</div>
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
                      <td>
                        {r.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button onClick={() => approveRequest(r.id)} className="btn btn-primary btn-sm bg-emerald-600 border-emerald-600">Approve</button>
                            <button onClick={() => rejectRequest(r.id)} className="btn btn-outline btn-sm text-red-600 border-red-200 hover:bg-red-50">Reject</button>
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
