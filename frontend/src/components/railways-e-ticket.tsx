'use client';

import React, { useRef, useState } from 'react';
import { ShieldCheck, Train, CheckCircle2, Download, Printer, QrCode, Lock, Share2, Sparkles, MapPin, Calendar, Clock, User, Award } from 'lucide-react';

interface ETicketProps {
  pnr: string;
  trainId: string;
  trainName: string;
  seatClass: string;
  travelDate: string;
  passengers: { name: string; age?: number; gender?: string; berth?: string }[];
  selectedSeats: string[];
  amount: number;
  tokenId: string;
  confirmedAt?: string;
}

export default function RailwaysETicket({
  pnr,
  trainId,
  trainName,
  seatClass,
  travelDate,
  passengers,
  selectedSeats,
  amount,
  tokenId,
  confirmedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}: ETicketProps) {
  const [copied, setCopied] = useState(false);
  const [showZkpDetails, setShowZkpDetails] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`Indian Railways Confirmed Tatkal Ticket | PNR: ${pnr} | Train: ${trainName} (${trainId}) | Seats: ${selectedSeats.join(', ')}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            TOKENIZED PNR CONFIRMED
          </span>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Ref: {tokenId.substring(0, 16)}...
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowZkpDetails(!showZkpDetails)}
            className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold transition flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>{showZkpDetails ? 'Hide Token Details' : 'Verify Booking Token Hash'}</span>
          </button>

          <button
            onClick={handleShare}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-lg bg-irctc-navy hover:bg-irctc-darknavy text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {showZkpDetails && (
        <div className="bg-indigo-950 text-indigo-100 rounded-xl p-4 border border-indigo-400/40 text-xs space-y-2 animate-in fade-in">
          <div className="font-bold flex items-center gap-1.5 text-amber-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Booking Token Integrity Verification (Demo Hash)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-indigo-200">
            <div>PNR Token Hash: SHA256(PNR_{pnr})</div>
            <div>Auth Context: Verified Session ({passengers[0]?.name || 'Passenger'})</div>
            <div>Allocation Mode: Single-Node TTL Lock + Postgres Log</div>
            <div>Verification Mode: Offline Verifiable Demo Payload</div>
          </div>
        </div>
      )}

      {/* Official Photorealistic IRCTC e-Ticket Card */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-xl overflow-hidden print:border-none print:shadow-none">
        {/* Ticket Header */}
        <div className="irctc-gradient text-white p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-48 h-48 rounded-full border-[18px] border-white/10 pointer-events-none" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-extrabold tracking-wider uppercase">
                <Train className="w-4 h-4" />
                <span>Indian Railways • Electronic Reservation Slip (ERS)</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black">{trainName}</h1>
              <div className="text-xs text-blue-100 flex items-center gap-3 pt-1">
                <span>Train No: <strong className="text-white font-mono">{trainId}</strong></span>
                <span>•</span>
                <span>Class: <strong className="text-white">{seatClass}</strong></span>
                <span>•</span>
                <span>Quota: <strong className="text-amber-300 font-bold">TATKAL (PROTECTED)</strong></span>
              </div>
            </div>

            <div className="text-right bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl p-3">
              <span className="text-[10px] text-blue-200 block font-mono">PNR NUMBER</span>
              <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono tracking-wider">{pnr}</span>
              <span className="text-[10px] text-emerald-300 font-bold block mt-0.5">✓ CONFIRMED</span>
            </div>
          </div>
        </div>

        {/* Journey Details Bar */}
        <div className="bg-slate-50 border-y border-slate-200 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-slate-500 flex items-center gap-1 font-semibold">
              <Calendar className="w-3.5 h-3.5 text-irctc-orange" /> Travel Date
            </span>
            <span className="font-bold text-slate-900 text-sm">{travelDate}</span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 flex items-center gap-1 font-semibold">
              <Clock className="w-3.5 h-3.5 text-irctc-blue" /> Scheduled Departure
            </span>
            <span className="font-bold text-slate-900 text-sm">06:00 AM (On Time)</span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 flex items-center gap-1 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-rose-500" /> Origin Station
            </span>
            <span className="font-bold text-slate-900 text-sm">NDLS • New Delhi</span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 flex items-center gap-1 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Destination
            </span>
            <span className="font-bold text-slate-900 text-sm">RKMP / MMCT</span>
          </div>
        </div>

        {/* Passenger & Berth Allocation Table */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-irctc-navy uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-irctc-orange" />
              Passenger & Berth Allocation Details
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Passenger Name</th>
                    <th className="p-3">Age / Gender</th>
                    <th className="p-3">Coach / Seat No.</th>
                    <th className="p-3">Berth Type</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {passengers.map((p, idx) => {
                    const seatNum = selectedSeats[idx] || `B2-${String(idx + 1).padStart(2, '0')}`;
                    return (
                      <tr key={idx} className="hover:bg-blue-50/40">
                        <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{p.name || 'Passenger 1'}</td>
                        <td className="p-3 text-slate-600">{p.age || 26} Yrs / {p.gender || 'Male'}</td>
                        <td className="p-3">
                          <span className="bg-blue-100 text-irctc-navy font-bold font-mono px-2 py-0.5 rounded border border-blue-200 text-xs">
                            {seatNum}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium">
                          {p.berth || (seatNum.includes('01') ? 'Lower Berth (Window)' : 'Side Lower')}
                        </td>
                        <td className="p-3 text-right">
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                            CNF (Confirmed)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fare Summary & Cryptographic QR Block */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200 items-center">
            {/* Fare Breakdown */}
            <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Base Fare ({passengers.length} Passenger{passengers.length > 1 ? 's' : ''})</span>
                <span className="font-mono">₹{amount - 150}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tatkal Quota Premium</span>
                <span className="font-mono">₹150</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Convenience Fee & Distributed Lock Token Fee</span>
                <span className="font-mono text-emerald-700 font-semibold">₹0 (Free Demo)</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-irctc-navy border-t border-slate-200 pt-2">
                <span>Total Amount Paid</span>
                <span className="text-base font-black font-mono text-emerald-700">₹{amount}</span>
              </div>
            </div>

            {/* Offline-Scannable Hologram QR Stamp */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 rounded-xl border border-indigo-400/40 text-center space-y-2">
              <div className="w-20 h-20 bg-white p-1.5 rounded-lg mx-auto flex items-center justify-center shadow-md">
                {/* SVG QR representation */}
                <div className="w-full h-full border-2 border-slate-900 rounded p-0.5 grid grid-cols-5 gap-0.5 bg-slate-900">
                  <div className="bg-white col-span-2 row-span-2" />
                  <div className="bg-slate-900" />
                  <div className="bg-white col-span-2 row-span-2" />
                  <div className="bg-white" />
                  <div className="bg-slate-900" />
                  <div className="bg-white" />
                  <div className="bg-white col-span-2 row-span-2" />
                  <div className="bg-slate-900" />
                  <div className="bg-white col-span-2 row-span-2" />
                </div>
              </div>
              <span className="text-[10px] font-mono text-indigo-200 block">
                CRIS Cryptographic QR (Offline TTE Verifiable)
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 text-center border-t border-slate-200 pt-3">
            Issued under Ministry of Railways Fair-Booking Directive • Token ID: <span className="font-mono text-slate-700">{tokenId}</span> • Booking Timestamp: {confirmedAt}
          </div>
        </div>
      </div>
    </div>
  );
}
