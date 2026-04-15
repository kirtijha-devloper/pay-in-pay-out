import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  CheckCircle2,
  History,
  Info,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet as WalletIcon,
} from 'lucide-react';

function formatAmount(value) {
  return `₹ ${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function maskAccount(value) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= 4) return '****';
  return `${'*'.repeat(text.length - 4)}${text.slice(-4)}`;
}

function StatusBadge({ status }) {
  const classes =
    status === 'SUCCESS' ? 'badge-success' : status === 'FAILED' ? 'badge-danger' : 'badge-warning';
  return <span className={`badge ${classes}`}>{status}</span>;
}

export default function Payout() {
  const { user, refreshUser } = useAuth();
  const hasTransactionPin = Boolean(user?.transactionPinSet);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    beneficiaryId: '',
    transferMode: 'IMPS',
    tpin: '',
    confirmVerified: false,
    remark: '',
  });

  const selectedBeneficiary = useMemo(
    () => beneficiaries.find((beneficiary) => beneficiary.id === formData.beneficiaryId) || null,
    [beneficiaries, formData.beneficiaryId]
  );

  const fetchBeneficiaries = async () => {
    setBeneficiariesLoading(true);
    try {
      const { data } = await api.get('/services/payout/beneficiaries');
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
      const { data } = await api.get('/services?serviceType=PAYOUT');
      if (data.success) {
        setHistory(data.requests || []);
      }
    } catch (error) {
      console.error(error);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    fetchBeneficiaries();
    fetchHistory();
  }, []);

  useEffect(() => {
    const amountValue = Number(formData.amount || 0);
    if (!amountValue || amountValue <= 0) {
      setQuote(null);
      setQuoteError('');
      setQuoteLoading(false);
      return;
    }

    let isActive = true;
    setQuoteLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const { data } = await api.get('/services/payout/quote', {
          params: { amount: amountValue },
        });

        if (!isActive) {
          return;
        }

        if (data.success) {
          setQuote(data.quote);
          setQuoteError('');
        } else {
          setQuote(null);
          setQuoteError(data.message || 'Unable to calculate payout charge');
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setQuote(null);
        setQuoteError(error.response?.data?.message || 'Unable to calculate payout charge');
      } finally {
        if (isActive) {
          setQuoteLoading(false);
        }
      }
    }, 250);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [formData.amount]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data } = await api.post('/services/payout', {
        amount: Number(formData.amount),
        beneficiaryId: formData.beneficiaryId,
        transferMode: formData.transferMode,
        tpin: formData.tpin,
        confirmVerified: formData.confirmVerified,
        remark: formData.remark,
      });

      setMessage({
        type: data.success ? 'success' : 'error',
        text: data.message || (data.success ? 'Payout request submitted' : 'Payout request failed'),
      });

      setFormData((current) => ({
        ...current,
        amount: '',
        tpin: '',
        confirmVerified: false,
        remark: '',
      }));

      setQuote(null);
      setQuoteError('');
      await refreshUser();
      window.dispatchEvent(new Event('wallet-balance-updated'));
      await fetchHistory();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Payout failed',
      });
      await refreshUser();
      window.dispatchEvent(new Event('wallet-balance-updated'));
      await fetchHistory();
    }

    setLoading(false);
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payout</h1>
          <p className="text-muted text-sm mt-1">
            Choose a verified beneficiary, confirm your TPIN, and send the net payout through BranchX.
          </p>
        </div>
        <div className="bg-emerald-50 px-5 py-3 rounded-xl border border-emerald-200 flex items-center gap-3">
          <WalletIcon className="text-emerald-600" size={24} />
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Available Funds</span>
            <div className="text-xl font-bold text-emerald-900">{formatAmount(user?.wallet?.balance || 0)}</div>
          </div>
        </div>
      </div>

      {!hasTransactionPin && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Transaction PIN is not set.</p>
            <p className="text-amber-700">
              Set it from <Link to="/settings" className="font-semibold underline">Account Settings</Link> before starting a payout.
            </p>
          </div>
        </div>
      )}

      {!beneficiariesLoading && beneficiaries.length === 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 flex items-start gap-3">
          <Info size={18} className="mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">No verified beneficiaries yet.</p>
            <p className="text-blue-700">
              Add and verify bank accounts first from <Link to="/bank-verify" className="font-semibold underline">Bank Verification</Link>.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        <div className="card p-6 border-t-4 border-t-primary">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Send size={20} />
                <h2 className="text-xl font-bold">Create Payout</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                The entered amount is reserved from your wallet, and the net amount after charge is sent to BranchX.
              </p>
            </div>
            <button onClick={fetchBeneficiaries} className="btn btn-outline btn-sm" type="button">
              <RefreshCw size={16} />
              Refresh Beneficiaries
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Verified Beneficiary</label>
              <select
                required
                value={formData.beneficiaryId}
                onChange={(event) => setFormData({ ...formData, beneficiaryId: event.target.value })}
                disabled={beneficiariesLoading || beneficiaries.length === 0}
              >
                <option value="">{beneficiariesLoading ? 'Loading beneficiaries...' : 'Select verified beneficiary'}</option>
                {beneficiaries.map((beneficiary) => (
                  <option key={beneficiary.id} value={beneficiary.id}>
                    {beneficiary.payeeName} - {maskAccount(beneficiary.accountNo)} ({beneficiary.bankName})
                  </option>
                ))}
              </select>
              {selectedBeneficiary && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  <div className="font-semibold text-gray-900">{selectedBeneficiary.payeeName}</div>
                  <div>{selectedBeneficiary.bankName}</div>
                  <div>
                    {maskAccount(selectedBeneficiary.accountNo)} · {selectedBeneficiary.bankIfsc}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Payout Amount (₹)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
                className="text-lg font-bold py-3"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Transfer Mode</label>
                <select
                  value={formData.transferMode}
                  onChange={(event) => setFormData({ ...formData, transferMode: event.target.value })}
                >
                  <option value="IMPS">IMPS</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Transaction PIN</label>
                <input
                  type="password"
                  required
                  inputMode="numeric"
                  placeholder="Enter your TPIN"
                  value={formData.tpin}
                  onChange={(event) => setFormData({ ...formData, tpin: event.target.value })}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ShieldCheck size={16} className="text-primary" />
                Charge Preview
              </div>
              {quoteLoading ? (
                <div className="text-sm text-slate-500 mt-2">Calculating charge...</div>
              ) : quote ? (
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Charge</div>
                    <div className="font-semibold text-slate-900">{formatAmount(quote.charge)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Net payout</div>
                    <div className="font-semibold text-slate-900">{formatAmount(quote.netAmount)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Wallet reserve</div>
                    <div className="font-semibold text-slate-900">{formatAmount(quote.walletRequired)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 mt-2">Enter an amount to preview the charge.</div>
              )}
              {quoteError && <div className="text-sm text-red-600 mt-2">{quoteError}</div>}
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={formData.confirmVerified}
                onChange={(event) => setFormData({ ...formData, confirmVerified: event.target.checked })}
              />
              <span className="text-sm text-gray-600">
                I confirm that the selected beneficiary has been verified and I understand the payout amount will be
                reserved from my wallet before BranchX settlement.
              </span>
            </label>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Remark</label>
              <input
                type="text"
                placeholder="Optional remark for this payout"
                value={formData.remark}
                onChange={(event) => setFormData({ ...formData, remark: event.target.value })}
              />
            </div>

            {message && (
              <div
                className={`p-4 rounded-lg flex gap-3 animate-fade-in ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full py-4 text-base shadow-lg shadow-blue-100"
              disabled={
                loading ||
                beneficiariesLoading ||
                beneficiaries.length === 0 ||
                !hasTransactionPin ||
                !selectedBeneficiary ||
                !formData.confirmVerified
              }
            >
              {loading ? 'Processing Transaction...' : 'Initiate Payout'}
            </button>

            <p className="text-[10px] text-center text-gray-400 italic">
              By confirming, you agree that the beneficiary and amount are correct. The net payout is sent to
              BranchX after charge deduction.
            </p>
          </form>
        </div>

        <div className="card h-full flex flex-col">
          <div className="p-5 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-400" />
              <h2 className="font-semibold">Payout History</h2>
            </div>
            <button onClick={fetchHistory} className="btn btn-outline btn-sm" type="button">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[720px]">
            {historyLoading ? (
              <div className="p-10 text-center text-gray-400">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="p-10 text-center text-gray-400">No payout records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase">Beneficiary</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase">Amount</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase">Charge / Net</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase">Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-medium text-gray-900">{formatDateTime(item.createdAt)}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-semibold text-gray-900">{item.accountName || '-'}</div>
                          <div className="text-[10px] text-gray-500">
                            {item.bankName || '-'} · {maskAccount(item.accountNumber)}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-semibold text-gray-900">
                          {formatAmount(item.amount)}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="text-sm text-emerald-700 font-semibold">
                            Charge: {formatAmount(item.chargeAmount || 0)}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Net: {formatAmount(item.creditedAmount || 0)}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="text-xs font-mono text-gray-500 break-all">{item.bankRef || '-'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
