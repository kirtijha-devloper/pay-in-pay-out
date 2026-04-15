import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Filter, RefreshCw, X, Upload, Edit2, Trash2, LogIn, MoreVertical } from 'lucide-react';

const CreateUserModal = ({ isOpen, onClose, onUserCreated }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '', password: '', role: 'RETAILER',
    ownerName: '', shopName: '', mobileNumber: '',
    fullAddress: '', state: '', pinCode: '', aadhaarNumber: ''
  });

  const [files, setFiles] = useState({
    aadhaarFront: null, aadhaarBack: null, panCard: null
  });

  if (!isOpen) return null;

  const getAvailableRoles = () => {
    switch (user.role) {
      case 'ADMIN': return ['SUPER', 'DISTRIBUTOR', 'RETAILER'];
      case 'SUPER': return ['DISTRIBUTOR', 'RETAILER'];
      case 'DISTRIBUTOR': return ['RETAILER'];
      default: return [];
    }
  };

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => setFiles({ ...files, [e.target.name]: e.target.files[0] });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    if (files.aadhaarFront) data.append('aadhaarFront', files.aadhaarFront);
    if (files.aadhaarBack) data.append('aadhaarBack', files.aadhaarBack);
    if (files.panCard) data.append('panCard', files.panCard);

    try {
      const res = await api.post('/users', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-semibold">Create New User</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Info */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Account Details</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Role</label>
                <select name="role" required value={formData.role} onChange={handleInputChange} className="w-full">
                  {getAvailableRoles().map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Email</label>
                <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Password</label>
                <input type="password" name="password" required minLength="6" value={formData.password} onChange={handleInputChange} className="w-full" />
              </div>
            </div>

            {/* Profile Info */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Profile Details</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Owner Name</label>
                <input type="text" name="ownerName" required value={formData.ownerName} onChange={handleInputChange} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Shop/Business Name</label>
                <input type="text" name="shopName" required value={formData.shopName} onChange={handleInputChange} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Mobile Number</label>
                <input type="tel" name="mobileNumber" required minLength="10" maxLength="10" value={formData.mobileNumber} onChange={handleInputChange} className="w-full" />
              </div>
            </div>
            
            {/* Address */}
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

            <div className="space-y-4 md:col-span-2">
              <h3 className="font-medium text-gray-900 border-b pb-2">KYC Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 uppercase">Aadhaar Number</label>
                  <input type="text" name="aadhaarNumber" required value={formData.aadhaarNumber} onChange={handleInputChange} className="w-full" />
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

          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary min-w-[120px]" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const EditUserModal = ({ isOpen, onClose, user, onUserUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: user?.email || '',
    ownerName: user?.profile?.ownerName || '',
    shopName: user?.profile?.shopName || '',
    mobileNumber: user?.profile?.mobileNumber || '',
    fullAddress: user?.profile?.fullAddress || '',
    state: user?.profile?.state || '',
    pinCode: user?.profile?.pinCode || '',
    aadhaarNumber: user?.profile?.aadhaarNumber || ''
  });

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-semibold">Edit User</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Info */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Account Details</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 uppercase">Email</label>
                <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="w-full" disabled />
              </div>
            </div>

            {/* Profile Info */}
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
            
            {/* Address */}
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

          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary min-w-[120px]" disabled={loading}>
              {loading ? 'Updating...' : 'Update User'}
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
  const [selectedUser, setSelectedUser] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
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
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const toggleStatus = async (userId, currentStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'disable' : 'enable'} this user?`)) return;
    try {
      const { data } = await api.patch(`/users/${userId}/toggle`);
      if (data.success) {
        fetchUsers();
      }
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) return;
    try {
      const { data } = await api.delete(`/users/${userId}`);
      if (data.success) {
        fetchUsers();
        alert('User deleted successfully');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const loginAsUser = async (userId, userEmail) => {
    if (!window.confirm(`Login as ${userEmail}?`)) return;
    try {
      const { data } = await api.post(`/users/${userId}/login-as`);
      if (data.success && data.token) {
        // Store the new token and redirect
        localStorage.setItem('authToken', data.token);
        window.location.href = '/dashboard';
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to login as user');
    }
  };

  const getRoleBadgeClass = (role) => {
    switch(role) {
      case 'ADMIN': return 'badge-primary bg-blue-100 text-blue-800';
      case 'SUPER': return 'badge-success bg-emerald-100 text-emerald-800';
      case 'DISTRIBUTOR': return 'bg-purple-100 text-purple-800 badge';
      case 'RETAILER': return 'badge bg-gray-100 text-gray-800';
      default: return 'badge bg-gray-100';
    }
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted text-sm mt-1">Manage your downline hierarchy and retail network.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={18} /> New User
        </button>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select value={filterRole} onChange={e => {setFilterRole(e.target.value); setPage(1);}} className="py-1.5 px-3">
              <option value="">All Roles</option>
              {user.role === 'ADMIN' && <option value="SUPER">Super Distributors</option>}
              {['ADMIN', 'SUPER'].includes(user.role) && <option value="DISTRIBUTOR">Distributors</option>}
              <option value="RETAILER">Retailers</option>
            </select>
            <select value={filterStatus} onChange={e => {setFilterStatus(e.target.value); setPage(1);}} className="py-1.5 px-3">
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
          <button onClick={fetchUsers} className="btn btn-outline py-1.5 px-3 text-xs ml-auto">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Table */}
        <div className="data-table-container border-none shadow-none rounded-none">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User Details</th>
                <th>Role</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center py-8 text-gray-500">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-8 text-gray-500">No users found matching the criteria.</td></tr>
              ) : (
                users.map(u => (
                   <tr key={u.id} className={!u.isActive ? 'opacity-60 bg-gray-50' : ''}>
                    <td>
                      <span className="text-[10px] font-mono font-bold text-gray-400">#{u.id.substring(0, 6)}</span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                         <span className="font-semibold text-gray-900">{u.profile?.ownerName || 'N/A'}</span>
                         <span className="text-xs text-gray-500">{u.profile?.shopName || 'No Shop Name'}</span>
                         <span className="text-[10px] text-gray-400">{u.email}</span>
                      </div>
                    </td>
                    <td>
                       <span className={`badge ${getRoleBadgeClass(u.role)}`}>{u.role}</span>
                    </td>
                    <td>
                       <div className="font-medium text-emerald-600">₹{Number(u.wallet?.balance || 0).toFixed(2)}</div>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td>
                      <div className="relative inline-block">
                        <button 
                          onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                          className="p-2 hover:bg-gray-100 rounded-md border border-gray-200 inline-flex items-center justify-center"
                          title="Actions"
                        >
                          <MoreVertical size={16} className="text-gray-600" />
                        </button>
                        
                        {openMenuId === u.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button 
                              onClick={() => { 
                                setSelectedUser(u); 
                                setIsEditModalOpen(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-blue-600 flex items-center gap-2 border-b border-gray-100 text-sm"
                            >
                              <Edit2 size={14} /> Edit User
                            </button>
                            
                            {user.role === 'ADMIN' && (
                              <button 
                                onClick={() => {
                                  loginAsUser(u.id, u.email);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-purple-50 text-purple-600 flex items-center gap-2 border-b border-gray-100 text-sm"
                              >
                                <LogIn size={14} /> Login As
                              </button>
                            )}
                            
                            <button 
                              onClick={() => {
                                toggleStatus(u.id, u.isActive);
                                setOpenMenuId(null);
                              }}
                              className={`w-full text-left px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 text-sm ${u.isActive ? 'hover:bg-red-50 text-red-600' : 'hover:bg-emerald-50 text-emerald-600'}`}
                            >
                              {u.isActive ? '⊘ Disable' : '✓ Enable'}
                            </button>
                            
                            <button 
                              onClick={() => {
                                deleteUser(u.id, u.profile?.ownerName || u.email);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="p-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
          <span>Showing page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      <CreateUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onUserCreated={fetchUsers} />
      <EditUserModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} user={selectedUser} onUserUpdated={fetchUsers} />
    </div>
  );
}
