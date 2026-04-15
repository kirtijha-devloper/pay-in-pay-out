import React, { useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Building, Save, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Form States
  const [profileData, setProfileData] = useState({
    ownerName: user.profile?.ownerName || '',
    shopName: user.profile?.shopName || '',
    mobileNumber: user.profile?.mobileNumber || '',
    fullAddress: user.profile?.fullAddress || '',
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '', newPassword: '', confirmPassword: ''
  });

  const [pinData, setPinData] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: '',
  });

  const [bankData, setBankData] = useState({
    bankName: '', accountName: '', accountNumber: '', ifscCode: ''
  });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.patch('/users/profile', profileData);
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed' });
    }
    setLoading(false);
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return setMessage({ type: 'error', text: 'New passwords do not match' });
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.patch('/auth/change-password', passwordData);
      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Change failed' });
    }
    setLoading(false);
  };

  const handlePinUpdate = async (e) => {
    e.preventDefault();
    if (pinData.newPin !== pinData.confirmPin) {
      return setMessage({ type: 'error', text: 'Transaction PIN confirmation does not match' });
    }

    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.patch('/auth/transaction-pin', pinData);
      if (data.success) {
        setMessage({ type: 'success', text: 'Transaction PIN updated successfully!' });
        setPinData({ currentPin: '', newPin: '', confirmPin: '' });
        await refreshUser();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'PIN update failed' });
    }
    setLoading(false);
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-muted text-sm mt-1">Manage your profile, security, and banking information.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="card h-fit lg:col-span-1 p-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'profile' ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <User size={18} /> Edit Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'password' ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Lock size={18} /> Change Password
          </button>
          <button
            onClick={() => setActiveTab('pin')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'pin' ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <ShieldCheck size={18} /> Transaction PIN
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'bank' ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Building size={18} /> Bank Details
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 card p-8">
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex gap-3 animate-fade-in ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="max-w-xl space-y-6">
              <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Profile Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Full Name</label>
                  <input type="text" value={profileData.ownerName} onChange={e => setProfileData({...profileData, ownerName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Shop Name</label>
                  <input type="text" value={profileData.shopName} onChange={e => setProfileData({...profileData, shopName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Mobile Number</label>
                  <input type="text" value={profileData.mobileNumber} readOnly className="bg-gray-50 cursor-not-allowed" />
                </div>
                <div className="space-y-1 text-xs text-gray-400 mt-6 italic">
                  * Mobile number cannot be changed once verified.
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-500">Address</label>
                <textarea rows="3" value={profileData.fullAddress} onChange={e => setProfileData({...profileData, fullAddress: e.target.value})}></textarea>
              </div>
              <button type="submit" className="btn btn-primary px-8" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordUpdate} className="max-w-md space-y-6">
              <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Change Account Password</h2>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Current Password</label>
                  <input type="password" required value={passwordData.oldPassword} onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">New Password</label>
                  <input type="password" required minLength="6" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Confirm New Password</label>
                  <input type="password" required minLength="6" value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary px-8" disabled={loading}>
                {loading ? 'Update Password' : 'Update Password'}
              </button>
            </form>
          )}

          {activeTab === 'pin' && (
            <form onSubmit={handlePinUpdate} className="max-w-md space-y-6">
              <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Transaction PIN</h2>
              <p className="text-sm text-gray-500">
                This PIN is required for payout requests. Use 4 to 6 digits and keep it private.
              </p>
              <div className="space-y-4">
                {user.transactionPinSet && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-500">Current PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      required
                      value={pinData.currentPin}
                      onChange={(e) => setPinData({ ...pinData, currentPin: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">New PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    value={pinData.newPin}
                    onChange={(e) => setPinData({ ...pinData, newPin: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    value={pinData.confirmPin}
                    onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary px-8" disabled={loading}>
                {loading ? 'Saving PIN...' : user.transactionPinSet ? 'Update PIN' : 'Set PIN'}
              </button>
            </form>
          )}

          {activeTab === 'bank' && (
            <div className="max-w-xl space-y-6">
              <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Settlement Bank Details</h2>
              <p className="text-sm text-gray-500">These details will be used for your own payout settlements.</p>
              <div className="p-12 border-2 border-dashed border-gray-100 rounded-xl text-center text-gray-400 italic">
                Bank detail management is currently disabled. Please contact Admin.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
