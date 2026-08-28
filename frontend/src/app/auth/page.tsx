'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

type Mode = 'login' | 'signup';

export default function MockAuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const displayName = name.trim() || email.split('@')[0] || 'Railway passenger';
    window.localStorage.setItem('tatkal.mockUser', JSON.stringify({ displayName, email, signedInAt: new Date().toISOString() }));
    setMessage(mode === 'login' ? 'Mock login successful. Redirecting to train search…' : 'Mock account created. Redirecting to train search…');
    window.setTimeout(() => router.push('/search'), 650);
  };

  return (
    <div className="max-w-md mx-auto py-4 sm:py-10">
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        <div className="irctc-gradient p-6 text-white">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold tracking-wide">
            <ShieldCheck className="w-4 h-4" /> PROTOTYPE ACCESS
          </div>
          <h1 className="text-2xl font-extrabold mt-2">Welcome to IRCTC Tatkal</h1>
          <p className="text-sm text-slate-300 mt-1">Sign in to continue with the fair-booking demo.</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-bold">
            {(['login', 'signup'] as Mode[]).map((item) => (
              <button key={item} type="button" onClick={() => { setMode(item); setMessage(''); }} className={`rounded-md py-2 capitalize transition ${mode === item ? 'bg-white text-irctc-navy shadow-sm' : 'text-slate-600'}`}>
                {item === 'login' ? 'Login' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <label className="block text-xs font-bold text-slate-700">
                Full name
                <div className="relative mt-1.5"><UserRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-irctc-navy focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Enter your name" /></div>
              </label>
            )}
            <label className="block text-xs font-bold text-slate-700">
              Email or mobile number
              <input required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-irctc-navy focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="you@example.com" />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Password
              <div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input required minLength={4} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-irctc-navy focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Enter any 4+ characters" /></div>
            </label>
            {message && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="w-4 h-4" />{message}</p>}
            <button type="submit" className="w-full rounded-lg bg-irctc-orange py-3 text-sm font-bold text-white shadow-md transition hover:bg-irctc-darkorange">
              {mode === 'login' ? 'Login to Prototype' : 'Create Mock Account'}
            </button>
          </form>
          <p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">Demo only: details stay in this browser and are never sent to IRCTC or a production authentication service.</p>
        </div>
      </div>
    </div>
  );
}
