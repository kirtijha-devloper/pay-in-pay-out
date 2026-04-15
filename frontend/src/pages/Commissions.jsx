import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Settings, Plus, Trash2, Edit2, ShieldCheck, UserPlus } from 'lucide-react';

export default function Commissions() {
  const { user } = useAuth();
  const [slabs, setSlabs] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('slabs'); // 'slabs' or 'overrides'

  // Modal states
  const [isSlabModalOpen, setIsSlabModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [currentSlab, setCurrentSlab] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: slabsRes }, { data: overridesRes }] = await Promise.all([
        api.get('/commissions/slabs'),
        api.get('/commissions/overrides'),
      ]);
      if (slabsRes.success) setSlabs(slabsRes.slabs);
      if (overridesRes.success) setOverrides(overridesRes.overrides);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteSlab = async (id) => {
    if (!window.confirm('Delete this commission slab?')) return;
    try {
      await api.delete(`/commissions/slabs/${id}`);
      fetchData();
    } catch (err) {
      alert('Delete failed');
    }
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Commission Configuration</h1>
          <p className="text-muted text-sm mt-1">Manage global commission slabs and parent-level overrides.</p>
        </div>
        <div className="flex gap-2">
          {user.role === 'ADMIN' && activeTab === 'slabs' && (
            <button onClick={() => { setCurrentSlab(null); setIsSlabModalOpen(true); }} className="btn btn-primary">
              <Plus size={18} /> Add Slab
            </button>
          )}
          {['ADMIN', 'SUPER', 'DISTRIBUTOR'].includes(user.role) && activeTab === 'overrides' && (
            <button onClick={() => setIsOverrideModalOpen(true)} className="btn btn-primary">
              <UserPlus size={18} /> Set Override
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <button 
          className={`pb-2 px-4 text-sm font-medium transition-colors ${activeTab === 'slabs' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}
          onClick={() => setActiveTab('slabs')}
        >
          Global Slabs
        </button>
        <button 
          className={`pb-2 px-4 text-sm font-medium transition-colors ${activeTab === 'overrides' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}
          onClick={() => setActiveTab('overrides')}
        >
          My Overrides
        </button>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-gray-500">Loading configurations...</div>
      ) : (
        <>
          {activeTab === 'slabs' && (
            <div className="card">
              <div className="data-table-container border-none shadow-none rounded-none">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service Type</th>
                      <th>Applied On</th>
                      <th>Range (₹)</th>
                      <th>Commission</th>
                      <th>Status</th>
                      {user.role === 'ADMIN' && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {slabs.map(s => (
                      <tr key={s.id}>
                        <td className="font-semibold text-primary">{s.serviceType.replace('_', ' ')}</td>
                        <td><span className="badge badge-primary">{s.applyOnRole}</span></td>
                        <td>{s.minAmount ? `₹${s.minAmount} - ₹${s.maxAmount || '∞'}` : 'All Amounts'}</td>
                        <td>
                          <div className="font-medium text-emerald-600">
                            {s.commissionType === 'PERCENTAGE' ? `${s.commissionValue}%` : `₹${s.commissionValue}`}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${s.isActive ? 'badge-success' : 'badge-danger'}`}>
                            {s.isActive ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        {user.role === 'ADMIN' && (
                          <td>
                            <div className="flex gap-2">
                              <button onClick={() => { setCurrentSlab(s); setIsSlabModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteSlab(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {slabs.length === 0 && (
                      <tr><td colSpan="6" className="text-center py-8 text-gray-400">No global slabs configured.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'overrides' && (
            <div className="card">
              <div className="data-table-container border-none shadow-none rounded-none">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Target User</th>
                      <th>Service</th>
                      <th>Commission Override</th>
                      <th>Effective Range</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overrides.map(o => (
                      <tr key={o.id}>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-medium">{o.targetUser?.profile?.ownerName}</span>
                            <span className="text-xs text-gray-400">{o.targetUser?.email}</span>
                          </div>
                        </td>
                        <td className="text-sm">{o.serviceType}</td>
                        <td className="font-bold text-emerald-600">
                          {o.commissionType === 'PERCENTAGE' ? `${o.commissionValue}%` : `₹${o.commissionValue}`}
                        </td>
                        <td className="text-xs">₹{o.minAmount || 0} - ₹{o.maxAmount || 'Max'}</td>
                        <td>
                          <span className={`badge ${o.isActive ? 'badge-success' : 'badge-danger'}`}>
                            {o.isActive ? 'On' : 'Off'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {overrides.length === 0 && (
                      <tr><td colSpan="5" className="text-center py-8 text-gray-400">You haven't set any custom overrides for your downline yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Slab Modal (Placeholder logic for simplicity) */}
      <SlabModal 
        isOpen={isSlabModalOpen} 
        onClose={() => setIsSlabModalOpen(false)} 
        onSave={fetchData} 
        initialData={currentSlab} 
      />
      <OverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        onSave={fetchData}
      />
    </div>
  );
}

function SlabModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    serviceType: 'PAYOUT', applyOnRole: 'RETAILER', commissionType: 'FLAT', 
    commissionValue: '', minAmount: '', maxAmount: '', isActive: true
  });

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else setFormData({
      serviceType: 'PAYOUT', applyOnRole: 'RETAILER', commissionType: 'FLAT', 
      commissionValue: '', minAmount: '', maxAmount: '', isActive: true
    });
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/commissions/slabs', { ...formData, id: initialData?.id });
      onSave();
      onClose();
    } catch { alert('Save failed'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">{initialData ? 'Edit Slab' : 'Add Commission Slab'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Service</label>
              <select value={formData.serviceType} onChange={e => setFormData({...formData, serviceType: e.target.value})} className="w-full">
                <option value="PAYOUT">Payout</option>
                <option value="BANK_VERIFICATION">Bank Verification</option>
                <option value="FUND_REQUEST">Fund Request</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Role</label>
              <select value={formData.applyOnRole} onChange={e => setFormData({...formData, applyOnRole: e.target.value})} className="w-full">
                <option value="RETAILER">Retailer</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="SUPER">Super</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Type</label>
              <select value={formData.commissionType} onChange={e => setFormData({...formData, commissionType: e.target.value})} className="w-full">
                <option value="FLAT">Flat (₹)</option>
                <option value="PERCENTAGE">Percentage (%)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Value</label>
              <input type="number" step="0.01" value={formData.commissionValue} onChange={e => setFormData({...formData, commissionValue: e.target.value})} required className="w-full" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Slab</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OverrideModal({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    targetUserId: '', serviceType: 'PAYOUT', commissionType: 'FLAT', commissionValue: ''
  });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      api.get('/users').then(res => setUsers(res.data.users));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/commissions/overrides', formData);
      onSave();
      onClose();
    } catch { alert('Save failed'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4 text-emerald-700">Set Custom Override</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase">Target User</label>
            <select value={formData.targetUserId} onChange={e => setFormData({...formData, targetUserId: e.target.value})} required className="w-full">
              <option value="">Select a user...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.profile?.ownerName} ({u.role})</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase">Service</label>
            <select value={formData.serviceType} onChange={e => setFormData({...formData, serviceType: e.target.value})} className="w-full">
              <option value="PAYOUT">Payout</option>
              <option value="BANK_VERIFICATION">Bank Verification</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Type</label>
              <select value={formData.commissionType} onChange={e => setFormData({...formData, commissionType: e.target.value})} className="w-full">
                <option value="FLAT">Flat (₹)</option>
                <option value="PERCENTAGE">Percentage (%)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Value</label>
              <input type="number" step="0.01" value={formData.commissionValue} onChange={e => setFormData({...formData, commissionValue: e.target.value})} required className="w-full" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" className="btn btn-primary bg-emerald-600 hover:bg-emerald-700">Set Override</button>
          </div>
        </form>
      </div>
    </div>
  );
}
