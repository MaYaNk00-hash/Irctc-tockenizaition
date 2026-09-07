'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreditCard, ShieldCheck, Zap, AlertTriangle, CheckCircle2, RefreshCw, Lock, Loader2, ArrowRight, FileText } from 'lucide-react';
import AuthGuard, { useSession } from '../../components/auth-guard';
import RailwaysETicket from '../../components/railways-e-ticket';

function PaymentContent() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : '');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session } = useSession();

  const tokenId = searchParams.get('tokenId') || 'token_demo_123';
  const amount = searchParams.get('amount') || '1450';

  const [paymentMode, setPaymentMode] = useState<'UPI' | 'NET_BANKING' | 'CREDIT_CARD'>('UPI');
  const [simulatedMode, setSimulatedMode] = useState<'SUCCESS' | 'FAILED' | 'DELAYED_LATE_SUCCESS'>('SUCCESS');
  const [processing, setProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [savedBooking, setSavedBooking] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`tatkal.booking.${tokenId}`);
      if (raw) setSavedBooking(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [tokenId]);

  const handlePayNow = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setResult(null);

    fetch(`${API_BASE}/api/payment/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `pay_${tokenId}_${Date.now()}`,
        ...(session?.token ? { 'Authorization': `Bearer ${session.token}` } : {})
      },
      body: JSON.stringify({
        tokenId,
        amount: parseFloat(amount),
        paymentMode,
        simulatedMode
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setResult(data.data);
        } else {
          setResult({ status: 'PAYMENT_FAILED', message: data.error || 'Payment was not completed.', auditReason: 'Backend payment request failed.' });
        }
      })
      .catch(() => {
        setResult({ status: 'PAYMENT_FAILED', message: 'Payment service is unavailable. No booking confirmation was received.', auditReason: 'Backend payment request failed.' });
      })
      .finally(() => setProcessing(false));
  };

  if (result && result.status === 'CONFIRMED') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <RailwaysETicket
          pnr={result.pnr || '9876543210'}
          trainId={savedBooking?.trainId || '12002'}
          trainName={savedBooking?.trainName || 'Bhopal Shatabdi Express'}
          seatClass={savedBooking?.seatClass || '3A'}
          travelDate={savedBooking?.travelDate || '2026-08-26'}
          passengers={savedBooking?.passengers || [{ name: session?.displayName || 'Mayank Kumar', age: 26, gender: 'Male' }]}
          selectedSeats={savedBooking?.selectedSeats || ['B2-01']}
          amount={Number(amount)}
          tokenId={tokenId}
        />

        <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 border border-slate-800 shadow">
          <div>
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Immutable State Machine Audit Log</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Every token transition is recorded with millisecond timestamps and reasons.
            </p>
          </div>
          <button
            onClick={() => router.push(`/history?tokenId=${tokenId}`)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shadow"
          >
            <span>View Full Audit Trail</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-900 flex items-center">
            <Zap className="w-4 h-4 mr-1 text-amber-600" />
            JUDGE / DEMO SIMULATION SWITCHER
          </span>
          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
            HACKATHON MODE
          </span>
        </div>
        <p className="text-xs text-amber-900">Select edge-case simulation to demonstrate Tatkal failure mode fixes:</p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSimulatedMode('SUCCESS')}
            className={`p-2.5 rounded-lg border text-left text-xs font-bold transition ${simulatedMode === 'SUCCESS'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
          >
            <div>1. Normal Success</div>
            <div className="text-[10px] font-normal opacity-90">Valid TTL → Instant PNR</div>
          </button>

          <button
            type="button"
            onClick={() => setSimulatedMode('FAILED')}
            className={`p-2.5 rounded-lg border text-left text-xs font-bold transition ${simulatedMode === 'FAILED'
                ? 'bg-rose-600 text-white border-rose-600 shadow'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
          >
            <div>2. Bank Decline</div>
            <div className="text-[10px] font-normal opacity-90">Gateway failure</div>
          </button>

          <button
            type="button"
            onClick={() => setSimulatedMode('DELAYED_LATE_SUCCESS')}
            className={`p-2.5 rounded-lg border text-left text-xs font-bold transition ${simulatedMode === 'DELAYED_LATE_SUCCESS'
                ? 'bg-purple-600 text-white border-purple-600 shadow ring-2 ring-purple-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
          >
            <div>3. Late Success Edge Case</div>
            <div className="text-[10px] font-normal opacity-90">Auto-refund demo</div>
          </button>
        </div>
      </div>

      <form onSubmit={handlePayNow} className="bg-white rounded-xl p-6 shadow-md border border-slate-200 space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <span className="text-xs text-slate-500 font-mono">SEAT TOKEN: {tokenId.substring(0, 18)}...</span>
            <h1 className="text-lg font-bold text-irctc-navy">IRCTC Mock Payment Gateway</h1>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Total Amount</span>
            <span className="text-xl font-extrabold text-slate-900 font-mono">₹{amount}.00</span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700">Select Payment Method</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMode('UPI')}
              className={`p-3 rounded-lg border text-center text-xs font-bold transition ${paymentMode === 'UPI' ? 'border-irctc-navy bg-blue-50 text-irctc-navy' : 'border-slate-200 text-slate-600'
                }`}
            >
              BHIM / UPI
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('NET_BANKING')}
              className={`p-3 rounded-lg border text-center text-xs font-bold transition ${paymentMode === 'NET_BANKING' ? 'border-irctc-navy bg-blue-50 text-irctc-navy' : 'border-slate-200 text-slate-600'
                }`}
            >
              Net Banking
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('CREDIT_CARD')}
              className={`p-3 rounded-lg border text-center text-xs font-bold transition ${paymentMode === 'CREDIT_CARD' ? 'border-irctc-navy bg-blue-50 text-irctc-navy' : 'border-slate-200 text-slate-600'
                }`}
            >
              Credit/Debit Card
            </button>
          </div>
        </div>

        {result && (
          <div className={`p-4 rounded-xl text-xs font-semibold space-y-2 ${
            result.status === 'REFUND_COMPLETED'
              ? 'bg-purple-50 text-purple-950 border border-purple-300'
              : 'bg-rose-50 text-rose-950 border border-rose-300'
          }`}>
            <div className="font-bold flex items-center text-sm">
              {result.status === 'REFUND_COMPLETED' && <RefreshCw className="w-5 h-5 mr-2 text-purple-600" />}
              {result.status === 'PAYMENT_FAILED' && <AlertTriangle className="w-5 h-5 mr-2 text-rose-600" />}
              Status: {result.status}
            </div>
            <p>{result.message}</p>
            {result.auditReason && <p className="text-[11px] opacity-85">Audit Reason: {result.auditReason}</p>}
            <button
              type="button"
              onClick={() => router.push(`/history?tokenId=${tokenId}`)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-700 underline"
            >
              View State Machine Audit Trail <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={processing}
          className="w-full bg-irctc-orange hover:bg-irctc-darkorange text-white text-sm font-bold py-3.5 rounded-lg transition shadow-md flex items-center justify-center"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing Mock Gateway Webhook...
            </>
          ) : (
            <>
              Pay ₹{amount}.00 & Authorize Booking <Lock className="w-4 h-4 ml-2" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-semibold">Loading Payment Portal...</div>}>
      <AuthGuard fallbackMessage="Sign in to your IRCTC account to authorize payment and confirm your Tatkal ticket.">
        <PaymentContent />
      </AuthGuard>
    </Suspense>
  );
}
