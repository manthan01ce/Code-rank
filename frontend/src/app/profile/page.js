'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function ProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        const handle = user?.email ? user.email.split('@')[0] : '';
        if (handle) {
          router.replace(`/profile/${handle}`);
          return;
        }
      }
      router.replace('/');
    } catch (e) {
      router.replace('/');
    }
  }, [router]);

  return <LoadingOverlay />;
}
