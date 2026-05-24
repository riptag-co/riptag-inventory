import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-accent grid place-items-center text-white font-display font-bold text-base tracking-tighter">
            R
          </div>
          <div>
            <div className="font-display font-semibold tracking-tight text-lg leading-none">Riptag Ops</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-text-tertiary leading-none mt-1.5">
              Supplier console
            </div>
          </div>
        </div>
        <div className="glass-strong p-7">
          <LoginForm />
        </div>
        <p className="text-center text-[11px] text-text-tertiary mt-6">
          Two-user system. Access by invitation only.
        </p>
      </div>
    </main>
  );
}
