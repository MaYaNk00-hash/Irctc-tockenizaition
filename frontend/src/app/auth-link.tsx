'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AuthLink() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsSignedIn(Boolean(window.localStorage.getItem('tatkal.mockUser')));
  }, [pathname]);

  if (isSignedIn) return null;

  return (
    <Link href="/auth" className="px-3 py-2 rounded-md hover:bg-white/10 transition flex items-center">
      <User className="w-4 h-4 mr-1.5 text-emerald-300" />
      Login / Sign up
    </Link>
  );
}
