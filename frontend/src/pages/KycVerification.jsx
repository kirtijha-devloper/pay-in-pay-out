import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { CheckCircle2, XCircle, Eye, ShieldCheck, FileText, User as UserIcon, RefreshCw } from 'lucide-react';

const KYC_STATUS_BADGE = {
  PENDING: 'badge-warning',
  VERIFIED: 'badge-success',
  REJECTED: 'badge-danger',
};

function resolveUploadUrl(filePath) {
  if (!filePath) return '';
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return `${baseUrl}/${String(filePath).replace(/^\/+/, '')}`;
}

const KycDetailModal = ({ user, isOpen, onClose, onUpdate }) => {
  if (!isOpen || !user) return null;

  const updateStatus = async (status) => {
    try {
      await api.patch(`/users/${user.id}/kyc`, { status });
      onUpdate();
      onClose();
    } catch (err) {
      alert('Error updating KYC status');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Verify KYC Documents</h2>
              <p className="text-sm text-gray-500">{user.profile?.ownerName} • {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <XCircle size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText size={18} className="text-gray-400" /> Aadhaar Card
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Front View</label>
                  {user.profile?.aadhaarFrontPath ? (
                    <div className="relative group rounded-xl overflow-hidden border-2 border-dashed border-gray-200 aspect-[1.6/1]">
                      <img src={resolveUploadUrl(user.profile.aadhaarFrontPath)} alt="Aadhaar Front" className="w-full h-full object-cover" />
                      <a href={resolveUploadUrl(user.profile.aadhaarFrontPath)} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-medium transition-opacity">
                        <Eye size={20} className="mr-2" /> View Full Image
                      </a>
                    </div>
                  ) : <div className="p-8 text-center bg-gray-50 rounded-xl text-gray-400 italic">No image uploaded</div>}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Back View</label>
                  {user.profile?.aadhaarBackPath ? (
                    <div className="relative group rounded-xl overflow-hidden border-2 border-dashed border-gray-200 aspect-[1.6/1]">
                      <img src={resolveUploadUrl(user.profile.aadhaarBackPath)} alt="Aadhaar Back" className="w-full h-full object-cover" />
                      <a href={resolveUploadUrl(user.profile.aadhaarBackPath)} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-medium transition-opacity">
                        <Eye size={20} className="mr-2" /> View Full Image
                      </a>
                    </div>
                  ) : <div className="p-8 text-center bg-gray-50 rounded-xl text-gray-400 italic">No image uploaded</div>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText size={18} className="text-gray-400" /> PAN Card
              </h3>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Card Image</label>
                {user.profile?.panCardPath ? (
                  <div className="relative group rounded-xl overflow-hidden border-2 border-dashed border-gray-200 aspect-[1.6/1]">
                    <img src={resolveUploadUrl(user.profile.panCardPath)} alt="PAN Card" className="w-full h-full object-cover" />
                    <a href={resolveUploadUrl(user.profile.panCardPath)} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-medium transition-opacity">
                      <Eye size={20} className="mr-2" /> View Full Image
                    </a>
                  </div>
                ) : <div className="p-8 text-center bg-gray-50 rounded-xl text-gray-400 italic">No image uploaded</div>}
              </div>

              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mt-8">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">Verification Guidance</h4>
                <ul className="text-xs text-blue-600 space-y-1 list-disc pl-4">
                  <li>Ensure images are clear and text is readable.</li>
                  <li>Verify names match the profile name: <strong>{user.profile?.ownerName}</strong></li>
                  <li>Check Aadhaar UID: <strong>{user.profile?.aadhaarNumber || 'N/A'}</strong></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <button onClick={() => updateStatus('REJECTED')} className="btn btn-outline border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-2">
              <XCircle size={18} /> Reject KYC
            </button>
            <button onClick={() => updateStatus('VERIFIED')} className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 flex items-center gap-2 shadow-lg shadow-emerald-100">
              <CheckCircle2 size={18} /> Verify Documents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function KycVerification() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users?limit=100');
      if (data.success) {
        setUsers(data.users.filter(u => u.kycStatus !== 'VERIFIED'));
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">KYC Verification</h1>
          <p className="text-muted text-sm mt-1">Review and approve user identity documents.</p>
        </div>
        <button onClick={fetchUsers} className="btn btn-outline flex items-center gap-2">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-gray-400">Loading pending verifications...</div>
        ) : users.length === 0 ? (
          <div className="col-span-full py-20 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed">
            <ShieldCheck size={48} className="mx-auto mb-4 text-gray-200" />
            No pending verifications found.
          </div>
        ) : (
          users.map(u => (
            <div key={u.id} className="card hover:border-primary/50 transition-all group overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xl">
                      {u.profile?.ownerName?.charAt(0) || <UserIcon size={24} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 leading-none mb-1">{u.profile?.ownerName}</h3>
                      <p className="text-xs text-gray-500">{u.role} • {u.email}</p>
                    </div>
                  </div>
                  <span className={`badge ${KYC_STATUS_BADGE[u.kycStatus] || 'badge-secondary'}`}>{u.kycStatus}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-5">
                  <div className="h-16 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center">
                    {u.profile?.aadhaarFrontPath ? <FileText size={20} className="text-blue-400" /> : <XCircle size={16} className="text-gray-200" />}
                  </div>
                  <div className="h-16 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center">
                    {u.profile?.aadhaarBackPath ? <FileText size={20} className="text-blue-400" /> : <XCircle size={16} className="text-gray-200" />}
                  </div>
                  <div className="h-16 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center">
                    {u.profile?.panCardPath ? <FileText size={20} className="text-amber-400" /> : <XCircle size={16} className="text-gray-200" />}
                  </div>
                </div>

                <button onClick={() => setSelectedUser(u)} className="w-full btn btn-primary flex items-center justify-center gap-2 group-hover:shadow-lg transition-all">
                  <Eye size={18} /> Review Documents
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <KycDetailModal 
        user={selectedUser} 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)} 
        onUpdate={fetchUsers} 
      />
    </div>
  );
}
