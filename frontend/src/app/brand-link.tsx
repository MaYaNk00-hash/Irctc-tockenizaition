'use client';

import Link from 'next/link';
import { Train } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function BrandLink() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const refreshBrand = () => { try {
      const session = JSON.parse(window.localStorage.getItem('tatkal.session') || 'null');
      const expiresAt = session?.signedInAt && session?.expiresInSeconds ? new Date(session.signedInAt).getTime() + session.expiresInSeconds * 1000 : Infinity;
      setIsSignedIn(Boolean(session?.token && expiresAt > Date.now()));
    } catch { setIsSignedIn(false); } };
    refreshBrand();
    window.addEventListener('storage', refreshBrand);
    window.addEventListener('tatkal-auth-change', refreshBrand);
    return () => {
      window.removeEventListener('storage', refreshBrand);
      window.removeEventListener('tatkal-auth-change', refreshBrand);
    };
  }, [pathname]);

  return (
    <Link href={isSignedIn ? '/search' : '/landing'} className="flex items-center space-x-3 group" aria-label={isSignedIn ? 'Go to train search dashboard' : 'Go to landing page'}>
      <div className="bg-irctc-navy p-2 rounded-md shadow-md group-hover:bg-irctc-blue transition-colors">
        <Train className="w-7 h-7 text-white" />
      </div>
      <div>
        <div className="flex items-center space-x-2">
          <span className="font-black text-xl tracking-tight text-irctc-navy">IRCTC</span>
          <span className="bg-orange-50 text-irctc-orange text-[10px] px-2 py-0.5 rounded font-bold border border-orange-200">
            TATKAL FAIR-BOOKING
          </span>
        </div>
        <p className="text-[11px] text-slate-500 tracking-wide">Indian Railways Catering and Tourism Corporation</p>
      </div>
    </Link>
  );
}
