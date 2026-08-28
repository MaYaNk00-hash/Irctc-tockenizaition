'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Train, Calendar, ShieldCheck, ArrowRight, AlertCircle, Sparkles, CheckCircle2, Zap } from 'lucide-react';

interface TrainData {
  trainId: string;
  name: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  classes: string[];
}

export default function SearchPage() {
  const router = useRouter();
  const [trains, setTrains] = useState<TrainData[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('3A');
  const [travelDate, setTravelDate] = useState<string>('2026-08-26');
  const [loading, setLoading] = useState<boolean>(true);
  const [from, setFrom] = useState('NDLS (New Delhi)');
  const [to, setTo] = useState('MMCT (Mumbai Central)');
  const [passengerCount, setPassengerCount] = useState(1);

  const [mouseEventsCount, setMouseEventsCount] = useState<number>(0);
  const [startTime] = useState<number>(Date.now());
  const [interactionTime, setInteractionTime] = useState<number>(0);

  useEffect(() => {
    const handleMouseMove = () => {
      setMouseEventsCount((prev) => prev + 1);
      if (interactionTime === 0) {
        setInteractionTime(Date.now() - startTime);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : '');
    fetch(`${API_BASE}/api/trains`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTrains(data.data);
        } else {
          setFallbackTrains();
        }
      })
      .catch(() => setFallbackTrains())
      .finally(() => setLoading(false));

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const setFallbackTrains = () => {
    setTrains([
      { trainId: '12002', name: 'Bhopal Shatabdi Express', origin: 'NDLS (New Delhi)', destination: 'RKMP (Rani Kamalapati)', departureTime: '06:00 AM', arrivalTime: '14:40 PM', duration: '8h 40m', classes: ['1A', 'EC', 'CC'] },
      { trainId: '12951', name: 'Mumbai Rajdhani Express', origin: 'NDLS (New Delhi)', destination: 'MMCT (Mumbai Central)', departureTime: '16:55 PM', arrivalTime: '08:35 AM', duration: '15h 40m', classes: ['1A', '2A', '3A'] },
      { trainId: '20901', name: 'Vande Bharat Express', origin: 'MMCT (Mumbai Central)', destination: 'GNC (Gandhinagar Cap)', departureTime: '06:00 AM', arrivalTime: '12:25 PM', duration: '6h 25m', classes: ['EC', 'CC'] },
      { trainId: '12260', name: 'Sealdah Duronto Express', origin: 'NDLS (New Delhi)', destination: 'SDAH (Sealdah)', departureTime: '19:45 PM', arrivalTime: '12:30 PM', duration: '16h 45m', classes: ['1A', '2A', '3A', 'SL'] },
      { trainId: '12626', name: 'Kerala Express', origin: 'NDLS (New Delhi)', destination: 'TVC (Trivandrum)', departureTime: '20:10 PM', arrivalTime: '18:00 PM (+2 days)', duration: '45h 50m', classes: ['2A', '3A', 'SL'] }
    ]);
  };

  const handleBookTatkal = (train: TrainData, seatClass: string) => {
    const signals = {
      timeToFirstInteractionMs: interactionTime || 1200,
      keystrokeVarianceMs: 35,
      mouseEntropy: Math.min(mouseEventsCount / 50, 0.95),
      navigatedFromSearch: true
    };

    const fingerprint = `fp_browser_${typeof window !== 'undefined' ? window.navigator.userAgent.replace(/\s+/g, '') : 'default'}`;

    router.push(
      `/waiting-room?trainId=${train.trainId}&trainName=${encodeURIComponent(train.name)}&seatClass=${seatClass}&travelDate=${travelDate}&passengers=${passengerCount}&fp=${encodeURIComponent(fingerprint)}&signals=${encodeURIComponent(JSON.stringify(signals))}`
    );
  };

  const stations = Array.from(new Set(trains.flatMap(train => [train.origin, train.destination])));
  const filteredTrains = trains.filter(train => (from === 'Any station' || train.origin === from) && (to === 'Any station' || train.destination === to) && train.classes.includes(selectedClass));

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-irctc-navy via-slate-900 to-irctc-darknavy text-white rounded-xl p-6 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center space-x-2 bg-irctc-orange/20 border border-irctc-orange/40 text-amber-300 text-xs px-3 py-1 rounded-full">
            <Zap className="w-3.5 h-3.5 text-irctc-orange" />
            <span>Tatkal Booking Window Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Book Train Tickets with Fair Queue Protection
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            High-concurrency Tatkal ticket reservation engine with virtual queueing, automated seat lock TTLs, and instant refund processing.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center space-x-2 text-irctc-navy font-bold">
            <Train className="w-5 h-5 text-irctc-orange" />
            <span>Search Tatkal Train Availability</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold border border-amber-300">
              QUOTA: TATKAL
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">From Station</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2.5 text-sm font-semibold text-slate-800"
            ><option>Any station</option>{stations.map(station => <option key={station}>{station}</option>)}</select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">To Station</label>
            <select value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2.5 text-sm font-semibold text-slate-800"
            ><option>Any station</option>{stations.map(station => <option key={station}>{station}</option>)}</select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Journey Date</label>
            <div className="relative">
              <input
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-irctc-navy"
              />
            </div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Passengers</label><select value={passengerCount} onChange={(e) => setPassengerCount(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm font-semibold text-slate-800">{[1, 2, 3, 4].map(count => <option key={count} value={count}>{count} passenger{count > 1 ? 's' : ''}</option>)}</select></div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Preferred Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-irctc-navy"
            >
              <option value="1A">AC 1st Class (1A)</option>
              <option value="2A">AC 2-Tier (2A)</option>
              <option value="3A">AC 3-Tier (3A)</option>
              <option value="CC">AC Chair Car (CC)</option>
              <option value="SL">Sleeper Class (SL)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trains List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-irctc-navy flex items-center">
            <span>Available Tatkal Trains</span>
            <span className="ml-2 bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-mono">
              {filteredTrains.length} Trains
            </span>
          </h2>
          <span className="text-xs text-slate-500">Live Partitioned Queue Protection</span>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-8 text-center text-slate-500 shadow-sm">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-irctc-navy border-t-transparent" />
            <p className="mt-2 text-sm font-medium">Fetching Tatkal inventory status...</p>
          </div>
        ) : (
          filteredTrains.map((train) => (
            <div
              key={train.trainId}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-irctc-navy text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                      #{train.trainId}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{train.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Runs Daily • Tatkal Quota Allocated
                  </p>
                </div>

                <div className="flex items-center space-x-4 text-xs font-semibold text-slate-700">
                  <div>
                    <div className="text-sm font-bold text-irctc-navy">{train.departureTime}</div>
                    <div className="text-slate-500">{train.origin}</div>
                  </div>
                  <div className="text-center px-2 py-1 bg-slate-100 rounded text-[11px] text-slate-600 font-mono">
                    {train.duration}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-irctc-navy">{train.arrivalTime}</div>
                    <div className="text-slate-500">{train.destination}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {train.classes.map((cls) => {
                  const isMatch = cls === selectedClass;
                  return (
                    <div
                      key={cls}
                      className={`p-3 rounded-lg border flex flex-col justify-between transition ${isMatch
                          ? 'border-irctc-orange bg-orange-50/60 ring-2 ring-irctc-orange/20'
                          : 'border-slate-200 bg-slate-50'
                        }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-xs text-slate-800">{cls}</span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                          AVAILABLE
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-emerald-800 flex items-center justify-between">
                        <span>Tatkal Seats: 15</span>
                        <button
                          onClick={() => handleBookTatkal(train, cls)}
                          className="bg-irctc-orange hover:bg-irctc-darkorange text-white text-xs px-2.5 py-1 rounded font-bold transition flex items-center"
                        >
                          Book <ArrowRight className="w-3 h-3 ml-1" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {!loading && filteredTrains.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No mock Tatkal train matches this route and class. Try another station or class.</div>}
      </div>
    </div>
  );
}
