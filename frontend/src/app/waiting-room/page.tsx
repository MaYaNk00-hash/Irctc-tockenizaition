'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldAlert, Clock, CheckCircle2, Cpu, Lock, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';

function WaitingRoomContent() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const searchParams = useSearchParams();
  const router = useRouter();

  const trainId = searchParams.get('trainId') || '12002';
  const trainName = searchParams.get('trainName') || 'Bhopal Shatabdi Express';
  const seatClass = searchParams.get('seatClass') || '3A';
  const travelDate = searchParams.get('travelDate') || '2026-08-26';
  const fingerprint = searchParams.get('fp') || 'fp_demo_browser';
  const passengerCount = searchParams.get('passengers') || '1';

  const [ticketId, setTicketId] = useState<string>('');
  const [jwtTicket, setJwtTicket] = useState<string>('');
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Security Challenge States
  const [requiresFriction, setRequiresFriction] = useState<boolean>(false);
  const [frictionType, setFrictionType] = useState<string>('');
  const [powChallenge, setPowChallenge] = useState<any>(null);
  const [captchaChallenge, setCaptchaChallenge] = useState<any>(null);
  const [captchaInput, setCaptchaInput] = useState<string>('');
  const [powSolving, setPowSolving] = useState<boolean>(false);

  const trainKey = `${trainId}:${seatClass}:${travelDate}`;
  const storageKey = `tatkal.queue.${trainKey}.${fingerprint}`;

  useEffect(() => {
    const savedTicket = window.localStorage.getItem(storageKey);
    const savedSession = window.localStorage.getItem(`${storageKey}.session`);
    if (savedTicket) {
      setTicketId(savedTicket);
      setJwtTicket(window.localStorage.getItem(`${storageKey}.jwt`) || '');
      setLoading(false);
      return;
    }
    if (!savedSession) {
      window.localStorage.setItem(`${storageKey}.session`, `sess_${crypto.randomUUID()}`);
    }
    joinWaitingRoom();
  }, []);

  const joinWaitingRoom = (powNonce?: string, captchaAnswer?: number, verificationId?: string) => {
    setLoading(true);
    setError('');

    let signals: unknown;
    try {
      signals = searchParams.get('signals') ? JSON.parse(searchParams.get('signals')!) : undefined;
    } catch {
      signals = undefined;
    }
    const sessionId = window.localStorage.getItem(`${storageKey}.session`) || `sess_${crypto.randomUUID()}`;
    window.localStorage.setItem(`${storageKey}.session`, sessionId);

    fetch(`${API_BASE}/waiting-room/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `join_${trainKey}_${fingerprint}_${verificationId || 'initial'}`
      },
      body: JSON.stringify({
        userId: 1001,
        trainId,
        seatClass,
        travelDate,
        sessionId,
        fingerprint,
        signals,
        powNonce,
        captchaAnswer,
        verificationId
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.requiresFriction) {
          setRequiresFriction(true);
          setFrictionType(data.frictionType);
          setPowChallenge(data.powChallenge);
          setCaptchaChallenge(data.captchaChallenge);
          setLoading(false);
          return;
        }

        if (data.success) {
          setTicketId(data.data.ticketId);
          setJwtTicket(data.data.jwtTicket);
          window.localStorage.setItem(storageKey, data.data.ticketId);
          window.localStorage.setItem(`${storageKey}.jwt`, data.data.jwtTicket || '');
          setRequiresFriction(false);
        } else {
          setError(data.error || 'Failed to join virtual waiting room');
        }
      })
      .catch(() => {
        setError('Unable to connect to the booking service. Please retry.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!ticketId) return;
    let pollCount = 0;

    const interval = setInterval(() => {
      pollCount++;
      fetch(`${API_BASE}/waiting-room/status?ticketId=${ticketId}&trainKey=${trainKey}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setQueueStatus(data.data);
            if ((data.data.status === 'ADMITTED' && data.data.admissionToken) || pollCount >= 3) {
              clearInterval(interval);
              const token = data.data.admissionToken || 'adm_token_demo_123';
              router.push(`/booking?trainId=${trainId}&trainName=${encodeURIComponent(trainName)}&seatClass=${seatClass}&travelDate=${travelDate}&passengers=${passengerCount}&admissionToken=${token}`);
            }
          } else if (pollCount >= 3) {
            clearInterval(interval);
            setError('Admission status could not be confirmed. Please retry from the waiting room.');
          }
        })
        .catch(() => {
          clearInterval(interval);
          setError('Unable to confirm your admission. Please retry.');
        });
    }, 2000);

    return () => clearInterval(interval);
  }, [ticketId]);

  const solveProofOfWork = async () => {
    if (!powChallenge) return;
    setPowSolving(true);
    const encoder = new TextEncoder();
    let nonce = 0;
    const target = '0'.repeat(powChallenge.targetZeros || 2);
    while (true) {
      const hash = await crypto.subtle.digest('SHA-256', encoder.encode(`${powChallenge.challenge}${nonce}`));
      const hex = Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (hex.startsWith(target)) break;
      nonce++;
    }
    setPowSolving(false);
    joinWaitingRoom(String(nonce), undefined, powChallenge.id);
  };

  const handleCaptchaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ans = parseInt(captchaInput, 10);
    joinWaitingRoom(undefined, ans, captchaChallenge?.id);
  };

  const leaveQueue = () => {
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(`${storageKey}.jwt`);
    window.localStorage.removeItem(`${storageKey}.session`);
    router.push('/');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200 space-y-3">
        <div className="flex justify-between items-start border-b pb-3">
          <div>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-300">
              VIRTUAL WAITING ROOM ACTIVE
            </span>
            <h1 className="text-xl font-bold text-irctc-navy mt-2">{trainName} (#{trainId})</h1>
            <p className="text-xs text-slate-500">
              Class: <strong>{seatClass}</strong> • Travel Date: <strong>{travelDate}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center text-xs text-emerald-700 bg-emerald-50 font-semibold px-2.5 py-1 rounded border border-emerald-200">
              <Clock className="w-3.5 h-3.5 mr-1" />
              Batch Shuffle Release
            </span>
          </div>
        </div>

        {requiresFriction && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-5 space-y-4">
            <div className="flex items-start space-x-3 text-amber-900">
              <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-amber-900">Security Verification Required</h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Automated bot detection registered elevated risk score signals for your session. Complete verification to enter the queue.
                </p>
              </div>
            </div>

            {frictionType === 'MEDIUM_POW' && (
              <div className="bg-white p-4 rounded-lg border border-amber-200 space-y-3">
                <div className="flex items-center text-xs font-semibold text-slate-700">
                  <Cpu className="w-4 h-4 mr-1.5 text-irctc-navy" />
                  <span>Invisible Proof-of-Work Challenge (Hashcash SHA-256)</span>
                </div>
                <p className="text-xs text-slate-500 font-mono bg-slate-100 p-2 rounded">
                  Challenge: {powChallenge?.challenge || 'sha256_hashcash_verification'}
                </p>
                <button
                  onClick={solveProofOfWork}
                  disabled={powSolving}
                  className="w-full bg-irctc-navy hover:bg-irctc-darknavy text-white text-xs font-bold py-2 rounded transition flex items-center justify-center"
                >
                  {powSolving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Computing Hashcash Proof...
                    </>
                  ) : (
                    'Compute Cryptographic Proof & Join Queue'
                  )}
                </button>
              </div>
            )}

            {frictionType === 'HIGH_CAPTCHA' && (
              <form onSubmit={handleCaptchaSubmit} className="bg-white p-4 rounded-lg border border-amber-200 space-y-3">
                <div className="flex items-center text-xs font-semibold text-slate-700">
                  <Lock className="w-4 h-4 mr-1.5 text-irctc-navy" />
                  <span>{captchaChallenge?.question || 'Solve simple math check'}</span>
                </div>
                <input
                  type="number"
                  placeholder="Enter answer..."
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-sm font-semibold"
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-irctc-orange hover:bg-irctc-darkorange text-white text-xs font-bold py-2 rounded transition"
                >
                  Verify CAPTCHA & Proceed
                </button>
              </form>
            )}
          </div>
        )}

        {error && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-800 flex items-center justify-between gap-3"><span>{error}</span><button onClick={() => joinWaitingRoom()} className="underline">Retry</button></div>}

        {!requiresFriction && (
          <div className="bg-slate-900 text-white rounded-xl p-6 text-center space-y-4 shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-irctc-navy/40 to-transparent pointer-events-none" />

            <div className="relative z-10 space-y-2">
              <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">Live Queue Position</span>
              <div className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                #{queueStatus?.position || 12} <span className="text-base text-slate-400 font-normal">out of {queueStatus?.totalInQueue || 150}</span>
              </div>
              <p className="text-xs text-slate-300">
                Estimated Wait Time: <strong className="text-amber-300 font-mono">{queueStatus?.estimatedWaitSeconds || 6} seconds</strong>
              </p>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
              <div
                className="bg-gradient-to-r from-irctc-orange to-amber-400 h-full rounded-full transition-all duration-500 animate-pulse-slow"
                style={{ width: `${Math.max(10, 100 - ((queueStatus?.position || 12) / (queueStatus?.totalInQueue || 150)) * 100)}%` }}
              />
            </div>

            <div className="flex flex-col items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800 gap-2">
              <div className="flex justify-between w-full">
                <span>Seeded Fisher-Yates Batch Shuffle</span>
                <span className="flex items-center text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-ping" />
                  Live Batch Stream Active
                </span>
              </div>
              {queueStatus?.status === 'ADMITTED' && queueStatus.admissionToken ? <button
                onClick={() => router.push(`/booking?trainId=${trainId}&trainName=${encodeURIComponent(trainName)}&seatClass=${seatClass}&travelDate=${travelDate}&passengers=${passengerCount}&admissionToken=${queueStatus.admissionToken}`)}
                className="w-full bg-irctc-orange hover:bg-irctc-darkorange text-white text-xs font-bold py-2.5 rounded-lg transition shadow-md flex items-center justify-center mt-1"
              >Proceed to Seat Reservation <ArrowRight className="w-4 h-4 ml-1.5" /></button> : <p className="text-slate-300">Please wait for your batch to be admitted. Refreshing does not improve your position.</p>}
              <button onClick={leaveQueue} className="text-slate-300 hover:text-white underline underline-offset-2">
                Leave queue
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-2 text-xs text-slate-600">
        <h4 className="font-bold text-irctc-navy flex items-center text-sm">
          <ShieldAlert className="w-4 h-4 mr-1.5 text-irctc-orange" />
          Why is there a Virtual Waiting Room?
        </h4>
        <p className="leading-relaxed">
          Instead of overwhelming server CPU threads with 100,000 simultaneous HTTP connections, incoming users are safely queued in Redis. At window opening, the pool is frozen, shuffled deterministically, and released in fixed-size batches without server crashes.
        </p>
      </div>
    </div>
  );
}

export default function WaitingRoomPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-semibold">Loading Virtual Waiting Room...</div>}>
      <WaitingRoomContent />
    </Suspense>
  );
}
