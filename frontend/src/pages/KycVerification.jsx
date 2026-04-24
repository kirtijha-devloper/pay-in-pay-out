import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  FileText,
  History,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

const KYC_STATUS_BADGE = {
  PENDING: 'badge-warning',
  VERIFIED: 'badge-success',
  REJECTED: 'badge-danger',
};

function resolveUploadUrl(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;

  const baseUrl = getApiOrigin();
  return `${baseUrl}/${String(filePath).replace(/^\/+/, '')}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function maskAadhaar(value) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}

function StatusBadge({ status }) {
  const classes = status === 'VERIFIED' ? 'badge-success' : status === 'REJECTED' ? 'badge-danger' : 'badge-warning';
  return <span className={`badge ${classes}`}>{status}</span>;
}

function RequestSummary({ request }) {
  if (!request) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        No KYC request submitted yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase text-gray-500">Latest Request</div>
          <div className="mt-1 font-semibold text-gray-900">{request.fullName}</div>
          <div className="text-xs text-gray-500">DOB: {request.dateOfBirth || '-'} / Gender: {request.gender || '-'}</div>
          <div className="text-xs text-gray-500">
            Aadhaar: {maskAadhaar(request.aadhaarNumber)} / PAN: {request.panNumber || '-'}
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <History size={14} />
        Submitted {formatDateTime(request.createdAt)}
      </div>
      {request.reviewRemark && <div className="mt-2 text-xs text-gray-500">{request.reviewRemark}</div>}
    </div>
  );
}

function KycForm({ onSubmit, loading, initialData, photoFile, setPhotoFile }) {
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: '',
    aadhaarNumber: '',
    panNumber: '',
  });

  useEffect(() => {
    setFormData({
      fullName: initialData?.fullName || '',
      dateOfBirth: initialData?.dateOfBirth || '',
      gender: initialData?.gender || '',
      aadhaarNumber: initialData?.aadhaarNumber || '',
      panNumber: initialData?.panNumber || '',
    });
  }, [initialData]);

  return (
    <form onSubmit={(event) => onSubmit(event, formData)} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-bold uppercase text-gray-500">Full Name</label>
          <input
            type="text"
            required
            value={formData.fullName}
            onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
            placeholder="Name as per documents"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-gray-500">Date of Birth</label>
          <input
            type="date"
            required
            value={formData.dateOfBirth}
            onChange={(event) => setFormData({ ...formData, dateOfBirth: event.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-gray-500">Gender</label>
          <select
            required
            value={formData.gender}
            onChange={(event) => setFormData({ ...formData, gender: event.target.value })}
          >
            <option value="">Select gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-gray-500">Aadhaar Number</label>
          <input
            type="text"
            required
            value={formData.aadhaarNumber}
            onChange={(event) => setFormData({ ...formData, aadhaarNumber: event.target.value })}
            placeholder="12 digit Aadhaar"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-gray-500">PAN Number</label>
          <input
            type="text"
            required
            value={formData.panNumber}
            onChange={(event) => setFormData({ ...formData, panNumber: event.target.value.toUpperCase() })}
            placeholder="ABCDE1234F"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-bold uppercase text-gray-500">Optional Photo / PAN Image</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
          />
          <p className="text-[11px] text-gray-400">Upload a supporting photo or PAN image if available.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Manual KYC is reviewed by admin before wallet top-up requests are unlocked.
      </div>

      <button type="submit" className="btn btn-primary w-full py-3" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit KYC Request'}
      </button>
    </form>
  );
}

export default function KycVerification() {
  const { user, refreshUser } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const initialSection = isAdmin ? 'pending' : 'apply';

  const [activeSection, setActiveSection] = useState(initialSection);
  const [requestFilter, setRequestFilter] = useState('PENDING');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const initialFormData = useMemo(
    () => ({
      fullName: user?.profile?.ownerName || '',
      dateOfBirth: '',
      gender: '',
      aadhaarNumber: user?.profile?.aadhaarNumber || '',
      panNumber: '',
    }),
    [user]
  );

  const loadRequests = async (section = activeSection, filter = requestFilter) => {
    setLoading(true);
    setError('');

    try {
      if (isAdmin) {
        const params = new URLSearchParams();
        if (section === 'pending' && filter) {
          params.set('status', filter);
        }
        const { data } = await api.get(`/users/kyc/requests${params.toString() ? `?${params.toString()}` : ''}`);
        setRequests(data.success ? data.requests || [] : []);
      } else {
        const { data } = await api.get('/users/kyc/request');
        setRequests(data.success ? data.requests || [] : []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load KYC data');
    }

    setLoading(false);
  };

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    loadRequests(initialSection, requestFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, initialSection]);

  const refreshActiveSection = async () => {
    await loadRequests(activeSection, requestFilter);
  };

  const submitKycRequest = async (event, formData) => {
    event.preventDefault();
    setSaving(true);
    setResult(null);
    setError('');

    try {
      const payload = new FormData();
      payload.append('fullName', formData.fullName);
      payload.append('dateOfBirth', formData.dateOfBirth);
      payload.append('gender', formData.gender);
      payload.append('aadhaarNumber', formData.aadhaarNumber);
      payload.append('panNumber', formData.panNumber);
      if (photoFile) {
        payload.append('kycPhoto', photoFile);
      }

      const { data } = await api.post('/users/kyc/request', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.success) {
        setResult({ success: true, message: data.message || 'KYC request submitted successfully' });
        setPhotoFile(null);
        await refreshUser();
        await loadRequests('apply');
      } else {
        setResult({ success: false, message: data.message || 'Unable to submit KYC request' });
      }
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.message || 'Unable to submit KYC request',
      });
    }

    setSaving(false);
  };

  const approveRequest = async (id) => {
    try {
      const { data } = await api.patch(`/users/kyc/requests/${id}/approve`);
      if (data.success) {
        window.location.reload();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to approve KYC request');
    }
  };

  const rejectRequest = async (id) => {
    const reviewRemark = window.prompt('Optional rejection reason');
    if (reviewRemark === null) return;

    try {
      const { data } = await api.patch(`/users/kyc/requests/${id}/reject`, { reviewRemark });
      if (data.success) {
        window.location.reload();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reject KYC request');
    }
  };

  const renderUserView = () => {
    const latestRequest = requests[0] || null;
    const kycVerified = user?.kycStatus === 'VERIFIED';

    if (activeSection === 'history') {
      return (
        <div className="card">
          <div className="p-5 border-b flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-400" />
              <h2 className="font-semibold">My KYC Requests</h2>
            </div>
            <button onClick={refreshActiveSection} className="btn btn-outline btn-sm" type="button">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="data-table-container border-none shadow-none rounded-none overflow-y-auto max-h-[620px]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Details</th>
                  <th>Photo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-gray-400">
                      Loading your KYC requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-gray-400">
                      No KYC requests found.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id}>
                      <td className="text-xs text-gray-500">{formatDateTime(request.createdAt)}</td>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{request.fullName}</span>
                          <span className="text-[10px] text-gray-400">
                            DOB: {request.dateOfBirth || '-'} / Gender: {request.gender || '-'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Aadhaar: {maskAadhaar(request.aadhaarNumber)} / PAN: {request.panNumber || '-'}
                          </span>
                          {request.reviewRemark && <span className="text-[10px] text-gray-500">{request.reviewRemark}</span>}
                        </div>
                      </td>
                      <td>
                        {request.kycPhotoPath ? (
                          <a
                            href={resolveUploadUrl(request.kycPhotoPath)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary text-xs inline-flex items-center gap-1"
                          >
                            <Eye size={14} /> View
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">KYC Verification</h1>
            <p className="text-muted text-sm mt-1">
              Submit your details once. Admin will review them manually before wallet top-up requests are enabled.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 min-w-[220px]">
            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase">
              <ShieldCheck size={14} />
              KYC Status
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={user?.kycStatus || 'PENDING'} />
              <span className="text-xs text-gray-500">{kycVerified ? 'Fund requests are unlocked' : 'Pending admin review'}</span>
            </div>
          </div>
        </div>

        {!kycVerified && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-amber-800">KYC is required before wallet top-ups</div>
              <div className="text-xs text-amber-700">Submit the form below and wait for admin approval.</div>
            </div>
            <Link to="/wallet" className="btn btn-outline btn-sm">
              Go to Wallet
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5 text-primary">
              <FileText size={20} />
              <h2 className="font-semibold">Submit Manual KYC</h2>
            </div>
            <KycForm
              onSubmit={submitKycRequest}
              loading={saving}
              initialData={initialFormData}
              photoFile={photoFile}
              setPhotoFile={setPhotoFile}
            />

            {result && (
              <div
                className={`mt-5 rounded-2xl border p-4 ${
                  result.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex gap-3">
                  {result.success ? <CheckCircle2 className="text-emerald-600" /> : <XCircle className="text-red-600" />}
                  <div>
                    <div className={`font-semibold ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                      {result.success ? 'KYC Submitted' : 'KYC Submission Failed'}
                    </div>
                    <p className={`text-sm ${result.success ? 'text-emerald-700' : 'text-red-700'}`}>{result.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <RequestSummary request={latestRequest} />
          </div>
        </div>
      </div>
    );
  };

  const renderAdminView = () => {
    const pendingCount = requests.filter((request) => request.status === 'PENDING').length;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">KYC Verification</h1>
            <p className="text-muted text-sm mt-1">
              Review manual KYC submissions and approve users before fund requests are unlocked.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 min-w-[220px]">
            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase">
              <BadgeCheck size={14} />
              Pending Reviews
            </div>
            <div className="mt-1 text-2xl font-bold text-secondary">{pendingCount}</div>
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setActiveSection('pending');
                setRequestFilter('PENDING');
                loadRequests('pending', 'PENDING');
              }}
              className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                activeSection === 'pending'
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Pending Reviews
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSection('all');
                setRequestFilter('');
                loadRequests('all', '');
              }}
              className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                activeSection === 'all'
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              All Requests
            </button>
          </div>
          <button onClick={refreshActiveSection} className="btn btn-outline btn-sm" type="button">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="card">
          <div className="p-5 border-b flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-gray-400" />
              <h2 className="font-semibold">{activeSection === 'all' ? 'All KYC Requests' : 'Pending KYC Requests'}</h2>
            </div>
            <div className="text-xs text-gray-400">Manual approval only, no external KYC API</div>
          </div>

          <div className="data-table-container border-none shadow-none rounded-none overflow-y-auto max-h-[620px]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Details</th>
                  <th>Photo</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-400">
                      Loading KYC requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-400">
                      No KYC requests found.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">
                            {request.user?.profile?.ownerName || request.fullName}
                          </span>
                          <span className="text-[10px] text-gray-400">{request.user?.email}</span>
                          <span className="text-[10px] text-gray-500">{request.user?.role}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{request.fullName}</span>
                          <span className="text-[10px] text-gray-400">
                            DOB: {request.dateOfBirth || '-'} / Gender: {request.gender || '-'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Aadhaar: {request.aadhaarNumber} / PAN: {request.panNumber || '-'}
                          </span>
                          {request.reviewRemark && <span className="text-[10px] text-gray-500">{request.reviewRemark}</span>}
                        </div>
                      </td>
                      <td>
                        {request.kycPhotoPath ? (
                          <a
                            href={resolveUploadUrl(request.kycPhotoPath)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary text-xs inline-flex items-center gap-1"
                          >
                            <Eye size={14} /> View
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="text-xs text-gray-500">{formatDateTime(request.createdAt)}</td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>
                      <td>
                        {request.status === 'PENDING' ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => approveRequest(request.id)}
                              className="p-1 px-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded border border-emerald-200 text-xs font-bold transition-all"
                            >
                              APPROVE
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectRequest(request.id)}
                              className="p-1 px-2 bg-red-50 text-red-600 hover:bg-red-100 rounded border border-red-200 text-xs font-bold transition-all"
                            >
                              REJECT
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            {request.reviewedBy ? `Reviewed by ${request.reviewedBy.role}` : 'Reviewed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {!isAdmin && (
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const nextSection = 'apply';
                  setActiveSection(nextSection);
                  loadRequests(nextSection, requestFilter);
                }}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  activeSection === 'apply'
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Apply KYC
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextSection = 'history';
                  setActiveSection(nextSection);
                  loadRequests(nextSection, requestFilter);
                }}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  activeSection === 'history'
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                My Requests
              </button>
            </div>

            <button onClick={refreshActiveSection} className="btn btn-outline btn-sm" type="button">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {isAdmin ? renderAdminView() : renderUserView()}
    </div>
  );
}
import { getApiOrigin } from '../lib/apiBaseUrl';
