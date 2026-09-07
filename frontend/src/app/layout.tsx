import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Clock, Search, History, LayoutDashboard, PhoneCall, HelpCircle, Menu, ShieldCheck } from 'lucide-react';
import BrandLink from './brand-link';
import AuthLink from './auth-link';
import JudgeTelemetryProvider from '../components/judge-telemetry-provider';

export const metadata: Metadata = {
  title: 'IRCTC Next-Gen Tatkal Ticket Booking System',
  description: 'Indian Railways Official Tatkal Fair-Booking System Architecture',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <JudgeTelemetryProvider>
          <div className="bg-white text-[11px] text-slate-600 py-2 px-4 flex justify-between items-center border-b border-slate-200">
          <div className="flex items-center space-x-4">
            <span className="flex items-center font-semibold">
              <PhoneCall className="w-3 h-3 mr-1 text-irctc-orange" />
              Customer Care 139
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline flex items-center">
              <HelpCircle className="w-3 h-3 mr-1 text-irctc-blue" />
              AskDISHA 2.0 Assistant
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden sm:flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1 text-irctc-orange" />
              Tatkal: <strong className="text-irctc-navy ml-1">10:00 AM AC / 11:00 AM Non-AC</strong>
            </span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
              SYSTEMS OPERATIONAL
            </span>
          </div>
        </div>

        <header className="bg-white sticky top-0 z-50 shadow-[0_3px_14px_rgba(6,43,99,0.12)]">
          <div className="rail-rule" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
            <BrandLink />

            <nav className="hidden md:flex items-center gap-1 text-sm font-semibold text-irctc-navy">
              <Link href="/" className="px-3 py-2 rounded-md hover:bg-blue-50 transition">Home</Link>
              <Link href="/search" className="px-3 py-2 rounded-md hover:bg-blue-50 transition flex items-center">
                <Search className="w-4 h-4 mr-1.5 text-irctc-orange" />
                Search Trains
              </Link>
              <Link href="/waiting-room" className="px-3 py-2 rounded-md hover:bg-blue-50 transition flex items-center">
                <Clock className="w-4 h-4 mr-1.5 text-irctc-orange" />
                Waiting Room
              </Link>
              <Link href="/history" className="px-3 py-2 rounded-md hover:bg-blue-50 transition flex items-center">
                <History className="w-4 h-4 mr-1.5 text-irctc-blue" />
                Audit Trail
              </Link>
              <AuthLink />
              <Link href="/admin" className="px-3 py-2 rounded-md bg-irctc-navy hover:bg-irctc-blue transition text-white flex items-center">
                <LayoutDashboard className="w-4 h-4 mr-1.5 text-amber-300" />
                Admin Controls
              </Link>
            </nav>
            <details className="relative md:hidden">
              <summary className="list-none rounded-md border border-slate-200 p-2 text-irctc-navy cursor-pointer" aria-label="Open navigation menu"><Menu className="h-5 w-5" /></summary>
              <div className="absolute right-0 top-12 z-50 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                <Link href="/search" className="block rounded px-3 py-2 text-sm font-semibold text-irctc-navy hover:bg-blue-50">Search Trains</Link>
                <Link href="/waiting-room" className="block rounded px-3 py-2 text-sm font-semibold text-irctc-navy hover:bg-blue-50">Waiting Room</Link>
                <Link href="/history" className="block rounded px-3 py-2 text-sm font-semibold text-irctc-navy hover:bg-blue-50">Audit Trail</Link>
                <Link href="/auth" className="block rounded px-3 py-2 text-sm font-semibold text-irctc-orange hover:bg-orange-50">Login / Sign up</Link>
              </div>
            </details>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="bg-irctc-darknavy text-slate-400 py-7 border-t-4 border-irctc-orange text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-1">
            <p className="font-semibold text-slate-300">
              IRCTC Tatkal Fair-Booking System
            </p>
            <p className="text-slate-500">
              Copyright © 2026 - Indian Railways Catering and Tourism Corporation Ltd. All Rights Reserved.
            </p>
          </div>
        </footer>
        </JudgeTelemetryProvider>
      </body>
    </html>
  );
}
