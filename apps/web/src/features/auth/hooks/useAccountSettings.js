'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/features/auth/hooks/useAdminAuth';

export function useAccountSettings() {
  const { token, isReady } = useAdminAuth();

  // Form inputs
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Field touch tracking
  const [touched, setTouched] = useState({ current: false, new: false, confirm: false });

  // Status & feedback
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Client validation
  const errors = (() => {
    const errs = {};
    if (touched.current && !currentPassword) {
      errs.current = 'Current password is required.';
    }

    if (touched.new) {
      if (!newPassword) {
        errs.new = 'New password is required.';
      } else if (newPassword.length < 8) {
        errs.new = 'New password must be at least 8 characters long.';
      } else if (currentPassword && newPassword === currentPassword) {
        errs.new = 'New password must be different from current password.';
      }
    }

    if (touched.confirm) {
      if (!confirmPassword) {
        errs.confirm = 'Please confirm your new password.';
      } else if (newPassword && confirmPassword !== newPassword) {
        errs.confirm = 'Passwords do not match.';
      }
    }

    return errs;
  })();

  const isFormValid = useMemo(() => {
    return (
      currentPassword.length > 0 &&
      newPassword.length >= 8 &&
      confirmPassword.length >= 8 &&
      newPassword === confirmPassword &&
      newPassword !== currentPassword
    );
  }, [currentPassword, newPassword, confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ current: true, new: true, confirm: true });
    setServerError('');
    setSuccessMsg('');

    if (!currentPassword) {
      setServerError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setServerError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      setServerError('New password must be different from your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setServerError('New passwords do not match.');
      return;
    }

    if (submitting || !token) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      // Update session token without full-page reload
      if (data.token) {
        localStorage.setItem('token', data.token);
        window.dispatchEvent(new Event('coderank:account'));
      }

      setSuccessMsg('Password updated successfully. Your new password is now active.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTouched({ current: false, new: false, confirm: false });
    } catch (err) {
      setServerError(err.message || 'An error occurred while updating your password.');
    } finally {
      setSubmitting(false);
    }
  };


  return { token, isReady, currentPassword, setCurrentPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword, showCurrent, setShowCurrent, showNew, setShowNew, showConfirm, setShowConfirm, touched, setTouched, submitting, setSubmitting, serverError, setServerError, successMsg, setSuccessMsg, errors, isFormValid, handleSubmit };
}
