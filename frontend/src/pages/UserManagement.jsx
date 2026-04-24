import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Filter, RefreshCw, X, Edit2, Trash2, LogIn, MoreVertical, Settings, Banknote, CheckCircle2 } from 'lucide-react';

const ROLE_OPTIONS = {
  ADMIN: ['SUPER', 'DISTRIBUTOR', 'RETAILER'],
  SUPER: ['DISTRIBUTOR', 'RETAILER'],
  DISTRIBUTOR: ['RETAILER'],
};

const ROLE_LABELS = {
  ADMIN: 'Admin',
  SUPER: 'Super Distributor',
  DISTRIBUTOR: 'Distributor',
  RETAILER: 'Retailer',
};

const EMPTY_CREATE_FORM = {
  email: '',
  password: '',
  role: 'RETAILER',
  ownerName: '',
  shopName: '',
  mobileNumber: '',
  fullAddress: '',
  state: '',
  pinCode: '',
  aadhaarNumber: '',
  parentId: '',
};

const EMPTY_FILES = {
  aadhaarFront: null,
  aadhaarBack: null,
  panCard: null,
};

const buildEditForm = (user) => ({
  email: user?.email || '',
  ownerName: user?.profile?.ownerName || '',
  shopName: user?.profile?.shopName || '',
  mobileNumber: user?.profile?.mobileNumber || '',
  fullAddress: user?.profile?.fullAddress || '',
  state: user?.profile?.state || '',
  pinCode: user?.profile?.pinCode || '',
  aadhaarNumber: user?.profile?.aadhaarNumber || '',
});

const getAvailableRoles = (role) => ROLE_OPTIONS[role] || [];

const getDefaultRole = (role) => {
  const roles = getAvailableRoles(role);
  if (roles.includes('RETAILER')) return 'RETAILER';
  return roles[0] || '';
};

const formatSummaryPrimary = (summary) => {
  if (!summary) return '-';
  return summary.ownerName || summary.shopName || summary.email;
};

const formatSummarySecondary = (summary) => {
  if (!summary) return '';
  return `${ROLE_LABELS[summary.role] || summary.role} • ${summary.email}`;
};

const HierarchyStack = ({ user }) => (
  <div className="space-y-1 text-xs text-gray-500">
    <div>
      <span className="font-medium text-gray-700">Admin:</span> {formatSummaryPrimary(user?.upline?.admin)}
    </div>
    <div>
      <span className="font-medium text-gray-700">Super:</span> {formatSummaryPrimary(user?.upline?.super)}
    </div>
    <div>
      <span className="font-medium text-gray-700">Distributor:</span> {formatSummaryPrimary(user?.upline?.distributor)}
    </div>
  </div>
);

