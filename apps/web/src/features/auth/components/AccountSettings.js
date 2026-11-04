'use client';
import { useAccountSettings } from '../hooks/useAccountSettings';

import LoadingOverlay from '@/components/LoadingOverlay';
import {
  IconShieldLock,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconAlertCircle,
  IconLock,
} from '@tabler/icons-react';

export default function AdminSettingsPage() {
  const { token, isReady, currentPassword, setCurrentPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword, showCurrent, setShowCurrent, showNew, setShowNew, showConfirm, setShowConfirm, touched, setTouched, submitting, setSubmitting, serverError, setServerError, successMsg, setSuccessMsg, errors, isFormValid, handleSubmit } = useAccountSettings();
  return (
    <div className="space-y-6 max-w-[960px] mx-auto">
      {submitting && <LoadingOverlay />}

      {/* Page Header — Standard CodeRank Pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Settings</h1>
          <p className="text-xs text-[#64748b] mt-0.5">Manage your security and application preferences.</p>
        </div>
      </div>

      {/* Password & Security Card */}
      <div className="max-w-[560px] mx-auto">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-7 shadow-xs">
          {/* Card Header */}
          <div className="flex items-start gap-3.5 pb-5 border-b border-[#f1f5f9] mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#eff1ff] text-[#4f46e5] flex items-center justify-center shrink-0 border border-[#c7d2fe]">
              <IconShieldLock size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#0f172a] leading-tight">
                Password &amp; Security
              </h2>
              <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
                Ensure your account is protected with a strong password. Passwords must contain at least 8 characters.
              </p>
            </div>
          </div>

          {/* Feedback Banners */}
          {successMsg && (
            <div role="status" className="mb-5 p-3.5 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] text-xs font-semibold flex items-center gap-2.5">
              <IconCheck size={16} className="text-[#10b981] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {serverError && (
            <div role="alert" className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2.5">
              <IconAlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4.5" noValidate>
            {/* Current Password */}
            <div>
              <label
                htmlFor="settings-current-password"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="settings-current-password"
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (serverError) setServerError('');
                    if (successMsg) setSuccessMsg('');
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, current: true }))}
                  disabled={submitting}
                  placeholder="Enter your current password"
                  className={`w-full px-3 py-2 pr-10 text-sm text-[#0f172a] bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4f46e5] transition-colors ${
                    errors.current ? 'border-red-300 focus:ring-red-400' : 'border-[#cbd5e1] focus:border-[#4f46e5]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#94a3b8] hover:text-[#475569] transition-colors cursor-pointer"
                  aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                  tabIndex={-1}
                >
                  {showCurrent ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
              {errors.current && (
                <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                  <span>{errors.current}</span>
                </p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="settings-new-password"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="settings-new-password"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (serverError) setServerError('');
                    if (successMsg) setSuccessMsg('');
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, new: true }))}
                  disabled={submitting}
                  placeholder="Enter new password (min. 8 characters)"
                  className={`w-full px-3 py-2 pr-10 text-sm text-[#0f172a] bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4f46e5] transition-colors ${
                    errors.new ? 'border-red-300 focus:ring-red-400' : 'border-[#cbd5e1] focus:border-[#4f46e5]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#94a3b8] hover:text-[#475569] transition-colors cursor-pointer"
                  aria-label={showNew ? 'Hide new password' : 'Show new password'}
                  tabIndex={-1}
                >
                  {showNew ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
              {errors.new ? (
                <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                  <span>{errors.new}</span>
                </p>
              ) : (
                <p className="text-[11px] text-[#94a3b8] mt-1">
                  Must be at least 8 characters and different from your current password.
                </p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label
                htmlFor="settings-confirm-password"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="settings-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (serverError) setServerError('');
                    if (successMsg) setSuccessMsg('');
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, confirm: true }))}
                  disabled={submitting}
                  placeholder="Re-enter new password"
                  className={`w-full px-3 py-2 pr-10 text-sm text-[#0f172a] bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4f46e5] transition-colors ${
                    errors.confirm ? 'border-red-300 focus:ring-red-400' : 'border-[#cbd5e1] focus:border-[#4f46e5]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#94a3b8] hover:text-[#475569] transition-colors cursor-pointer"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  tabIndex={-1}
                >
                  {showConfirm ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
              {errors.confirm && (
                <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                  <span>{errors.confirm}</span>
                </p>
              )}
            </div>

            {/* Action Button: compact right-aligned */}
            <div className="flex items-center justify-end pt-3 border-t border-[#f1f5f9]">
              <button
                type="submit"
                disabled={submitting || !isFormValid}
                className="btn-primary inline-flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Updating…</span>
                  </>
                ) : (
                  <>
                    <IconLock size={13} />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
