'use client';

import React, { useState } from 'react';
import { Lock, Check, Compass } from 'lucide-react';

export interface SeatItem {
  number: string;
  seatNumber?: number;
  berthType?: 'LB' | 'MB' | 'UB' | 'SL' | 'SU' | string;
  berthLabel?: string;
  isWindow?: boolean;
  bayNumber?: number;
  state: 'AVAILABLE' | 'LOCKED' | 'OCCUPIED' | string;
  coach?: string;
}

interface CoachSeatMapProps {
  seats: SeatItem[];
  selectedSeats: string[];
  maxSelectable: number;
  onToggleSeat: (seatNumber: string) => void;
  seatClass?: string;
  coachName?: string;
}

export default function CoachSeatMap({
  seats,
  selectedSeats,
  maxSelectable,
  onToggleSeat,
  seatClass = '3A',
  coachName = 'B2'
}: CoachSeatMapProps) {
  const [filterBerth, setFilterBerth] = useState<string>('ALL');

  // Group seats by bay
  const bayMap: Record<number, SeatItem[]> = {};
  seats.forEach((seat, idx) => {
    const bay = seat.bayNumber || Math.ceil((idx + 1) / (seatClass === '2A' ? 6 : 8));
    if (!bayMap[bay]) bayMap[bay] = [];
    bayMap[bay].push(seat);
  });

  const bays = Object.entries(bayMap).sort(([a], [b]) => Number(a) - Number(b));

  const filteredSeats = filterBerth === 'ALL'
    ? seats
    : filterBerth === 'WINDOW'
      ? seats.filter(s => s.isWindow)
      : seats.filter(s => s.berthType === filterBerth);

  return (
    <div className="space-y-4">
      {/* Legend & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-3.5 rounded-xl text-xs">
        <div className="flex items-center space-x-2">
          <span className="bg-amber-400 text-slate-950 font-mono font-bold px-2 py-0.5 rounded text-[10px]">
            COACH {coachName}
          </span>
          <span className="font-semibold text-slate-200">
            {seatClass === '1A' ? 'AC First Class (1A)' : seatClass === '2A' ? 'AC 2-Tier (2A)' : seatClass === '3A' ? 'AC 3-Tier (3A)' : 'Sleeper Class (SL)'}
          </span>
        </div>

        {/* Berth Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 mr-1 flex items-center">
            <Compass className="w-3 h-3 mr-1" /> Filter:
          </span>
          {['ALL', 'LB', 'MB', 'UB', 'SL', 'WINDOW'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterBerth(type)}
              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                filterBerth === type
                  ? 'bg-irctc-orange text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {type === 'ALL' ? 'All Seats' : type === 'WINDOW' ? '🪟 Window' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Seat State Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold px-1 text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-white border-2 border-emerald-500 shadow-sm inline-block" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-irctc-orange border border-irctc-darkorange shadow-sm inline-block" />
          Selected ({selectedSeats.length}/{maxSelectable})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-600 animate-pulse inline-block" />
          Locked in Parallel Session
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-slate-700 border border-slate-900 inline-block" />
          Occupied
        </span>
      </div>

      {/* 2D Train Coach Chassis */}
      <div className="bg-slate-100 p-4 rounded-2xl border-2 border-slate-300 shadow-inner relative overflow-x-auto">
        {/* Train Coach Exterior Border Details */}
        <div className="min-w-[640px] space-y-4">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 border-b border-slate-200 pb-1.5 px-2">
            <span>◄ ENTRY DOOR / VESTIBULE</span>
            <span className="font-bold text-slate-600 uppercase tracking-wider">INDIAN RAILWAYS STANDARD 2D COACH LAYOUT</span>
            <span>RESTROOM / PANTRY ►</span>
          </div>

          {/* Bays container */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {bays.map(([bayNum, baySeats]) => {
              // Separate main cabin berths (LB, MB, UB) from side berths (SL, SU)
              const mainCabinSeats = baySeats.filter(s => s.berthType !== 'SL' && s.berthType !== 'SU');
              const sideSeats = baySeats.filter(s => s.berthType === 'SL' || s.berthType === 'SU');

              return (
                <div
                  key={bayNum}
                  className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-sm flex flex-col justify-between relative"
                >
                  <div className="text-[10px] font-bold text-irctc-navy font-mono mb-2 flex justify-between items-center border-b border-slate-100 pb-1">
                    <span>BAY #{bayNum}</span>
                    <span className="text-[9px] text-slate-400">CABIN</span>
                  </div>

                  {/* Main Cabin 6-Berths grid (3 left, 3 right) */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {mainCabinSeats.map((seat) => {
                      const isSelected = selectedSeats.includes(seat.number);
                      const isLocked = seat.state === 'LOCKED';
                      const isOccupied = seat.state === 'OCCUPIED';
                      const isAvailable = seat.state === 'AVAILABLE';
                      const isDimmed = filterBerth !== 'ALL' && !filteredSeats.some(s => s.number === seat.number);

                      return (
                        <button
                          key={seat.number}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => onToggleSeat(seat.number)}
                          className={`relative p-1.5 rounded-lg text-center transition-all flex flex-col items-center justify-center min-h-[58px] ${
                            isSelected
                              ? 'bg-irctc-orange text-white ring-2 ring-orange-400 ring-offset-1 shadow-md scale-105 z-10'
                              : isOccupied
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-80'
                                : isLocked
                                  ? 'bg-amber-100 text-amber-900 border-2 border-amber-400 animate-pulse cursor-not-allowed'
                                  : isDimmed
                                    ? 'bg-slate-50 text-slate-400 border border-slate-200 opacity-40'
                                    : 'bg-emerald-50/50 hover:bg-emerald-100 text-slate-800 border border-emerald-300 hover:border-emerald-500 shadow-sm hover:scale-105'
                          }`}
                          title={`Seat ${seat.number} • ${seat.berthLabel || seat.berthType || 'Berth'} ${seat.isWindow ? '• Window' : ''}`}
                        >
                          <span className="text-[11px] font-extrabold font-mono leading-none">
                            {seat.number.split('-')[1]}
                          </span>
                          <span className={`text-[9px] font-bold mt-0.5 px-1 py-0.2 rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                          }`}>
                            {seat.berthType || 'LB'}
                          </span>
                          {seat.isWindow && (
                            <span className="text-[8px] text-blue-500 font-bold mt-0.5">🪟</span>
                          )}
                          {isLocked && (
                            <Lock className="w-3 h-3 text-amber-700 absolute top-1 right-1" />
                          )}
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-white absolute -top-1.5 -right-1.5 bg-irctc-darkorange rounded-full p-0.5 shadow" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Aisle Gangway Spacer */}
                  <div className="bg-slate-100 border-y border-dashed border-slate-300 text-[8px] text-center text-slate-400 font-mono py-0.5 my-1 tracking-widest">
                    ── AISLE / CORRIDOR ──
                  </div>

                  {/* Side Berths (SL, SU) */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {sideSeats.map((seat) => {
                      const isSelected = selectedSeats.includes(seat.number);
                      const isLocked = seat.state === 'LOCKED';
                      const isOccupied = seat.state === 'OCCUPIED';
                      const isAvailable = seat.state === 'AVAILABLE';
                      const isDimmed = filterBerth !== 'ALL' && !filteredSeats.some(s => s.number === seat.number);

                      return (
                        <button
                          key={seat.number}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => onToggleSeat(seat.number)}
                          className={`relative p-1.5 rounded-lg text-center transition-all flex flex-col items-center justify-center min-h-[50px] ${
                            isSelected
                              ? 'bg-irctc-orange text-white ring-2 ring-orange-400 ring-offset-1 shadow-md scale-105 z-10'
                              : isOccupied
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-80'
                                : isLocked
                                  ? 'bg-amber-100 text-amber-900 border-2 border-amber-400 animate-pulse cursor-not-allowed'
                                  : isDimmed
                                    ? 'bg-slate-50 text-slate-400 border border-slate-200 opacity-40'
                                    : 'bg-blue-50/60 hover:bg-blue-100 text-slate-800 border border-blue-300 hover:border-blue-500 shadow-sm hover:scale-105'
                          }`}
                          title={`Seat ${seat.number} • ${seat.berthLabel || seat.berthType || 'Side Berth'} (Window)`}
                        >
                          <span className="text-[11px] font-extrabold font-mono leading-none">
                            {seat.number.split('-')[1]}
                          </span>
                          <span className={`text-[9px] font-bold mt-0.5 px-1 py-0.2 rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                          }`}>
                            {seat.berthType || 'SL'} 🪟
                          </span>
                          {isLocked && (
                            <Lock className="w-3 h-3 text-amber-700 absolute top-1 right-1" />
                          )}
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-white absolute -top-1.5 -right-1.5 bg-irctc-darkorange rounded-full p-0.5 shadow" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
