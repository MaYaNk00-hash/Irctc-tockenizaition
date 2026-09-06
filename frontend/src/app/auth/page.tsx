'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

type Mode = 'login' | 'signup';
type AuthResponse = { success: boolean; data?: { id: number; displayName: string; loginIdentifier: string; token: string; expiresInSeconds: number }; error?: string };

const SESSION_KEY = 'tatkal.session';
const DEMO_ACCOUNTS_KEY = 'tatkal.demo.accounts';

function isValidIdentifier(value: string) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mobilePattern = /^\d{10}$/;
  return emailPattern.test(value) || mobilePattern.test(value);
}

type DemoAccount = { displayName: string; loginIdentifier: string; password: string };

function readDemoAccounts(): DemoAccount[] {
  try {
    const accounts = JSON.parse(window.localStorage.getItem(DEMO_ACCOUNTS_KEY) || '[]');
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    return [];
  }
}

function createDemoSession(account: DemoAccount) {
  return {
    id: `demo-${Date.now()}`,
    displayName: account.displayName,
    loginIdentifier: account.loginIdentifier,
    token: `demo-session-${crypto.randomUUID()}`,
    expiresInSeconds: 24 * 60 * 60,
    demo: true,
    signedInAt: new Date().toISOString()
  };
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Enter your email address or mobile number.');
      return;
    }
    if (!isValidIdentifier(normalizedEmail)) {
      setError('Enter a valid email address or 10-digit mobile number.');
      return;
    }

    if (password.length < 10) {
      setError('Your password must contain at least 10 characters.');
      return;
    }

    if (mode === 'signup') {
      const displayName = name.trim();
      if (!displayName) {
        setError('Enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : '');
      const response = await fetch(`${apiBase}/api/auth/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'signup'
          ? { displayName: name.trim(), loginIdentifier: normalizedEmail, password }
          : { loginIdentifier: normalizedEmail, password }),
      });
      const payload = await response.json() as AuthResponse;
      if (!response.ok || !payload.success || !payload.data) {
        if (response.status === 503) {
          const accounts = readDemoAccounts();
          const existing = accounts.find(account => account.loginIdentifier === normalizedEmail);
          if (mode === 'signup') {
            if (existing) {
              setError('A demo account with this email or mobile number already exists.');
              return;
            }
            const account = { displayName: name.trim(), loginIdentifier: normalizedEmail, password };
            window.localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
            window.localStorage.setItem(SESSION_KEY, JSON.stringify(createDemoSession(account)));
            window.dispatchEvent(new Event('tatkal-auth-change'));
            setMessage('Demo account created in this browser. Redirecting to train search...');
          } else {
            if (!existing || existing.password !== password) {
              setError('Invalid demo login credentials. Create a demo account first.');
              return;
            }
            window.localStorage.setItem(SESSION_KEY, JSON.stringify(createDemoSession(existing)));
            window.dispatchEvent(new Event('tatkal-auth-change'));
            setMessage('Demo login successful. Redirecting to train search...');
          }
          window.setTimeout(() => router.push('/search'), 650);
          return;
        }
        setError(payload.error || 'Unable to complete authentication.');
        return;
      }
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({ ...payload.data, signedInAt: new Date().toISOString() }));
      window.dispatchEvent(new Event('tatkal-auth-change'));
      setMessage(mode === 'signup' ? 'Account created. Redirecting to train search...' : 'Login successful. Redirecting to train search...');
      window.setTimeout(() => router.push('/search'), 650);
    } catch {
      setError('Unable to reach the authentication service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-4 sm:py-10">
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        <div className="irctc-gradient p-6 text-white">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold tracking-wide">
            <ShieldCheck className="w-4 h-4" /> SECURE ACCOUNT ACCESS
          </div>
          <h1 className="text-2xl font-extrabold mt-2">Welcome to IRCTC Tatkal</h1>
          <p className="text-sm text-slate-300 mt-1">Sign in to continue with the fair-booking demo.</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-bold">
            {(['login', 'signup'] as Mode[]).map((item) => (
              <button key={item} type="button" onClick={() => { setMode(item); setMessage(''); setError(''); setPassword(''); setConfirmPassword(''); }} className={`rounded-md py-2 capitalize transition ${mode === item ? 'bg-white text-irctc-navy shadow-sm' : 'text-slate-600'}`}>
                {item === 'login' ? 'Login' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <label className="block text-xs font-bold text-slate-700">
                Full name
                <div className="relative mt-1.5"><UserRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-irctc-navy focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Enter your name" /></div>
              </label>
            )}
            <label className="block text-xs font-bold text-slate-700">
              Email or mobile number
              <input required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-irctc-navy focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="you@example.com or 9876543210" />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Password
              <div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input required minLength={10} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-irctc-navy focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Enter at least 10 characters" /></div>
            </label>
            {mode === 'signup' && (
              <label className="block text-xs font-bold text-slate-700">
                Confirm password
                <div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input required minLength={10} autoComplete="new-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-irctc-navy focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Re-enter your password" /></div>
              </label>
            )}
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-800">{error}</p>}
            {message && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="w-4 h-4" />{message}</p>}
            <button disabled={isSubmitting} type="submit" className="w-full rounded-lg bg-irctc-orange py-3 text-sm font-bold text-white shadow-md transition hover:bg-irctc-darkorange disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>
          <p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">With Postgres available, accounts use the backend authentication API. Without it, this page clearly switches to demo authentication and stores the demo account only in this browser.</p>
        </div>
      </div>
    </div>
  );
}