const CreateUserModal = ({ isOpen, onClose, onUserCreated }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(EMPTY_CREATE_FORM);
  const [files, setFiles] = useState(EMPTY_FILES);

  const availableRoles = getAvailableRoles(user?.role);

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    setLoading(false);
    setFiles(EMPTY_FILES);
    setFormData({
      ...EMPTY_CREATE_FORM,
      role: getDefaultRole(user?.role),
      parentId: user?.id || '',
    });
    fetchPotentialParents();
  }, [isOpen, user?.id, user?.role]);

  const [potentialParents, setPotentialParents] = useState([]);

  const fetchPotentialParents = async () => {
    try {
      const { data } = await api.get('/users?limit=100'); // Fetch a good number of potential parents
      if (data.success) {
        setPotentialParents(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch parents:', err);
    }
  };

  const getEligibleParents = () => {
    // Logic: A user can only be a parent of a lower role
    // Role Hierarchy: ADMIN > SUPER > DISTRIBUTOR > RETAILER
    const hierarchy = ['ADMIN', 'SUPER', 'DISTRIBUTOR', 'RETAILER'];
    const currentRoleIdx = hierarchy.indexOf(formData.role);
    
    return potentialParents.filter(p => {
      const parentRoleIdx = hierarchy.indexOf(p.role);
      return parentRoleIdx < currentRoleIdx;
    });
  };

  if (!isOpen) return null;

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => setFiles({ ...files, [e.target.name]: e.target.files?.[0] || null });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => data.append(key, value));
    if (files.aadhaarFront) data.append('aadhaarFront', files.aadhaarFront);
    if (files.aadhaarBack) data.append('aadhaarBack', files.aadhaarBack);
    if (files.panCard) data.append('panCard', files.panCard);

    try {
      const res = await api.post('/users', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        onUserCreated();
        onClose();
      } else {
        setError(res.data.message || 'Failed to create user');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error occurred');
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in shadow-2xl">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="create-user-form" onSubmit={handleSubmit} className="space-y-8">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Account Details</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Role</label>
                <select name="role" required value={formData.role} onChange={handleInputChange} className="w-full">
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role] || role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Email</label>
                <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Parent/Upline</label>
                <select name="parentId" value={formData.parentId} onChange={handleInputChange} className="w-full">
                  <option value={user?.id}>Myself ({user?.email})</option>
                  {getEligibleParents().map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.profile?.ownerName || p.email} ({ROLE_LABELS[p.role]})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 italic">Select who this user should report to.</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Password</label>
                <input type="password" name="password" required minLength="6" value={formData.password} onChange={handleInputChange} className="w-full" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Profile Details</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Owner Name</label>
                <input type="text" name="ownerName" value={formData.ownerName} onChange={handleInputChange} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Shop/Business Name</label>
                <input type="text" name="shopName" value={formData.shopName} onChange={handleInputChange} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Mobile Number</label>
                <input type="tel" name="mobileNumber" minLength="10" maxLength="10" value={formData.mobileNumber} onChange={handleInputChange} className="w-full" />
              </div>
            </div>

            <div className="space-y-4 md:col-span-2">
              <h3 className="font-medium text-gray-900 border-b pb-2">Address Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">Full Address</label>
                  <input type="text" name="fullAddress" value={formData.fullAddress} onChange={handleInputChange} className="w-full" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">State</label>
                  <input type="text" name="state" value={formData.state} onChange={handleInputChange} className="w-full" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">PIN Code</label>
                  <input type="text" name="pinCode" value={formData.pinCode} onChange={handleInputChange} className="w-full" />
                </div>
              </div>
            </div>

            <div className="space-y-4 md:col-span-2">
              <h3 className="font-medium text-gray-900 border-b pb-2">KYC Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">Aadhaar Number</label>
                  <input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleInputChange} className="w-full" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">Aadhaar Front Image</label>
                  <input type="file" name="aadhaarFront" accept="image/*" onChange={handleFileChange} className="w-full p-1" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">Aadhaar Back Image</label>
                  <input type="file" name="aadhaarBack" accept="image/*" onChange={handleFileChange} className="w-full p-1" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">PAN Card Image</label>
                  <input type="file" name="panCard" accept="image/*" onChange={handleFileChange} className="w-full p-1" />
                </div>
              </div>
            </div>
          </div>

          </form>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>
            Cancel
          </button>
          <button 
            type="submit" 
            form="create-user-form"
            className="btn btn-primary min-w-[120px]" 
            disabled={loading || availableRoles.length === 0}
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditUserModal = ({ isOpen, onClose, user, onUserUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(buildEditForm(user));

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setLoading(false);
    setFormData(buildEditForm(user));
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.patch(`/users/${user.id}`, formData);
      if (res.data.success) {
        onUserUpdated();
        onClose();
      } else {
        setError(res.data.message || 'Failed to update user');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error occurred');
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in shadow-2xl">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="edit-user-form" onSubmit={handleSubmit} className="space-y-8">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase text-gray-500 mb-1">Added By</div>
              <div className="font-medium text-gray-900">{formatSummaryPrimary(user.createdBy)}</div>
              <div className="text-xs text-gray-500">{formatSummarySecondary(user.createdBy) || '-'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500 mb-1">Hierarchy</div>
              <HierarchyStack user={user} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Account Details</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Email</label>
                <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="w-full" disabled />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Profile Details</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Owner Name</label>
                <input type="text" name="ownerName" required value={formData.ownerName} onChange={handleInputChange} className="w-full" />
              </div>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-gray-700 uppercase">Shop/Business Name</label>
              <input type="text" name="shopName" required value={formData.shopName} onChange={handleInputChange} className="w-full" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 uppercase">Mobile Number</label>
              <input type="tel" name="mobileNumber" required minLength="10" maxLength="10" value={formData.mobileNumber} onChange={handleInputChange} className="w-full" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 uppercase">Aadhaar Number</label>
              <input type="text" name="aadhaarNumber" required value={formData.aadhaarNumber} onChange={handleInputChange} className="w-full" />
            </div>

            <div className="space-y-4 md:col-span-2">
              <h3 className="font-medium text-gray-900 border-b pb-2">Address Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">Full Address</label>
                  <input type="text" name="fullAddress" required value={formData.fullAddress} onChange={handleInputChange} className="w-full" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">State</label>
                  <input type="text" name="state" required value={formData.state} onChange={handleInputChange} className="w-full" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">PIN Code</label>
                  <input type="text" name="pinCode" required value={formData.pinCode} onChange={handleInputChange} className="w-full" />
                </div>
              </div>
            </div>
          </div>

          </form>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>
            Cancel
          </button>
          <button type="submit" form="edit-user-form" className="btn btn-primary min-w-[120px]" disabled={loading}>
            {loading ? 'Updating...' : 'Update User'}
          </button>
        </div>
      </div>
    </div>
  );
};

function formatChargeValue(type, value) {
  if (type === 'PERCENTAGE') return `${Number(value || 0).toFixed(2)}%`;
  return `₹ ${Number(value || 0).toFixed(2)}`;
}

const UserChargesModal = ({ isOpen, onClose, targetUser }) => {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    serviceType: 'PAYOUT',
    commissionType: 'FLAT',
    commissionValue: '',
    minAmount: '',
    maxAmount: '',
    isActive: true,
  });

  const fetchOverrides = async () => {
    if (!targetUser) return;
    setLoading(true);
    try {
      const { data } = await api.get('/commissions/overrides');
      if (data.success) {
        setOverrides(data.overrides.filter(o => o.targetUserId === targetUser.id));
      }
    } catch (err) {
      setError('Failed to load charges');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && targetUser) {
      fetchOverrides();
      resetForm();
    }
  }, [isOpen, targetUser]);

  const resetForm = () => {
    setFormData({
      serviceType: 'PAYOUT',
      commissionType: 'FLAT',
      commissionValue: '',
      minAmount: '',
      maxAmount: '',
      isActive: true,
    });
    setEditingId(null);
    setError('');
  };

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const payload = {
      ...formData,
      targetUserId: targetUser.id,
      id: editingId,
      maxAmount: formData.maxAmount === '' ? null : formData.maxAmount
    };

    try {
      if (editingId) {
        await api.put('/commissions/overrides', payload);
      } else {
        await api.post('/commissions/overrides', payload);
      }
      fetchOverrides();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save charge');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this charge slab?')) return;
    try {
      await api.delete(`/commissions/overrides/${id}`);
      fetchOverrides();
    } catch (err) {
      setError('Failed to delete charge');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold">Edit User Charges</h2>
            <p className="text-xs text-gray-500">Managing for: <span className="font-bold text-primary">{targetUser.profile?.ownerName || targetUser.email}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* List Existing Overrides */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider">Current Charge Slabs</h3>
            {loading ? (
              <div className="py-10 text-center text-gray-400">Loading slabs...</div>
            ) : overrides.length === 0 ? (
              <div className="py-10 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">No custom charges set for this user.</div>
            ) : (
              <div className="data-table-container border rounded-xl overflow-hidden shadow-sm">
                <table className="data-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th>Service</th>
                      <th>Range</th>
                      <th>Charge</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overrides.map((ov) => (
                      <tr key={ov.id}>
                        <td className="font-bold text-primary">{ov.serviceType}</td>
                        <td className="text-xs">₹{Number(ov.minAmount).toFixed(0)} - {ov.maxAmount ? `₹${Number(ov.maxAmount).toFixed(0)}` : 'Max'}</td>
                        <td className="font-bold text-emerald-600">{formatChargeValue(ov.commissionType, ov.commissionValue)}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <button 
                              onClick={() => {
                                setEditingId(ov.id);
                                setFormData({
                                  serviceType: ov.serviceType,
                                  commissionType: ov.commissionType,
                                  commissionValue: ov.commissionValue,
                                  minAmount: ov.minAmount,
                                  maxAmount: ov.maxAmount === null ? '' : ov.maxAmount,
                                  isActive: ov.isActive,
                                });
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDelete(ov.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Add/Edit Form */}
          <form onSubmit={handleSubmit} className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider">
              {editingId ? 'Edit Slabs' : 'Add New Charge Slab'}
            </h3>
            
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Service Type</label>
                <select 
                  value={formData.serviceType} 
                  onChange={(e) => setFormData({...formData, serviceType: e.target.value})}
                  className="w-full"
                >
                  <option value="PAYOUT">Payout</option>
                  <option value="FUND_REQUEST">Fund Request</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Charge Type</label>
                <select 
                  value={formData.commissionType} 
                  onChange={(e) => setFormData({...formData, commissionType: e.target.value})}
                  className="w-full"
                >
                  <option value="FLAT">Flat Fee (₹)</option>
                  <option value="PERCENTAGE">Percentage (%)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Amount Slab (Min)</label>
                <input 
                  type="number" required value={formData.minAmount}
                  onChange={(e) => setFormData({...formData, minAmount: e.target.value})}
                  placeholder="0" className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Amount Slab (Max)</label>
                <input 
                  type="number" value={formData.maxAmount}
                  onChange={(e) => setFormData({...formData, maxAmount: e.target.value})}
                  placeholder="Max" className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Charge Value</label>
                <input 
                  type="number" step="0.01" required value={formData.commissionValue}
                  onChange={(e) => setFormData({...formData, commissionValue: e.target.value})}
                  placeholder="0.00" className="w-full"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:underline">
                  Cancel Editing
                </button>
              )}
              <button type="submit" className="btn btn-primary ml-auto flex items-center gap-2 px-6">
                <Plus size={16} /> {editingId ? 'Update Slab' : 'Save New Slab'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const WalletHoldModal = ({ isOpen, onClose, user, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [minimumHold, setMinimumHold] = useState(user?.wallet?.minimumHold || 0);

  useEffect(() => {
    if (isOpen && user) {
      setMinimumHold(user.wallet?.minimumHold || 0);
      setError('');
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.patch(`/users/${user.id}/wallet-hold`, { minimumHold });
      if (res.data.success) {
        onUpdated();
        onClose();
      } else {
        setError(res.data.message || 'Failed to update hold');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error occurred');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col animate-fade-in shadow-2xl">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Banknote className="text-orange-500" size={24} /> Wallet Hold
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-orange-50 p-3 rounded-lg text-xs text-orange-800 border border-orange-100">
            Set a minimum balance that this user must always maintain in their wallet. They will not be able to use funds below this amount.
          </div>

          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Minimum Hold Amount (₹)</label>
            <input 
              type="number" 
              step="0.01" 
              required 
              value={minimumHold} 
              onChange={(e) => setMinimumHold(e.target.value)} 
              className="w-full text-lg font-bold"
              placeholder="0.00"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary min-w-[120px]" disabled={loading}>
              {loading ? 'Saving...' : 'Set Hold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isChargesModalOpen, setIsChargesModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const canManageUsers = ['ADMIN', 'SUPER', 'DISTRIBUTOR'].includes(user.role);
  const canDeleteUsers = user.role === 'ADMIN';
  const canSetHold = user.role === 'ADMIN';
  const canImpersonate = user.role === 'ADMIN';
  const filterRoles = getAvailableRoles(user.role);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (filterRole) params.append('role', filterRole);
      if (filterStatus) params.append('status', filterStatus);

      const { data } = await api.get(`/users?${params.toString()}`);
      if (data.success) {
        setUsers(data.users);
        setTotalPages(Math.ceil(data.total / 10) || 1);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [page, filterRole, filterStatus]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-menu-container]')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const toggleStatus = async (userId, currentStatus) => {
    try {
      const { data } = await api.patch(`/users/${userId}/toggle`);
      if (data.success) {
        window.location.reload();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const deleteUser = async (userId, userName) => {
    try {
      const { data } = await api.delete(`/users/${userId}`);
      if (data.success) {
        alert('User deleted successfully');
        window.location.reload();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const loginAsUser = async (userId, userEmail) => {
    try {
      // Open popup synchronously before any async operations to bypass browser popup blockers.
      const newTab = window.open('about:blank', '_blank');
      if (!newTab) {
        alert('Popup blocked by browser. Please allow popups for this site and try again.');
        return;
      }

      const res = await api.post(`/users/${userId}/login-as`);
      const data = res.data;
      
      if (data.success && data.token) {
        const loginAsUrl = `${window.location.origin}/?impersonationToken=${encodeURIComponent(data.token)}`;
        newTab.location.href = loginAsUrl;
      } else {
        newTab.close();
        alert('Failed to obtain impersonation token: ' + JSON.stringify(data));
      }
    } catch (err) {
      if (newTab && !newTab.closed) newTab.close();
      alert('Login As failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'badge-primary bg-blue-100 text-blue-800';
      case 'SUPER':
        return 'badge-success bg-emerald-100 text-emerald-800';
      case 'DISTRIBUTOR':
        return 'bg-purple-100 text-purple-800 badge';
      case 'RETAILER':
        return 'badge bg-gray-100 text-gray-800';
      default:
        return 'badge bg-gray-100';
    }
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted text-sm mt-1">Manage your full downline hierarchy and who added each user.</p>
        </div>
        {canManageUsers && (
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus size={18} /> New User
          </button>
        )}
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3"
            >
              <option value="">All Roles</option>
              {filterRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role] || role}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3"
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
          <button onClick={fetchUsers} className="btn btn-outline py-1.5 px-3 text-xs ml-auto">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="data-table-container border-none shadow-none rounded-none">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">ID</th>
                <th>User Details</th>
                <th>Role</th>
                <th>Hierarchy</th>
                <th>Balance</th>
                <th>Status</th>
                <th>KYC</th>
                <th>Joined</th>
                <th className="sticky-col-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    No users found in your downline.
                  </td>
                </tr>
              ) : (
                users.map((managedUser) => (
                  <tr key={managedUser.id} className={!managedUser.isActive ? 'opacity-60 bg-gray-50' : ''}>
                    <td className="sticky-col">
                      <span className="text-[10px] font-mono font-bold text-gray-400 bg-white px-1 rounded">
                        #{managedUser.id.substring(0, 6)}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-gray-900">{managedUser.profile?.ownerName || 'N/A'}</span>
                        <span className="text-xs text-gray-500">{managedUser.profile?.shopName || 'No Shop Name'}</span>
                        <span className="text-[10px] text-gray-400">{managedUser.email}</span>
                        <span className="text-[11px] text-gray-500">
                          <span className="font-medium text-gray-700">Added by:</span>{' '}
                          {formatSummaryPrimary(managedUser.createdBy)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getRoleBadgeClass(managedUser.role)}`}>
                        {ROLE_LABELS[managedUser.role] || managedUser.role}
                      </span>
                    </td>
                    <td>
                      <HierarchyStack user={managedUser} />
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <div className="font-medium text-emerald-600">
                          Rs {Number(managedUser.wallet?.balance || 0).toFixed(2)}
                        </div>
                        {Number(managedUser.wallet?.minimumHold || 0) > 0 && (
                          <div className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5" title="Minimum balance hold">
                            <Banknote size={10} /> Hold: ₹{Number(managedUser.wallet.minimumHold).toFixed(0)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${managedUser.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {managedUser.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${managedUser.kycStatus === 'VERIFIED' ? 'badge-success' : managedUser.kycStatus === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                        {managedUser.kycStatus}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-500">
                        {new Date(managedUser.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="sticky-col-right">
                      {canManageUsers ? (
                        <div className="relative inline-block" data-menu-container>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === managedUser.id ? null : managedUser.id);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-md border border-gray-200 inline-flex items-center justify-center"
                            title="Actions"
                          >
                            <MoreVertical size={16} className="text-gray-600" />
                          </button>

                          {openMenuId === managedUser.id && (
                            <div
                              className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in"
                              style={{ minWidth: '160px' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setSelectedUser(managedUser);
                                  setIsEditModalOpen(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 text-blue-600 flex items-center gap-3 border-b border-gray-50 text-sm font-medium whitespace-nowrap transition-colors"
                              >
                                <Edit2 size={16} /> Edit User
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedUser(managedUser);
                                  setIsChargesModalOpen(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-emerald-50 text-emerald-600 flex items-center gap-3 border-b border-gray-50 text-sm font-medium whitespace-nowrap transition-colors"
                              >
                                <Settings size={16} /> Edit Charges
                              </button>

                              {canSetHold && (
                                <button
                                  onClick={() => {
                                    setSelectedUser(managedUser);
                                    setIsHoldModalOpen(true);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-orange-50 text-orange-600 flex items-center gap-3 border-b border-gray-50 text-sm font-medium whitespace-nowrap transition-colors"
                                >
                                  <Banknote size={16} /> Wallet Hold
                                </button>
                              )}

                              {canImpersonate && (
                                <button
                                  onClick={() => {
                                    loginAsUser(managedUser.id, managedUser.email);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-indigo-600 flex items-center gap-3 border-b border-gray-50 text-sm font-medium whitespace-nowrap transition-colors"
                                >
                                  <LogIn size={16} /> Login As
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  toggleStatus(managedUser.id, managedUser.isActive);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-emerald-50 text-emerald-600"
                              >
                                {managedUser.isActive ? <X size={16} /> : <CheckCircle2 size={16} />}
                                {managedUser.isActive ? 'Disable' : 'Enable'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">View only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
          <span>
            Showing page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="px-3 py-1 border rounded disabled:opacity-50">
              Prev
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <CreateUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onUserCreated={fetchUsers} />
      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={selectedUser}
        onUserUpdated={fetchUsers}
      />
      <UserChargesModal
        isOpen={isChargesModalOpen}
        onClose={() => setIsChargesModalOpen(false)}
        targetUser={selectedUser}
      />
      <WalletHoldModal
        isOpen={isHoldModalOpen}
        onClose={() => setIsHoldModalOpen(false)}
        user={selectedUser}
        onUpdated={fetchUsers}
      />
    </div>
  );
}
