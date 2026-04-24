import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  CheckCircle2,
  Edit2,
  Eye,
  FileText,
  History,
  Plus,
  RefreshCw,
  Trash2,
  Wallet as WalletIcon,
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
    if (!isOpen) {
      return;
    }

    setError('');
    setLoading(false);
    setReceiptFile(null);
    setFormData((current) => ({
      ...current,
      bankAccountId: current.bankAccountId || bankAccounts[0]?.id || '',
    }));
  }, [bankAccounts, isOpen]);

  if (!isOpen) {
    return null;
  }

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
      if (receiptFile) {
        payload.append('receipt', receiptFile);
      }

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">New Wallet Top-Up</h2>
            <p className="text-sm text-gray-500">Choose a company bank account and attach your receipt.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button">
            <XCircle size={24} />
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase text-gray-500">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                autoFocus
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase text-gray-500">Company Bank Account</label>
              <select
                required
                value={formData.bankAccountId}
                onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
              >
                <option value="">Select company bank account</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName} - {account.accountNumber}
                  </option>
                ))}
              </select>
              {bankAccounts.length === 0 && (
                <p className="text-xs text-amber-600">No active company bank accounts are available yet.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-500">Bank Reference / UTR</label>
              <input
                type="text"
                required
                value={formData.bankRef}
                onChange={(e) => setFormData({ ...formData, bankRef: e.target.value })}
                placeholder="Enter UTR / reference"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-500">Payment Mode</label>
              <select value={formData.paymentMode} onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}>
                <option value="IMPS">IMPS</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="UPI">UPI / QR</option>
                <option value="CASH_DEPOSIT">Cash Deposit</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-500">Payment Date</label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase text-gray-500">Receipt Image / PDF</label>
              <input
                type="file"
                required
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase text-gray-500">Remark</label>
              <textarea
                rows="3"
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder="Optional remark"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || bankAccounts.length === 0}>
              {loading ? 'Submitting...' : 'Submit Top-Up Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BankAccountModal({ isOpen, onClose, onSaved, initialData }) {
  const [formData, setFormData] = useState({
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setLoading(false);
    
    
    setFormData({
      bankName: initialData?.bankName || '',
      accountNumber: initialData?.accountNumber || '',
      confirmAccountNumber: initialData?.accountNumber || '',
      ifscCode: initialData?.ifscCode || '',
      isActive: initialData?.isActive ?? true,
    });
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    

    try {
      const data = new FormData();
      
      const payloadBankName = formData.bankName;
      let payloadAccountNumber = formData.accountNumber;
      let payloadIfscCode = formData.ifscCode;
      
      data.append('bankName', payloadBankName);
      data.append('accountNumber', payloadAccountNumber);
      data.append('confirmAccountNumber', payloadAccountNumber);
      data.append('ifscCode', payloadIfscCode);
      data.append('isActive', formData.isActive);

      if (initialData?.id) data.append('id', initialData.id);

      if (initialData?.id) {
        await api.put('/services/bank-accounts', data, { headers: { 'Content-Type': 'multipart/form-data' }});
      } else {
        await api.post('/services/bank-accounts', data, { headers: { 'Content-Type': 'multipart/form-data' }});
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save bank account');
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl p-6">
        <h2 className="text-xl font-bold mb-1">{initialData ? 'Edit Details' : 'Add Deposit Method'}</h2>
        <p className="text-sm text-gray-500 mb-5">These will be available to users when they request wallet top-ups.</p>


        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Bank Name</label>
              <input
                type="text"
                required
                placeholder="e.g. HDFC Bank"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full py-3 px-4 bg-gray-50/50 focus:bg-white border-2 border-transparent focus:border-primary rounded-xl font-bold text-sm outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Account Number</label>
                <input
                  type="text"
                  required
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  className="w-full py-3 px-4 bg-gray-50/50 border-2 border-transparent focus:border-primary rounded-xl font-bold text-sm tracking-tight outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Confirm Number</label>
                <input
                  type="text"
                  required
                  value={formData.confirmAccountNumber}
                  onChange={(e) => setFormData({ ...formData, confirmAccountNumber: e.target.value })}
                  className="w-full py-3 px-4 bg-gray-50/50 border-2 border-transparent focus:border-primary rounded-xl font-bold text-sm tracking-tight outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">IFSC Code</label>
                <input
                  type="text"
                  required
                  value={formData.ifscCode}
                  onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                  className="w-full py-3 px-4 bg-gray-50/50 border-2 border-transparent focus:border-primary rounded-xl font-bold text-sm outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Account Status</label>
                <select
                  value={String(formData.isActive)}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                  className="w-full py-3 px-4 bg-gray-50/50 border-2 border-transparent focus:border-primary rounded-xl font-bold text-sm outline-none transition-all"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : initialData ? 'Update Account' : 'Save Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Wallet() {
  const { user, refreshUser } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const kycVerified = isAdmin || user?.kycStatus === 'VERIFIED';
  const canCreateRequest = !isAdmin && kycVerified;
  const sectionTabs = [
    ...(isAdmin
      ? [{ id: 'bank-accounts', label: 'Company Bank Accounts' }]
      : []),
    { id: 'requests', label: isAdmin ? 'Top-Up Requests' : 'My Wallet Requests' },
    { id: 'ledger', label: 'Wallet Ledger' },
  ];

  const [requests, setRequests] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [requestFilter, setRequestFilter] = useState('PENDING');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [currentBankAccount, setCurrentBankAccount] = useState(null);
  const [activeSection, setActiveSection] = useState('requests');
  const [error, setError] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    setLedgerLoading(true);
    setError('');

    try {
      const requestsPromise = api.get(
        `/services?serviceType=FUND_REQUEST${requestFilter ? `&status=${requestFilter}` : ''}`
      );
      const ledgerPromise = api.get('/reports/ledger');
      const accountsPromise = api.get('/services/bank-accounts');

      const [{ data: requestsRes }, { data: ledgerRes }, { data: accountsRes }] = await Promise.all([
        requestsPromise,
        ledgerPromise,
        accountsPromise,
      ]);

      setRequests(requestsRes.success ? requestsRes.requests : []);
      setLedger(ledgerRes.success ? ledgerRes.transactions : []);
      setBankAccounts(accountsRes.success ? accountsRes.accounts : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load wallet data');
    }

    setLoading(false);
    setLedgerLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [requestFilter]);

  const approveRequest = async (id) => {


    try {
      await api.patch(`/services/fund-request/${id}/approve`);
      await refreshUser();
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to approve request');
    }
  };

  const rejectRequest = async (id) => {


    try {
      await api.patch(`/services/fund-request/${id}/reject`);
      await refreshUser();
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reject request');
    }
  };

  const toggleBankAccount = async (id) => {
    try {
      await api.patch(`/services/bank-accounts/${id}/toggle`);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update bank account status');
    }
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-muted text-sm mt-1">
            {isAdmin
              ? 'Review top-up requests, manage company bank accounts, and monitor the full wallet ledger.'
              : 'Request wallet top-ups and review your transaction history.'}
          </p>
        </div>

        {!isAdmin && !kycVerified && (
          <Link to="/kyc-verification" className="btn btn-outline shadow-lg shadow-amber-100">
            Complete KYC
          </Link>
        )}

        {!isAdmin && !kycVerified && (
          <Link to="/kyc-verification" className="btn btn-outline shadow-lg shadow-amber-100">
            Complete KYC
          </Link>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}

      {!isAdmin && !kycVerified && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-amber-800">KYC approval is required before wallet top-ups</div>
            <div className="text-xs text-amber-700">Submit your manual KYC request first. Once approved, the New Request button will appear here.</div>
          </div>
          <Link to="/kyc-verification" className="btn btn-primary btn-sm">
            Go to KYC
          </Link>
        </div>
      )}

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {sectionTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                  activeSection === tab.id
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {canCreateRequest && (
            <button onClick={() => setIsRequestModalOpen(true)} className="btn btn-primary shadow-lg shadow-blue-200" type="button">
              <Plus size={18} /> New Request
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => {
                setCurrentBankAccount(null);
                setIsBankModalOpen(true);
              }}
              className="btn btn-primary shadow-lg shadow-blue-200"
              type="button"
            >
              <Building2 size={18} /> Add Company Bank Account
            </button>
          )}
        </div>
      </div>

      {isAdmin && activeSection === 'bank-accounts' && (
        <div className="card">
          <div className="p-5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-gray-500" />
              <h2 className="font-semibold">Company Bank Accounts</h2>
            </div>
            <span className="text-xs text-gray-400">Active and inactive accounts</span>
          </div>
          <div className="data-table-container border-none shadow-none rounded-none">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Account</th>
                  <th>IFSC</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bankAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-400">
                      No company bank accounts configured yet.
                    </td>
                  </tr>
                ) : (
                  bankAccounts.map((account) => (
                    <tr key={account.id}>
                      <td className="font-semibold">{account.bankName}</td>
                      <td className="font-mono text-sm">{account.accountNumber}</td>
                      <td className="font-mono text-sm">{account.ifscCode}</td>
                      <td>
                        <span className={`badge ${account.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {account.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setCurrentBankAccount(account);
                              setIsBankModalOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            type="button"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => toggleBankAccount(account.id)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                            type="button"
                          >
                            <RefreshCw size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'requests' && (
        <div className="card">
          <div className="p-5 border-b flex flex-wrap gap-2 items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-gray-500" />
              <h2 className="font-semibold">{isAdmin ? 'Top-Up Requests' : 'My Wallet Requests'}</h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              {REQUEST_STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => setRequestFilter(status)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                    requestFilter === status ? 'bg-primary text-white' : 'bg-white border text-gray-500'
                  }`}
                  type="button"
                >
                  {status}
                </button>
              ))}
              <button
                onClick={() => setRequestFilter('')}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                  requestFilter === '' ? 'bg-primary text-white' : 'bg-white border text-gray-500'
                }`}
                type="button"
              >
                ALL
              </button>
            </div>
          </div>

          <div className="data-table-container border-none shadow-none rounded-none">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User / Date</th>
                  <th>Amount</th>
                  <th>Charge / Net</th>
                  <th>Bank</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-gray-400">
                      Loading requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-gray-400">
                      No {requestFilter ? requestFilter.toLowerCase() : 'wallet'} requests found.
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id}>
                      <td className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold">{formatParty(req.user)}</span>
                          <span className="text-[10px] text-gray-400">{new Date(req.createdAt).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="font-bold whitespace-nowrap">{formatAmount(req.amount)}</td>
                      <td className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-emerald-600 font-semibold">
                            Charge: {formatAmount(req.chargeAmount || 0)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Net: {formatAmount(req.creditedAmount || 0)}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs">{req.companyBankAccount?.bankName || req.bankName || '-'}</span>
                          <span className="text-[10px] text-gray-400">{req.companyBankAccount?.accountNumber || req.accountNumber || '-'}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {req.receiptPath ? (
                          <a
                            href={resolveUploadUrl(req.receiptPath)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary text-xs inline-flex items-center gap-1"
                          >
                            <Eye size={14} /> View
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <StatusBadge status={req.status} />
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap">
                          {req.status === 'PENDING' ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveRequest(req.id)}
                                className="p-1 px-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded border border-emerald-200 text-xs font-bold transition-all"
                                type="button"
                              >
                                APPROVE
                              </button>
                              <button
                                onClick={() => rejectRequest(req.id)}
                                className="p-1 px-2 bg-red-50 text-red-600 hover:bg-red-100 rounded border border-red-200 text-xs font-bold transition-all"
                                type="button"
                              >
                                REJECT
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              {req.approvedBy ? `Approved by ${req.approvedBy.role}` : req.rejectedBy ? `Rejected by ${req.rejectedBy.role}` : 'Actioned'}
                            </span>
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
      )}

      {activeSection === 'ledger' && (
        <div className="card">
          <div className="p-5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-500" />
              <h2 className="font-semibold">Wallet Ledger</h2>
            </div>
            <button onClick={fetchAll} className="btn btn-outline btn-sm" type="button">
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          <div className="data-table-container border-none shadow-none rounded-none">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Services</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>After Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledgerLoading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-400">
                      Loading ledger...
                    </td>
                  </tr>
                ) : ledger.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-400">
                      No wallet transactions found.
                    </td>
                  </tr>
                ) : (
                  ledger.map((txn) => {
                    const balance = txn.type === 'CREDIT' ? txn.receiverBalAfter : txn.senderBalAfter;
                    return (
                      <tr key={txn.id}>
                        <td className="text-xs text-gray-500">{new Date(txn.createdAt).toLocaleString()}</td>
                        <td>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            txn.type === 'CREDIT' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {txn.type === 'CREDIT' ? 'Pay In' : 'Pay Out'}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{txn.description || 'Wallet Transaction'}</span>
                            {txn.serviceRequest && (
                              <span className="text-[10px] text-gray-400">
                                {txn.serviceRequest.serviceType} / {formatParty(txn.serviceRequest.user)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${txn.type === 'CREDIT' ? 'badge-success' : 'badge-danger'}`}>
                            {txn.type}
                          </span>
                        </td>
                        <td className={txn.type === 'CREDIT' ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                          {txn.type === 'CREDIT' ? '+' : '-'}
                          {formatAmount(txn.amount)}
                        </td>
                        <td className="font-mono text-gray-500">{formatAmount(balance)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSaved={fetchAll}
        bankAccounts={bankAccounts}
      />

      <BankAccountModal
        isOpen={isBankModalOpen}
        onClose={() => {
          setIsBankModalOpen(false);
          setCurrentBankAccount(null);
        }}
        onSaved={fetchAll}
        initialData={currentBankAccount}
      />
    </div>
  );
}
import { getApiOrigin } from '../lib/apiBaseUrl';
