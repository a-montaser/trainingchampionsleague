import { redirect } from 'next/navigation';
import { getParticipant } from '@/lib/auth/dal';

export default async function Home() {
  const participant = await getParticipant();
  redirect(participant ? '/dashboard' : '/login');
}
