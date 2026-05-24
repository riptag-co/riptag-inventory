'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { signIn } from './actions';
import { IconArrowRight, IconLoader2 } from '@tabler/icons-react';

const initial: { error: string | null } = { error: null };

export function LoginForm() {
  const [state, formAction] = useFormState(signIn, initial);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.08em] text-text-tertiary font-medium mb-2">
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full bg-white/[0.025] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[14px] font-medium outline-none focus:border-accent focus:bg-white/[0.04] transition-all"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.08em] text-text-tertiary font-medium mb-2">
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full bg-white/[0.025] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[14px] font-medium outline-none focus:border-accent focus:bg-white/[0.04] transition-all"
        />
      </div>
      {state?.error && (
        <p className="text-[12px] text-bad bg-bad/10 border border-bad/20 rounded-md px-3 py-2">{state.error}</p>
      )}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-accent hover:bg-accent-hover text-white font-medium text-[14px] rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-60 accent-glow mt-2"
    >
      {pending ? (
        <>
          <IconLoader2 size={16} className="animate-spin" /> Signing in
        </>
      ) : (
        <>
          Sign in <IconArrowRight size={16} stroke={2.25} />
        </>
      )}
    </button>
  );
}
