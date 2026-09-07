import Link from 'next/link';
import { ArrowRight, Bot, Clock3, CreditCard, ShieldCheck, TicketCheck, Train, MapPin, CalendarDays } from 'lucide-react';

const benefits = [
  { icon: Clock3, title: 'A fair queue', text: 'Join once. Refreshing does not improve your position.' },
  { icon: TicketCheck, title: 'Protected seats', text: 'Choose an available seat and hold it while you pay.' },
  { icon: CreditCard, title: 'Safer payments', text: 'Late payments are handled through a clear refund flow.' },
  { icon: Bot, title: 'Bot resistance', text: 'Suspicious activity receives a lightweight verification step.' }
];

export default function LandingPage() {
  return <div className="space-y-10 py-1">
    <section className="irctc-gradient relative overflow-hidden rounded-xl px-6 py-10 text-white shadow-xl sm:px-12 sm:py-14">
      <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border-[28px] border-white/10" />
      <div className="relative z-10 max-w-3xl">
        <span className="inline-flex items-center gap-2 border-l-4 border-irctc-orange bg-white/10 px-3 py-2 text-xs font-bold tracking-wide text-amber-200"><ShieldCheck className="w-4 h-4" /> OFFICIAL TATKAL FAIR-BOOKING DEMO</span>
        <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl">Your journey starts here.</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-blue-100">A clearer, fairer way to book Tatkal tickets when demand is at its highest.</p>
      </div>
      <div className="relative z-10 mt-8 grid max-w-4xl gap-3 rounded-lg bg-white p-4 text-slate-700 shadow-2xl sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-bold text-irctc-navy">FROM <span className="block mt-2 flex items-center gap-2 border-b border-slate-300 pb-2 text-sm font-normal"><MapPin className="h-4 w-4 text-irctc-orange" /> New Delhi</span></label>
        <label className="text-xs font-bold text-irctc-navy">TO <span className="block mt-2 flex items-center gap-2 border-b border-slate-300 pb-2 text-sm font-normal"><MapPin className="h-4 w-4 text-irctc-orange" /> Mumbai Central</span></label>
        <label className="text-xs font-bold text-irctc-navy">JOURNEY DATE <span className="block mt-2 flex items-center gap-2 border-b border-slate-300 pb-2 text-sm font-normal"><CalendarDays className="h-4 w-4 text-irctc-orange" /> Select date</span></label>
        <Link href="/search" className="inline-flex items-center justify-center gap-2 rounded-md bg-irctc-orange px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-irctc-darkorange">Search <ArrowRight className="w-4 h-4" /></Link>
      </div>
      <p className="relative z-10 mt-5 text-xs text-blue-200">Demo only — no real IRCTC, railway inventory, or payment integration.</p>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {benefits.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50"><Icon className="w-5 h-5 text-irctc-orange" /></div><h2 className="mt-4 font-bold text-irctc-navy">{title}</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p></article>)}
    </section>

    <section className="rail-pattern rounded-lg border border-orange-100 p-6 sm:p-8"><h2 className="text-xl font-extrabold text-irctc-navy">How the demo works</h2><ol className="mt-5 grid gap-5 text-sm text-slate-700 sm:grid-cols-3"><li className="border-l-2 border-irctc-orange pl-4"><strong>1. Join once.</strong><br />Enter the fair waiting room.</li><li className="border-l-2 border-irctc-orange pl-4"><strong>2. Choose a seat.</strong><br />Your selected seat is held briefly.</li><li className="border-l-2 border-irctc-orange pl-4"><strong>3. Pay in sandbox.</strong><br />Receive a mock PNR or see the refund scenario.</li></ol></section>
  </div>;
}
