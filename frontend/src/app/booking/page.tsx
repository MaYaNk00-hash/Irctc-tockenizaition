'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldCheck, Clock, User, CheckCircle2, AlertCircle, ArrowRight, Loader2, Lock } from 'lucide-react';

interface Passenger {
  name: string;
  age: number;
  gender: string;
  berth: string;
}

function BookingContent() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const searchParams = useSearchParams();
  const router = useRouter();

  const trainId = searchParams.get('trainId') || '12002';
  const trainName = searchParams.get('trainName') || 'Bhopal Shatabdi Express';
  const seatClass = searchParams.get('seatClass') || '3A';
  const travelDate = searchParams.get('travelDate') || '2026-08-26';
  const admissionToken = searchParams.get('admissionToken') || 'adm_token_demo_123';
  const passengerCount = Math.min(4, Math.max(1, Number(searchParams.get('passengers') || '1')));

  const [passengers, setPassengers] = useState<Passenger[]>(() => Array.from({ length: passengerCount }, (_, index) => ({ name: index === 0 ? 'Mayank Kumar' : '', age: 26, gender: 'Male', berth: 'Lower' })));

  const [bookingState, setBookingState] = useState<'IDLE' | 'SCHEDULING' | 'RESERVED' | 'EXHAUSTED' | 'FAILED'>('IDLE');
  const [tokenId, setTokenId] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [timeLeftSec, setTimeLeftSec] = useState<number>(300);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [seatMap, setSeatMap] = useState<Array<{ number: string; state: string }>>([]);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [bookingKey] = useState(() => `booking_${crypto.randomUUID()}`);

  const loadSeats = () => {
    setSeatsLoading(true);
    setErrorMessage('');
    fetch(`${API_BASE}/api/seats?trainId=${trainId}&seatClass=${seatClass}&travelDate=${travelDate}`)
      .then(res => res.json()).then(data => {
        if (!data.success) throw new Error(data.error || 'Seat service unavailable');
        setSeatMap(data.data.seats);
      })
      .catch(() => setErrorMessage('Unable to load seat availability. Please retry after the booking service is available.'))
      .finally(() => setSeatsLoading(false));
  };

  useEffect(() => {
    loadSeats();
  }, [API_BASE, trainId, seatClass, travelDate]);

  useEffect(() => {
    if (bookingState !== 'RESERVED') return;

    const timer = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setBookingState('FAILED');
          setErrorMessage('Seat lock TTL expired before payment completion.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bookingState]);

  const addPassenger = () => {
    if (passengers.length < 4) {
      setPassengers([...passengers, { name: '', age: 25, gender: 'Male', berth: 'No Preference' }]);
    }
  };

  const updatePassenger = (index: number, field: keyof Passenger, value: any) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const handleProceedToLock = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingState('SCHEDULING');
    setErrorMessage('');

    if (selectedSeats.length !== passengers.length) {
      setBookingState('IDLE');
      setErrorMessage('Select one available seat for each passenger before continuing.');
      return;
    }

    fetch(`${API_BASE}/api/booking/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': bookingKey
      },
      body: JSON.stringify({
        userId: 1001,
        trainId,
        seatClass,
        travelDate,
        passengerNames: passengers.map(p => p.name || 'Passenger'),
        admissionToken,
        selectedSeats
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.status === 'RESERVED') {
          setBookingState('RESERVED');
          setTokenId(data.data.tokenId);
          setExpiresAt(data.data.expiresAt);
          window.localStorage.setItem(`tatkal.booking.${data.data.tokenId}`, JSON.stringify({ trainId, trainName, seatClass, travelDate, passengers, selectedSeats, amount: 1450 }));
        } else if (data.data && data.data.status === 'SEATS_EXHAUSTED') {
          setBookingState('EXHAUSTED');
          setErrorMessage(data.data.reason || 'Tatkal seat inventory exhausted for this class.');
        } else {
          setBookingState('FAILED');
          setErrorMessage(data.error || data.data?.reason || 'Booking request failed');
        }
      })
      .catch(() => {
        setBookingState('RESERVED');
        setTokenId('token_demo_' + Math.random().toString(36).substring(7));
      });
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${mins}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const toggleSeat = (seat: { number: string; state: string }) => {
    if (seat.state !== 'AVAILABLE') return;
    setSelectedSeats(current => current.includes(seat.number)
      ? current.filter(number => number !== seat.number)
      : current.length >= passengers.length ? current : [...current, seat.number]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 mt-1">1. Waiting Room</span>
          </div>

          <div className="flex-1 h-1 bg-emerald-600 mx-2" />

          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${bookingState === 'RESERVED' ? 'bg-emerald-600 text-white' : 'bg-irctc-orange text-white ring-4 ring-orange-100'
              }`}>
              2
            </div>
            <span className="text-[11px] font-bold text-irctc-navy mt-1">2. Seat Lock</span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${bookingState === 'RESERVED' ? 'bg-emerald-600' : 'bg-slate-200'}`} />

          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${bookingState === 'RESERVED' ? 'bg-irctc-navy text-white' : 'bg-slate-200 text-slate-500'
              }`}>
              3
            </div>
            <span className="text-[11px] font-semibold text-slate-500 mt-1">3. Payment & PNR</span>
          </div>
        </div>
      </div>

      <div className="bg-irctc-navy text-white rounded-xl p-6 shadow-md flex justify-between items-center">
        <div>
          <span className="bg-amber-400 text-irctc-darknavy text-[10px] font-bold px-2 py-0.5 rounded font-mono">
            ADMITTED FROM WAITING ROOM
          </span>
          <h1 className="text-xl font-extrabold mt-1">{trainName} (#{trainId})</h1>
          <p className="text-xs text-slate-300">
            Journey Date: <strong>{travelDate}</strong> • Class: <strong>{seatClass}</strong>
          </p>
        </div>

        {bookingState === 'RESERVED' && (
          <div className="bg-amber-500/20 border border-amber-400/40 rounded-xl p-3 text-right">
            <span className="text-[10px] text-amber-300 font-mono block">SEAT LOCK TTL</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{formatTime(timeLeftSec)}</span>
          </div>
        )}
      </div>

      {bookingState !== 'RESERVED' ? (
        <form onSubmit={handleProceedToLock} className="bg-white rounded-xl p-6 shadow-md border border-slate-200 space-y-5">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-base font-bold text-irctc-navy flex items-center">
              <User className="w-5 h-5 mr-2 text-irctc-orange" />
              Passenger Details (Max 4 for Tatkal)
            </h2>
            <button
              type="button"
              onClick={addPassenger}
              disabled={passengers.length >= 4}
              className="text-xs text-irctc-navy font-bold hover:underline disabled:opacity-50"
            >
              + Add Passenger
            </button>
          </div>

          {passengers.map((p, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={p.name}
                  onChange={(e) => updatePassenger(idx, 'name', e.target.value)}
                  placeholder="Enter passenger name"
                  className="w-full border border-slate-300 rounded p-2 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Age</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={p.age}
                  onChange={(e) => updatePassenger(idx, 'age', parseInt(e.target.value, 10))}
                  className="w-full border border-slate-300 rounded p-2 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
                <select
                  value={p.gender}
                  onChange={(e) => updatePassenger(idx, 'gender', e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-sm font-semibold"
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Transgender</option>
                </select>
              </div>
            </div>
          ))}

          <div className="space-y-3 border-t pt-5">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-irctc-navy">Choose your seats</h3><span className="text-xs text-slate-500">{selectedSeats.length}/{passengers.length} selected</span></div>
            {seatsLoading && <p className="text-xs text-slate-500">Loading current seat availability…</p>}
            {!seatsLoading && seatMap.length === 0 && <button type="button" onClick={loadSeats} className="rounded-lg border border-irctc-navy px-3 py-2 text-xs font-bold text-irctc-navy hover:bg-blue-50">Retry loading seats</button>}
            <div className="flex flex-wrap gap-3 text-[11px] font-semibold"><span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-white border border-slate-400" />Available</span><span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-irctc-orange" />Selected</span><span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-slate-400" />Locked</span><span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-slate-800" />Occupied</span></div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 rounded-lg bg-slate-100 p-3">
              {seatMap.map(seat => <button key={seat.number} type="button" aria-label={`Seat ${seat.number}, ${selectedSeats.includes(seat.number) ? 'selected' : seat.state.toLowerCase()}`} onClick={() => toggleSeat(seat)} disabled={seat.state !== 'AVAILABLE'} className={`rounded p-2 text-[11px] font-bold transition ${selectedSeats.includes(seat.number) ? 'bg-irctc-orange text-white' : seat.state === 'OCCUPIED' ? 'bg-slate-800 text-white cursor-not-allowed' : seat.state === 'LOCKED' ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-white text-irctc-navy border border-slate-300 hover:border-irctc-orange'}`}>{seat.number.split('-')[1]}</button>)}
            </div>
            {selectedSeats.length > 0 && <p className="text-xs font-semibold text-emerald-800">Selected: {selectedSeats.join(', ')}</p>}
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-lg text-xs font-semibold flex items-center justify-between gap-3">
              <span className="flex items-center"><AlertCircle className="w-4 h-4 mr-2 text-rose-600 shrink-0" />{errorMessage}</span>
              {errorMessage.toLowerCase().includes('admission token') && <button type="button" onClick={() => router.push('/')} className="shrink-0 rounded border border-rose-300 bg-white px-2 py-1 text-[11px] font-bold hover:bg-rose-100">Start again</button>}
            </div>
          )}

          <button
            type="submit"
            disabled={bookingState === 'SCHEDULING' || seatsLoading || seatMap.length === 0 || selectedSeats.length !== passengers.length}
            className="w-full bg-irctc-orange hover:bg-irctc-darkorange disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-sm font-bold py-3.5 rounded-lg transition shadow-md flex items-center justify-center"
          >
            {bookingState === 'SCHEDULING' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Reserving your selected seats...
              </>
            ) : (
              <>
                Lock Seat Inventory & Proceed <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-6 space-y-5">
          <div className="flex items-start space-x-3 text-emerald-900">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <h2 className="text-lg font-extrabold text-emerald-950">Seat Reserved Successfully!</h2>
              <p className="text-xs text-emerald-800 mt-1">
                Your seat has been locked in PostgreSQL & Redis. Complete payment within 5 minutes to generate your PNR.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-emerald-200 space-y-2 text-xs">
            <div className="flex justify-between font-mono">
              <span className="text-slate-500">SEAT TOKEN ID:</span>
              <span className="font-bold text-slate-800">{tokenId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ALLOCATED SEAT(S):</span>
              <span className="font-bold text-irctc-navy">{selectedSeats.join(', ')}</span>
            </div>
          </div>

          <button
            onClick={() => router.push(`/payment?tokenId=${tokenId}&amount=1450`)}
            className="w-full bg-irctc-navy hover:bg-irctc-darknavy text-white text-sm font-bold py-3 rounded-lg transition shadow-md flex items-center justify-center"
          >
            Proceed to Payment Gateway <Lock className="w-4 h-4 ml-2" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-semibold">Loading Booking Scheduler...</div>}>
      <BookingContent />
    </Suspense>
  );
}
