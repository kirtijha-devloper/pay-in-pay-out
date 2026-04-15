import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Send, Wallet, History, Info, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Payout() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    amount: '', bankName: '', accountName: '', accountNumber: '', ifscCode: '', remark: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/services?serviceType=PAYOUT');
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
    setMessage(null);
    try {
      const { data } = await api.post('/services/payout', {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      if (data.success) {
        setMessage({ type: 'success', text: `Payout submitted! Charge: ₹${data.charge}` });
        setFormData({ amount: '', bankName: '', accountName: '', accountNumber: '', ifscCode: '', remark: '' });
        fetchHistory();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Payout failed' });
    }
    setLoading(false);
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Transfer Money (Payout)</h1>
          <p className="text-muted text-sm mt-1">Send funds to any bank account instantly using your wallet balance.</p>
        </div>
        <div className="bg-emerald-50 px-5 py-3 rounded-xl border border-emerald-200 flex items-center gap-3">
          <Wallet className="text-emerald-600" size={24} />
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Available Funds</span>
            <div className="text-xl font-bold text-emerald-900">₹ {Number(user.wallet?.balance || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        
        {/* Payout Form */}
        <div className="card p-6 border-t-4 border-t-primary">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Transfer Amount (₹)</label>
                <input 
                  type="number" required placeholder="0.00" autoFocus
                  value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="text-lg font-bold py-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Beneficiary Name</label>
                <input 
                  type="text" required placeholder="Full Name"
                  value={formData.accountName} onChange={e => setFormData({...formData, accountName: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Bank Name</label>
                <input 
                  type="text" required placeholder="Bank Name"
                  value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Account Number</label>
                <input 
                  type="text" required placeholder="Account Number"
                  value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">IFSC Code</label>
                <input 
                  type="text" required placeholder="IFSC Code"
                  value={formData.ifscCode} onChange={e => setFormData({...formData, ifscCode: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Transaction Remark</label>
              <input 
                type="text" placeholder="Optional remark"
                value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})}
              />
            </div>

            {message && (
              <div className={`p-4 rounded-lg flex gap-3 animate-fade-in ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full py-4 text-base shadow-lg shadow-blue-100" disabled={loading}>
              {loading ? 'Processing Transaction...' : 'Initiate Transfer'}
            </button>
            <p className="text-[10px] text-center text-gray-400 italic">
              By clicking transfer, you agree that the information provided is correct. 
              Incorrect details may lead to irreversible loss of funds.
            </p>
          </form>
        </div>

        {/* Recent Payouts */}
        <div className="card h-full flex flex-col">
          <div className="p-5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-400" />
              <h2 className="font-semibold">Recent Payouts</h2>
            </div>
            <button onClick={fetchHistory} className="text-xs text-primary font-medium">Refresh</button>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[600px]">
            {historyLoading ? (
              <div className="p-10 text-center text-gray-400">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="p-10 text-center text-gray-400">No payout records found.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {history.map(item => (
                  <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">₹{Number(item.amount).toFixed(2)}</div>
                        <div className="text-[10px] text-gray-400">{new Date(item.createdAt).toLocaleString()}</div>
                      </div>
                      <span className={`badge ${item.status === 'SUCCESS' ? 'badge-success' : item.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-[10px] space-y-1 font-mono text-gray-600">
                      <div><span className="font-bold">TO:</span> {item.accountName}</div>
                      <div><span className="font-bold">BANK:</span> {item.bankName} ({item.ifscCode})</div>
                      <div><span className="font-bold">ACC:</span> {item.accountNumber}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
