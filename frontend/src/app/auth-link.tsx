'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Shield, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type Session = {
  id?: number | string;
  displayName: string;
  loginIdentifier?: string;
  token: string;
  role?: 'USER' | 'ADMIN';
  signedInAt?: string;
  expiresInSeconds?: number;
};

const SESSION_KEY = 'tatkal.session';

function readSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const savedSession: unknown = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
    if (typeof savedSession !== 'object' || savedSession === null) return null;
    const value = savedSession as Session;
    if (typeof value.displayName !== 'string' || typeof value.token !== 'string') return null;
    if (value.signedInAt && value.expiresInSeconds) {
      const expiresAt = new Date(value.signedInAt).getTime() + value.expiresInSeconds * 1000;
      if (expiresAt <= Date.now()) {
        window.localStorage.removeItem(SESSION_KEY);
        return null;
      }
    }
    return value;
  } catch {
    return null;
  }
}

export default function AuthLink() {
  const [session, setSession] = useState<Session | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const refreshSession = () => setSession(readSession());
    refreshSession();
    window.addEventListener('storage', refreshSession);
    window.addEventListener('tatkal-auth-change', refreshSession);
    return () => {
      window.removeEventListener('storage', refreshSession);
      window.removeEventListener('tatkal-auth-change', refreshSession);
    };
  }, [pathname]);

  if (session) {
    const isAdmin = session.role === 'ADMIN' || session.loginIdentifier === 'admin@codex.dev';
    return (
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
        <div className="flex items-center gap-1.5">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isAdmin ? 'bg-purple-600' : 'bg-irctc-navy'}`}>
            {isAdmin ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-irctc-navy max-w-[120px] truncate leading-tight" title={session.displayName}>
              {session.displayName}
            </span>
            <span className={`text-[9px] font-semibold leading-none ${isAdmin ? 'text-purple-600' : 'text-slate-500'}`}>
              {isAdmin ? 'Admin' : 'Verified'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem(SESSION_KEY);
            setSession(null);
            window.dispatchEvent(new Event('tatkal-auth-change'));
            router.push('/auth');
          }}
          className="ml-1 p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
          aria-label="Sign out"
          title="Sign out of account"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Link
      href={`/auth?returnUrl=${encodeURIComponent(pathname)}`}
      className="px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-irctc-orange hover:bg-irctc-orange hover:text-white transition font-bold text-xs flex items-center gap-1.5 shadow-sm"
    >
      <User className="w-3.5 h-3.5" />
      <span>Sign In</span>
    </Link>
  );
}

