import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { ShieldCheck, Train, Clock, Server, User, Search, History, LayoutDashboard, PhoneCall, HelpCircle } from 'lucide-react';

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
      <body className="min-h-screen flex flex-col bg-slate-50 font-sans">
        {/* Top IRCTC Bar */}
        <div className="bg-irctc-darknavy text-xs text-slate-300 py-1.5 px-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-slate-200 font-medium">
              <PhoneCall className="w-3 h-3 mr-1 text-irctc-orange" />
              Customer Care 139
            </span>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="hidden sm:inline text-slate-300 flex items-center">
              <HelpCircle className="w-3 h-3 mr-1 text-sky-400" />
              AskDISHA 2.0 Assistant
            </span>
          </div>
          <div className="flex items-center space-x-3 text-slate-300">
            <span className="flex items-center text-slate-300">
              <Clock className="w-3.5 h-3.5 mr-1 text-irctc-orange" />
              Tatkal Opening: <strong className="text-white ml-1">10:00 AM (AC) / 11:00 AM (Non-AC)</strong>
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-mono border border-emerald-500/30">
              FAIR QUEUE ENGINE ACTIVE
            </span>
          </div>
        </div>

        {/* Main Header */}
        <header className="irctc-gradient text-white sticky top-0 z-50 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="bg-irctc-orange p-2 rounded-lg shadow-md group-hover:scale-105 transition-transform">
                <Train className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-xl tracking-tight text-white">IRCTC</span>
                  <span className="bg-orange-500/30 text-amber-300 text-xs px-2 py-0.5 rounded font-mono border border-amber-500/40">
                    TATKAL FAIR-BOOKING
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 tracking-wide">Indian Railways Catering and Tourism Corporation</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
              <Link href="/" className="px-3 py-2 rounded-md hover:bg-white/10 transition flex items-center">
                <Search className="w-4 h-4 mr-1.5 text-orange-400" />
                Search Trains
              </Link>
              <Link href="/waiting-room" className="px-3 py-2 rounded-md hover:bg-white/10 transition flex items-center">
                <Clock className="w-4 h-4 mr-1.5 text-amber-400" />
                Waiting Room
              </Link>
              <Link href="/history" className="px-3 py-2 rounded-md hover:bg-white/10 transition flex items-center">
                <History className="w-4 h-4 mr-1.5 text-sky-400" />
                Audit Trail
              </Link>
              <Link href="/admin" className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 transition text-amber-300 flex items-center border border-amber-400/30">
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                Admin Controls
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-1">
            <p className="font-semibold text-slate-300">
              IRCTC Tatkal Fair-Booking System
            </p>
            <p className="text-slate-500">
              Copyright © 2026 - Indian Railways Catering and Tourism Corporation Ltd. All Rights Reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
