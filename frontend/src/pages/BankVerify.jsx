import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Building2, Search, CheckCircle2, History, CreditCard, Info, XCircle } from 'lucide-react';

export default function BankVerify() {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    bankName: '', accountName: '', accountNumber: '', ifscCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/services?serviceType=BANK_VERIFICATION');
      if (data.success) {
        setHistory(data.requests);
      }
    } catch (err) {
      console.error(err);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/services/verify-bank', formData);
      if (data.success) {
        setResult({ success: true, message: data.message, charge: data.charge });
        await refreshUser();
        fetchHistory();
      }
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Verification failed' });
    }
    setLoading(false);
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bank Account Verification</h1>
          <p className="text-muted text-sm mt-1">Verify any bank account instantly. Standard charges apply.</p>
        </div>
        <div className="bg-primary-light px-4 py-2 rounded-lg border border-primary-200">
          <span className="text-xs font-bold text-primary uppercase">Wallet Balance</span>
          <div className="text-lg font-bold text-secondary">₹ {Number(user.wallet?.balance || 0).toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        
        {/* Verification Form */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6 text-primary">
            <Building2 size={20} />
            <h2 className="font-semibold">Verify New Account</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Beneficiary Bank Name</label>
              <input 
                type="text" required placeholder="e.g. State Bank of India"
                value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Account Holder Name</label>
              <input 
                type="text" required placeholder="Display Name on Passbook"
                value={formData.accountName} onChange={e => setFormData({...formData, accountName: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Account Number</label>
              <input 
                type="text" required placeholder="Enter Full Account Number"
                value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">IFSC Code</label>
              <input 
                type="text" required placeholder="e.g. SBIN0001234"
                value={formData.ifscCode} onChange={e => setFormData({...formData, ifscCode: e.target.value})}
              />
            </div>

            <div className="p-3 bg-gray-50 rounded-lg flex gap-3 items-start mt-4">
              <Info size={16} className="text-primary mt-0.5" />
              <p className="text-xs text-gray-600">
                A nominal charge will be deducted from your wallet for this verification. 
                Please ensure you have sufficient balance.
              </p>
            </div>

            <button type="submit" className="btn btn-primary w-full py-3 mt-4" disabled={loading}>
              {loading ? 'Processing...' : 'Verify Now'}
            </button>
          </form>

          {result && (
            <div className={`mt-6 p-4 rounded-xl border animate-fade-in ${result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex gap-3">
                {result.success ? <CheckCircle2 className="text-emerald-600" /> : <XCircle className="text-red-600" />}
                <div>
                  <div className={`font-bold ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                    {result.success ? 'Verification Successful' : 'Verification Failed'}
                  </div>
                  <p className={`text-sm ${result.success ? 'text-emerald-600' : 'text-red-600'}`}>
                    {result.message}
                  </p>
                  {result.charge && <div className="text-xs text-emerald-700 mt-1 font-semibold">Charge Deducted: ₹{result.charge}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History Table */}
        <div className="card flex flex-col h-full">
          <div className="p-5 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-400" />
              <h2 className="font-semibold">Recent Verifications</h2>
            </div>
            <button onClick={fetchHistory} className="text-xs text-primary hover:underline">Refresh</button>
          </div>
          
          <div className="data-table-container flex-1 border-none shadow-none rounded-none overflow-y-auto max-h-[500px]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account Info</th>
                  <th>Bank / IFSC</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan="3" className="text-center py-8 text-gray-400">Loading history...</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-8 text-gray-400">No verification history found.</td></tr>
                ) : (
                  history.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{item.accountName}</span>
                          <span className="text-xs text-gray-400 font-mono italic">{item.accountNumber}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">{item.bankName}</span>
                          <span className="text-[10px] text-gray-400">{item.ifscCode}</span>
                        </div>
                      </td>
                      <td>
                         <span className={`badge ${item.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                           {item.status}
                         </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
