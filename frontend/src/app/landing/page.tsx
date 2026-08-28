import Link from 'next/link';
import { ArrowRight, Bot, Clock3, CreditCard, ShieldCheck, TicketCheck, Train } from 'lucide-react';

const benefits = [
  { icon: Clock3, title: 'A fair queue', text: 'Join once. Refreshing does not improve your position.' },
  { icon: TicketCheck, title: 'Protected seats', text: 'Choose an available seat and hold it while you pay.' },
  { icon: CreditCard, title: 'Safer payments', text: 'Late payments are handled through a clear refund flow.' },
  { icon: Bot, title: 'Bot resistance', text: 'Suspicious activity receives a lightweight verification step.' }
];

export default function LandingPage() {
  return <div className="space-y-10 py-3">
    <section className="irctc-gradient overflow-hidden rounded-2xl px-6 py-12 text-white shadow-xl sm:px-12 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200"><ShieldCheck className="w-4 h-4" /> TATKAL FAIR-BOOKING PROTOTYPE</span>
      <div className="mt-6 max-w-3xl">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Fair Tatkal Booking for Everyone.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-300">Beat congestion, not each other. A fair waiting room gives every passenger a clear path from queue to confirmed ticket.</p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/auth" className="inline-flex items-center justify-center gap-2 rounded-lg bg-irctc-orange px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-irctc-darkorange">Try the prototype <ArrowRight className="w-4 h-4" /></Link>
        <Link href="/search" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 px-5 py-3 text-sm font-bold hover:bg-white/10">Browse trains <Train className="w-4 h-4" /></Link>
      </div>
      <p className="mt-6 text-xs text-slate-400">Demo only — no real IRCTC, railway inventory, or payment integration.</p>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {benefits.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="w-6 h-6 text-irctc-orange" /><h2 className="mt-3 font-bold text-irctc-navy">{title}</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p></article>)}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-extrabold text-irctc-navy">How the demo works</h2><ol className="mt-4 grid gap-4 text-sm text-slate-700 sm:grid-cols-3"><li><strong>1. Join once.</strong><br />Enter the fair waiting room.</li><li><strong>2. Choose a seat.</strong><br />Your selected seat is held briefly.</li><li><strong>3. Pay in sandbox.</strong><br />Receive a mock PNR or see the refund scenario.</li></ol></section>
  </div>;
}
