'use client';
import { useParams } from 'next/navigation';
import UsernameProfile from '@/features/profile/components/UsernameProfile';
export default function ProfilePage() {
  const { username } = useParams();
  return <UsernameProfile key={username} />;
}
