import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  History,
  Info,
  RefreshCw,
  Save,
  ShieldCheck,
  Wallet as WalletIcon,
  XCircle,
} from 'lucide-react';

function formatAmount(value) {
  return `₹ ${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function maskedAccount(value) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= 4) return '****';
  return `${'*'.repeat(text.length - 4)}${text.slice(-4)}`;
}

function StatusBadge({ status }) {
  const classes = status === 'SUCCESS' ? 'badge-success' : status === 'FAILED' ? 'badge-danger' : 'badge-warning';
  return <span className={`badge ${classes}`}>{status}</span>;
}

export default function BankVerify() {
  const { user, refreshUser } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const sectionTabs = [
    { id: 'verify', label: 'Verify Account' },
    { id: 'beneficiaries', label: 'Saved Beneficiaries' },
    { id: 'history', label: 'Recent Verifications' },
  ];

  const [formData, setFormData] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifscCode: '',
  });
  const [fee, setFee] = useState(null);
  const [feeDraft, setFeeDraft] = useState('');
  const [feeSaving, setFeeSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('verify');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(true);
  const [feeLoading, setFeeLoading] = useState(true);

  const fetchFee = async () => {
    setFeeLoading(true);
    try {
      const { data } = await api.get('/services/bank-verify/fee');
      if (data.success) {
        setFee(data.fee);
        setFeeDraft(String(Number(data.fee?.amount || 0)));
      }
    } catch (error) {
      console.error(error);
    }
    setFeeLoading(false);
  };

  const fetchBeneficiaries = async () => {
    setBeneficiariesLoading(true);
    try {
      const { data } = await api.get('/services/bank-verify/beneficiaries');
      if (data.success) {
        setBeneficiaries(data.beneficiaries || []);
      }
    } catch (error) {
      console.error(error);
    }
    setBeneficiariesLoading(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/services?serviceType=BANK_VERIFICATION');
      if (data.success) {
        setHistory(data.requests || []);
      }
    } catch (error) {
      console.error(error);
    }
    setHistoryLoading(false);
  };

  const refreshAll = async () => {
    await Promise.all([fetchFee(), fetchBeneficiaries(), fetchHistory()]);
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentFeeAmount = useMemo(() => Number(fee?.amount || 0), [fee]);

  const refreshActiveSection = async () => {
    if (activeSection === 'beneficiaries') {
      await fetchBeneficiaries();
      return;
    }

    if (activeSection === 'history') {
      await fetchHistory();
      return;
    }

    await refreshAll();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const { data } = await api.post('/services/bank-verify', formData);
      if (data.success) {
        setResult({
          success: true,
          message: data.message,
          fee: data.fee,
          cached: data.cached,
        });
        if (!data.cached) {
          await refreshUser();
        }
        await refreshAll();
      } else {
        setResult({ success: false, message: data.message || 'Verification failed' });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error.response?.data?.message || 'Verification failed',
      });
    }

    setLoading(false);
  };

  const handleFeeSave = async () => {
    setFeeSaving(true);
    try {
      const { data } = await api.patch('/services/bank-verify/fee', {
        amount: feeDraft,
      });
      if (data.success) {
        setFee(data.fee);
        setFeeDraft(String(Number(data.fee?.amount || 0)));
      }
    } catch (error) {
      console.error(error);
    }
    setFeeSaving(false);
  };

  const useBeneficiary = (beneficiary) => {
    setFormData({
      bankName: beneficiary.bankName || '',
      accountName: beneficiary.payeeName || '',
      accountNumber: beneficiary.accountNo || '',
      ifscCode: beneficiary.bankIfsc || '',
    });
    setActiveSection('verify');
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bank Verification</h1>
         
        </div>
        <div className="bg-primary-light px-4 py-3 rounded-lg border border-primary-200 min-w-[220px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <WalletIcon size={16} className="text-primary" />
              <span className="text-xs font-bold text-primary uppercase">Wallet Balance</span>
            </div>
            <span className="text-lg font-bold text-secondary">{formatAmount(user?.wallet?.balance || 0)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" />
              <span className="text-xs font-bold text-primary uppercase">Verification Fee</span>
            </div>
            <span className="text-sm font-semibold text-gray-600">
              {feeLoading ? 'Loading...' : formatAmount(currentFeeAmount)}
            </span>
          </div>
          {isAdmin && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeDraft}
                onChange={(event) => setFeeDraft(event.target.value)}
                className="py-2 px-3 text-sm"
              />
              <button className="btn btn-primary btn-sm" type="button" onClick={handleFeeSave} disabled={feeSaving}>
                <Save size={14} />
                {feeSaving ? 'Saving' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {sectionTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                activeSection === tab.id
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={refreshActiveSection}
          className="btn btn-outline btn-sm"
          type="button"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {activeSection === 'verify' && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6 text-primary">
            <Building2 size={20} />
            <h2 className="font-semibold">Verify New Account</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Beneficiary Bank Name</label>
              <input
                type="text"
                required
                placeholder="e.g. State Bank of India"
                value={formData.bankName}
                onChange={(event) => setFormData({ ...formData, bankName: event.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Account Holder Name</label>
              <input
                type="text"
                required
                placeholder="Display name on passbook"
                value={formData.accountName}
                onChange={(event) => setFormData({ ...formData, accountName: event.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Account Number</label>
              <input
                type="text"
                required
                placeholder="Enter full account number"
                value={formData.accountNumber}
                onChange={(event) => setFormData({ ...formData, accountNumber: event.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">IFSC Code</label>
              <input
                type="text"
                required
                placeholder="e.g. SBIN0001234"
                value={formData.ifscCode}
                onChange={(event) => setFormData({ ...formData, ifscCode: event.target.value })}
              />
            </div>

            <div className="p-3 bg-gray-50 rounded-lg flex gap-3 items-start mt-4">
              <Info size={16} className="text-primary mt-0.5" />
              <p className="text-xs text-gray-600">
                A flat verification fee will be deducted from your wallet only when a fresh verification is performed.
                Previously verified beneficiaries are reused at no extra charge.
              </p>
            </div>

            <button type="submit" className="btn btn-primary w-full py-3 mt-4" disabled={loading}>
              {loading ? 'Processing...' : 'Verify Now'}
            </button>
          </form>

          {result && (
            <div
              className={`mt-6 p-4 rounded-xl border animate-fade-in ${
                result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex gap-3">
                {result.success ? <CheckCircle2 className="text-emerald-600" /> : <XCircle className="text-red-600" />}
                <div>
                  <div className={`font-bold ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                    {result.success ? 'Verification Successful' : 'Verification Failed'}
                  </div>
                  <p className={`text-sm ${result.success ? 'text-emerald-600' : 'text-red-600'}`}>{result.message}</p>
                  {result.success && (
                    <div className="text-xs text-emerald-700 mt-1 font-semibold">
                      {result.cached ? 'Reused cached beneficiary' : `Fee Deducted: ${formatAmount(result.fee)}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === 'beneficiaries' && (
        <div className="card">
          <div className="p-5 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-gray-400" />
              <h2 className="font-semibold">Saved Beneficiaries</h2>
            </div>
            <button onClick={fetchBeneficiaries} className="btn btn-outline btn-sm" type="button">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="data-table-container border-none shadow-none rounded-none overflow-y-auto max-h-[520px]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Account</th>
                  <th>IFSC</th>
                  <th>Verified On</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {beneficiariesLoading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-400">
                      Loading beneficiaries...
                    </td>
                  </tr>
                ) : beneficiaries.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-400">
                      No saved beneficiaries found.
                    </td>
                  </tr>
                ) : (
                  beneficiaries.map((beneficiary) => (
                    <tr key={beneficiary.id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{beneficiary.bankName}</span>
                          <span className="text-[10px] text-gray-400">{beneficiary.payeeName}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs">{maskedAccount(beneficiary.accountNo)}</td>
                      <td className="font-mono text-xs">{beneficiary.bankIfsc}</td>
                      <td className="text-xs text-gray-500">{formatDateTime(beneficiary.verifiedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => useBeneficiary(beneficiary)}
                        >
                          Use Saved
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'history' && (
        <div className="card">
          <div className="p-5 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-400" />
              <h2 className="font-semibold">Recent Verifications</h2>
            </div>
            <button onClick={fetchHistory} className="btn btn-outline btn-sm" type="button">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="data-table-container border-none shadow-none rounded-none overflow-y-auto max-h-[520px]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bank / Account</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-400">
                      Loading history...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-400">
                      No verification history found.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id}>
                      <td className="text-xs text-gray-500">{formatDateTime(item.createdAt)}</td>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{item.bankName}</span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {item.accountName} / {maskedAccount(item.accountNumber)}
                          </span>
                        </div>
                      </td>
                      <td className="font-semibold text-emerald-600">{formatAmount(item.amount)}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="text-xs text-gray-500 max-w-[280px]">{item.remark || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
