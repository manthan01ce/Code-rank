'use client';
import { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';

export default function LogoutConfirmModal({ isOpen, onConfirm, onCancel }) {
  const dialog = useRef(null);
  const cancelButton = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    element.showModal();
    cancelButton.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return <dialog ref={dialog} className="logout-dialog" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-desc" onCancel={event => { event.preventDefault(); onCancel(); }} onClick={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <div className="logout-dialog-content"><div className="logout-symbol"><LogOut size={23} aria-hidden="true"/></div><p className="logout-eyebrow">YOUR CODERANK SESSION</p><h2 id="logout-dialog-title">Ready to sign out?</h2><p id="logout-dialog-desc">You’ll need to sign in again to continue your work. Save any unsaved changes before leaving.</p><div className="logout-actions"><button ref={cancelButton} type="button" className="logout-cancel" onClick={onCancel}>Stay signed in</button><button type="button" className="logout-confirm" onClick={onConfirm}>Sign out</button></div></div>
  </dialog>;
}
