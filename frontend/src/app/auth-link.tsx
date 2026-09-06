'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { useEffect, useState } from 'react';

type Session = { displayName: string; token: string };
const SESSION_KEY = 'tatkal.session';

function readSession(): Session | null {
  try {
    const savedSession: unknown = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
    if (typeof savedSession !== 'object' || savedSession === null) return null;
    const value = savedSession as Session & { signedInAt?: string; expiresInSeconds?: number };
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

  if (pathname === '/landing') {
    return <Link href="/auth" className="px-3 py-2 rounded-md hover:bg-white/10 transition flex items-center"><User className="w-4 h-4 mr-1.5 text-emerald-300" />Login / Sign up</Link>;
  }

  if (session) {
    return (
      <div className="flex items-center gap-1">
        <span className="max-w-28 truncate px-2 text-xs font-semibold text-emerald-200" title={session.displayName}>Hi, {session.displayName}</span>
        <button
          type="button"
          onClick={() => { window.localStorage.removeItem(SESSION_KEY); setSession(null); window.dispatchEvent(new Event('tatkal-auth-change')); }}
          className="flex items-center rounded-md px-2 py-2 text-sm hover:bg-white/10 transition"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4 text-emerald-300" />
        </button>
      </div>
    );
  }

  return (
    <Link href="/auth" className="px-3 py-2 rounded-md hover:bg-white/10 transition flex items-center">
      <User className="w-4 h-4 mr-1.5 text-emerald-300" />
      Login / Sign up
    </Link>
  );
}
