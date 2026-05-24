import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { destroySession, clearSessionCookie } from '@/lib/auth';

export async function POST() {
  const c = await cookies();
  const token = c.get('riptag_session')?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  redirect('/login');
}
