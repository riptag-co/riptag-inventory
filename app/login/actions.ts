'use server';

import { redirect } from 'next/navigation';
import { authenticate, createSession, setSessionCookie } from '@/lib/auth';

export async function signIn(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password required.' };

  const user = await authenticate(email, password);
  if (!user) return { error: 'Invalid email or password.' };

  const token = await createSession(user.id);
  await setSessionCookie(token);
  redirect('/dashboard');
}
