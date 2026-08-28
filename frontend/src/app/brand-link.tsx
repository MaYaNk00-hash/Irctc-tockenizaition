'use client';

import Link from 'next/link';
import { Train } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function BrandLink() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsSignedIn(Boolean(window.localStorage.getItem('tatkal.mockUser')));
  }, [pathname]);

  return (
    <Link href={isSignedIn ? '/search' : '/landing'} className="flex items-center space-x-3 group" aria-label={isSignedIn ? 'Go to train search dashboard' : 'Go to landing page'}>
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
  );
}
