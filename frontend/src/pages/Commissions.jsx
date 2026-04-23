import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Edit2, Plus, ShieldCheck, Trash2, UserPlus } from 'lucide-react';

const MANAGER_ROLES = ['ADMIN', 'SUPER', 'DISTRIBUTOR'];
const ROLE_OPTIONS_BY_MANAGER = {
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

const SERVICE_OPTIONS = [
  { value: 'PAYOUT', label: 'Payout' },
  { value: 'FUND_REQUEST', label: 'Fund Request' },
];

const SERVICE_LABELS = {
  PAYOUT: 'Payout',
  FUND_REQUEST: 'Fund Request',
};

const COMMISSION_TYPE_OPTIONS = [
  { value: 'FLAT', label: 'Flat' },
  { value: 'PERCENTAGE', label: 'Percentage' },
];

function formatAmount(value) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCharge(type, value) {
  if (type === 'PERCENTAGE') {
    return `${Number(value || 0).toFixed(2)}%`;
  }

  return formatAmount(value);
}

function formatRange(minAmount, maxAmount) {
  return `${formatAmount(minAmount)} - ${maxAmount === null || maxAmount === undefined ? 'Max' : formatAmount(maxAmount)}`;
}

function getAssignableRoles(role) {
  return ROLE_OPTIONS_BY_MANAGER[role] || [];
}

function createEmptyDefaultRate(allowedRoles) {
  return {
    serviceType: 'PAYOUT',
    applyOnRole: allowedRoles[0] || 'RETAILER',
    commissionType: 'FLAT',
    commissionValue: '',
    minAmount: '',
    maxAmount: '',
    isActive: true,
  };
}

function createEmptyOverride(targets) {
  return {
    targetUserId: targets[0]?.id || '',
    serviceType: 'PAYOUT',
    commissionType: 'FLAT',
    commissionValue: '',
    minAmount: '',
    maxAmount: '',
    isActive: true,
  };
}

function toFormState(row, fallback) {
  if (!row) {
    return fallback;
  }

  return {
    ...fallback,
    ...row,
    commissionValue: row.commissionValue ?? '',
    minAmount: row.minAmount ?? '',
    maxAmount: row.maxAmount ?? '',
    isActive: row.isActive ?? true,
  };
}

function preparePayload(formData) {
  return {
    ...formData,
    maxAmount: formData.maxAmount === '' ? null : formData.maxAmount,
  };
}

function getTargetLabel(user) {
  const primary = user?.profile?.ownerName || user?.profile?.shopName || user?.email || 'Unknown user';
  return `${primary} (${ROLE_LABELS[user?.role] || user?.role || 'User'})`;
}

function StatusBadge({ isActive }) {
  return (
    <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
      {isActive ? 'Active' : 'Paused'}
    </span>
  );
}

function TabButton({ active, label, onClick }) {
  return (
    <button
      className={`pb-2 px-4 text-sm font-medium transition-colors ${
        active ? 'text-primary border-b-2 border-primary' : 'text-gray-500'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function DefaultRateModal({ isOpen, onClose, onSaved, initialData, allowedRoles }) {
  const [formData, setFormData] = useState(createEmptyDefaultRate(allowedRoles));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSaving(false);
    setError('');
    setFormData(toFormState(initialData, createEmptyDefaultRate(allowedRoles)));
  }, [allowedRoles, initialData, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = preparePayload({
        ...formData,
        id: initialData?.id,
      });

      if (initialData?.id) {
        await api.put('/commissions/slabs', payload);
      } else {
        await api.post('/commissions/slabs', payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save default rate');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl p-6">
        <h2 className="text-xl font-bold mb-1">{initialData ? 'Edit Default Rate' : 'Add Default Rate'}</h2>
        <p className="text-sm text-gray-500 mb-5">
          Default slabs apply to your direct children for the selected role and cannot be lower than the inherited rate.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Service</label>
              <select
                value={formData.serviceType}
                onChange={(event) => setFormData({ ...formData, serviceType: event.target.value })}
                className="w-full"
              >
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Child Role</label>
              <select
                value={formData.applyOnRole}
                onChange={(event) => setFormData({ ...formData, applyOnRole: event.target.value })}
                className="w-full"
              >
                {allowedRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role] || role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Charge Type</label>
              <select
                value={formData.commissionType}
                onChange={(event) => setFormData({ ...formData, commissionType: event.target.value })}
                className="w-full"
              >
                {COMMISSION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Charge Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.commissionValue}
                onChange={(event) => setFormData({ ...formData, commissionValue: event.target.value })}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Min Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.minAmount}
                onChange={(event) => setFormData({ ...formData, minAmount: event.target.value })}
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Max Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.maxAmount}
                onChange={(event) => setFormData({ ...formData, maxAmount: event.target.value })}
                className="w-full"
                placeholder="Leave blank for Max"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Status</label>
              <select
                value={String(formData.isActive)}
                onChange={(event) => setFormData({ ...formData, isActive: event.target.value === 'true' })}
                className="w-full"
              >
                <option value="true">Active</option>
                <option value="false">Paused</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : initialData ? 'Update Rate' : 'Save Rate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserOverrideModal({ isOpen, onClose, onSaved, initialData, targets }) {
  const [formData, setFormData] = useState(createEmptyOverride(targets));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSaving(false);
    setError('');
    setFormData(toFormState(initialData, createEmptyOverride(targets)));
  }, [initialData, isOpen, targets]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = preparePayload({
        ...formData,
        id: initialData?.id,
      });

      if (initialData?.id) {
        await api.put('/commissions/overrides', payload);
      } else {
        await api.post('/commissions/overrides', payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save user override');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl p-6">
        <h2 className="text-xl font-bold mb-1">{initialData ? 'Edit User Override' : 'Add User Override'}</h2>
        <p className="text-sm text-gray-500 mb-5">
          Override any active user in your managed hierarchy for the chosen range, but do not set a lower rate than the inherited one.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase">Target User</label>
            <select
              value={formData.targetUserId}
              onChange={(event) => setFormData({ ...formData, targetUserId: event.target.value })}
              required
              className="w-full"
            >
              <option value="">Select managed user</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {getTargetLabel(target)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Service</label>
              <select
                value={formData.serviceType}
                onChange={(event) => setFormData({ ...formData, serviceType: event.target.value })}
                className="w-full"
              >
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Charge Type</label>
              <select
                value={formData.commissionType}
                onChange={(event) => setFormData({ ...formData, commissionType: event.target.value })}
                className="w-full"
              >
                {COMMISSION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Charge Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.commissionValue}
                onChange={(event) => setFormData({ ...formData, commissionValue: event.target.value })}
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Min Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.minAmount}
                onChange={(event) => setFormData({ ...formData, minAmount: event.target.value })}
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Max Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.maxAmount}
                onChange={(event) => setFormData({ ...formData, maxAmount: event.target.value })}
                className="w-full"
                placeholder="Leave blank for Max"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase">Status</label>
            <select
              value={String(formData.isActive)}
              onChange={(event) => setFormData({ ...formData, isActive: event.target.value === 'true' })}
              className="w-full"
            >
              <option value="true">Active</option>
              <option value="false">Paused</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : initialData ? 'Update Override' : 'Save Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Commissions() {
  const { user } = useAuth();
  const canManageRates = MANAGER_ROLES.includes(user.role);
  const allowedRoles = getAssignableRoles(user.role);

  const [defaultRates, setDefaultRates] = useState([]);
  const [userOverrides, setUserOverrides] = useState([]);
  const [overrideTargets, setOverrideTargets] = useState([]);
  const [effectiveRates, setEffectiveRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(canManageRates ? 'defaults' : 'myCharges');
  const [isDefaultModalOpen, setIsDefaultModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [currentDefaultRate, setCurrentDefaultRate] = useState(null);
  const [currentOverride, setCurrentOverride] = useState(null);

  useEffect(() => {
    setActiveTab(canManageRates ? 'defaults' : 'myCharges');
  }, [canManageRates]);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      if (canManageRates) {
        const [
          { data: defaultsResponse },
          { data: overridesResponse },
          { data: targetsResponse },
          { data: effectiveResponse },
        ] = await Promise.all([
          api.get('/commissions/slabs'),
          api.get('/commissions/overrides'),
          api.get('/commissions/targets'),
          api.get('/commissions/effective'),
        ]);

        setDefaultRates(defaultsResponse.success ? defaultsResponse.slabs : []);
        setUserOverrides(overridesResponse.success ? overridesResponse.overrides : []);
        setOverrideTargets(targetsResponse.success ? targetsResponse.targets : []);
        setEffectiveRates(effectiveResponse.success ? effectiveResponse.slabs : []);
      } else {
        const { data } = await api.get('/commissions/effective');
        setEffectiveRates(data.success ? data.slabs : []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load rate settings');
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [canManageRates]);

  const handleDeleteDefaultRate = async (rateId) => {
    if (!window.confirm('Delete this default rate?')) {
      return;
    }

    try {
      await api.delete(`/commissions/slabs/${rateId}`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete default rate');
    }
  };

  const handleDeleteOverride = async (overrideId) => {
    if (!window.confirm('Delete this user override?')) {
      return;
    }

    try {
      await api.delete(`/commissions/overrides/${overrideId}`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete user override');
    }
  };

  return (
    <div className="flex-col gap-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Charge Setting</h1>
          <p className="text-muted text-sm mt-1">
            {canManageRates
              ? 'Manage direct-child default rates, user overrides, and your own effective charges.'
              : 'Review the final charges that currently apply to your account.'}
          </p>
        </div>

        <div className="flex gap-2">
          {canManageRates && activeTab === 'defaults' && (
            <button
              onClick={() => {
                setCurrentDefaultRate(null);
                setIsDefaultModalOpen(true);
              }}
              className="btn btn-primary"
              type="button"
            >
              <Plus size={18} /> Add Default Rate
            </button>
          )}

          {canManageRates && activeTab === 'overrides' && (
            <button
              onClick={() => {
                setCurrentOverride(null);
                setIsOverrideModalOpen(true);
              }}
              className="btn btn-primary"
              type="button"
              disabled={overrideTargets.length === 0}
            >
              <UserPlus size={18} /> Add User Override
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-6">
        {canManageRates && (
          <TabButton active={activeTab === 'defaults'} label="Default Rates" onClick={() => setActiveTab('defaults')} />
        )}
        {canManageRates && (
          <TabButton active={activeTab === 'overrides'} label="User Overrides" onClick={() => setActiveTab('overrides')} />
        )}
        <TabButton active={activeTab === 'myCharges'} label="My Charges" onClick={() => setActiveTab('myCharges')} />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}

      {loading ? (
        <div className="card p-12 text-center text-gray-500">Loading rate settings...</div>
      ) : (
        <>
          {activeTab === 'defaults' && canManageRates && (
            <div className="card">
              <div className="data-table-container border-none shadow-none rounded-none">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Child Role</th>
                      <th>Range</th>
                      <th>Charge</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defaultRates.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-10 text-gray-400">
                          No default rates configured yet.
                        </td>
                      </tr>
                    ) : (
                      defaultRates.map((rate) => (
                        <tr key={rate.id}>
                          <td className="font-semibold text-primary">{SERVICE_LABELS[rate.serviceType] || rate.serviceType}</td>
                          <td>{ROLE_LABELS[rate.applyOnRole] || rate.applyOnRole}</td>
                          <td>{formatRange(rate.minAmount, rate.maxAmount)}</td>
                          <td className="font-medium text-emerald-600">{formatCharge(rate.commissionType, rate.commissionValue)}</td>
                          <td>
                            <StatusBadge isActive={rate.isActive} />
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setCurrentDefaultRate(rate);
                                  setIsDefaultModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                type="button"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteDefaultRate(rate.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                type="button"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'overrides' && canManageRates && (
            <div className="space-y-4">
              {overrideTargets.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  You do not have any active managed users yet, so there are no override targets available.
                </div>
              )}

              <div className="card">
                <div className="data-table-container border-none shadow-none rounded-none">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Target User</th>
                        <th>Service</th>
                        <th>Range</th>
                        <th>Charge</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userOverrides.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-10 text-gray-400">
                            No user overrides configured yet.
                          </td>
                        </tr>
                      ) : (
                        userOverrides.map((override) => (
                          <tr key={override.id}>
                            <td>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {override.targetUser?.profile?.ownerName || override.targetUser?.profile?.shopName || override.targetUser?.email}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {ROLE_LABELS[override.targetUser?.role] || override.targetUser?.role} - {override.targetUser?.email}
                                </span>
                              </div>
                            </td>
                            <td>{SERVICE_LABELS[override.serviceType] || override.serviceType}</td>
                            <td>{formatRange(override.minAmount, override.maxAmount)}</td>
                            <td className="font-medium text-emerald-600">
                              {formatCharge(override.commissionType, override.commissionValue)}
                            </td>
                            <td>
                              <StatusBadge isActive={override.isActive} />
                            </td>
                            <td>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setCurrentOverride(override);
                                    setIsOverrideModalOpen(true);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                  type="button"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteOverride(override.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                  type="button"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'myCharges' && (
            <div className="card">
              <div className="p-5 border-b flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-600" />
                <div>
                  <h2 className="font-semibold">My Charges</h2>
                  <p className="text-sm text-gray-500">These are the final slabs that currently apply to your account.</p>
                </div>
              </div>

              <div className="data-table-container border-none shadow-none rounded-none">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Range</th>
                      <th>Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveRates.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center py-10 text-gray-400">
                          No charge slabs are currently configured for your account.
                        </td>
                      </tr>
                    ) : (
                      effectiveRates.map((rate, index) => (
                        <tr key={`${rate.serviceType}-${rate.minAmount}-${rate.maxAmount || 'max'}-${index}`}>
                          <td className="font-semibold text-primary">{SERVICE_LABELS[rate.serviceType] || rate.serviceType}</td>
                          <td>{formatRange(rate.minAmount, rate.maxAmount)}</td>
                          <td className="font-medium text-emerald-600">{formatCharge(rate.commissionType, rate.commissionValue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <DefaultRateModal
        isOpen={isDefaultModalOpen}
        onClose={() => setIsDefaultModalOpen(false)}
        onSaved={fetchData}
        initialData={currentDefaultRate}
        allowedRoles={allowedRoles}
      />

      <UserOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        onSaved={fetchData}
        initialData={currentOverride}
        targets={overrideTargets}
      />
    </div>
  );
}
