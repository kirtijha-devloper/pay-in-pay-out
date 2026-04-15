import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Wallet, Plus, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';

const RequestModal = ({ isOpen, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    amount: '', bankRef: '', paymentMode: 'IMPS', paymentDate: new Date().toISOString().split('T')[0], remark: ''
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/services/fund-request', {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      if (res.data.success) {
        onCreated();
        onClose();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Submission failed');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">New Fund Request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-500">Amount (₹)</label>
            <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-500">Bank Reference / UTR</label>
            <input type="text" required value={formData.bankRef} onChange={e => setFormData({...formData, bankRef: e.target.value})} placeholder="Enter 12-digit UTR" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-500">Payment Mode</label>
              <select value={formData.paymentMode} onChange={e => setFormData({...formData, paymentMode: e.target.value})}>
                <option value="IMPS">IMPS</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="UPI">UPI / QR</option>
                <option value="CASH_DEPOSIT">Cash Deposit</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-500">Payment Date</label>
              <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-500">Remark (Optional)</label>
            <textarea value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} rows="2" placeholder="e.g. deposited in ICICI Bank"></textarea>
          </div>
          <button type="submit" className="btn btn-primary w-full py-3 mt-4" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default function FundRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('PENDING');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/services?serviceType=FUND_REQUEST${filterStatus ? `&status=${filterStatus}` : ''}`);
      if (data.success) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  const handleAction = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;
    try {
      const endpoint = action === 'approve' ? `/services/fund-request/${id}/approve` : `/services/fund-request/${id}/reject`;
      const res = await api.patch(endpoint);
      if (res.data.success) {
        fetchRequests();
      }
    } catch (err) {
      alert(err.response?.data?.message || `${action} failed`);
    }
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Fund Requests</h1>
          <p className="text-muted text-sm mt-1">Manage wallet top-up requests and tracking.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary shadow-lg shadow-blue-200">
          <Plus size={18} /> New Request
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex gap-2">
            {['PENDING', 'SUCCESS', 'FAILED'].map(s => (
              <button 
                key={s} 
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${filterStatus === s ? 'bg-primary text-white' : 'bg-white border text-gray-500'}`}
              >
                {s}
              </button>
            ))}
            <button onClick={() => setFilterStatus('')} className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${filterStatus === '' ? 'bg-primary text-white' : 'bg-white border text-gray-500'}`}>
              ALL
            </button>
          </div>
        </div>

        <div className="data-table-container border-none shadow-none rounded-none">
          <table className="data-table">
            <thead>
              <tr>
                <th>User / Date</th>
                <th>Amount (₹)</th>
                <th>Method / Ref</th>
                <th>Status</th>
                {user.role === 'ADMIN' && <th>Admin Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center py-10 text-gray-400">Loading requests...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-10 text-gray-400">No {filterStatus.toLowerCase()} requests found.</td></tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-semibold">{req.user?.profile?.ownerName || req.user?.email}</span>
                        <span className="text-[10px] text-gray-400">{new Date(req.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                    <td><span className="font-bold text-lg">₹{Number(req.amount).toFixed(2)}</span></td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-primary">{req.paymentMode}</span>
                        <span className="text-xs text-gray-500 font-mono tracking-tight">{req.bankRef}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${req.status === 'SUCCESS' ? 'badge-success' : req.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>
                        {req.status}
                      </span>
                    </td>
                    {user.role === 'ADMIN' && (
                      <td>
                        {req.status === 'PENDING' ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleAction(req.id, 'approve')} className="p-1 px-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded border border-emerald-200 text-xs font-bold transition-all">
                              APPROVE
                            </button>
                            <button onClick={() => handleAction(req.id, 'reject')} className="p-1 px-2 bg-red-50 text-red-600 hover:bg-red-100 rounded border border-red-200 text-xs font-bold transition-all">
                              REJECT
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Actioned</span>
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

      <RequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreated={fetchRequests} />
    </div>
  );
}
