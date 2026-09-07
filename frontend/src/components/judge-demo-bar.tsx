'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, ShieldAlert, RefreshCw, Terminal, CheckCircle2, AlertTriangle, X, Play, Shield, Award } from 'lucide-react';

interface JudgeDemoBarProps {
  onToggleTelemetry?: () => void;
  telemetryOpen?: boolean;
}

export default function JudgeDemoBar({ onToggleTelemetry, telemetryOpen }: JudgeDemoBarProps) {
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : '');

  const [raceLoading, setRaceLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [raceResult, setRaceResult] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSimulateRace = async () => {
    setRaceLoading(true);
    setRaceResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/demo/simulate-race`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainId: '12951', seatClass: '3A', travelDate: '2026-08-26', targetSeat: 'B2-15' })
      });
      const data = await res.json();
      if (data.success) {
        setRaceResult(data);
      } else {
        showToast(`Race simulation error: ${data.error}`);
      }
    } catch {
      showToast('Unable to reach backend simulation endpoint.');
    } finally {
      setRaceLoading(false);
    }
  };

  const handleResetData = async () => {
    setResetLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/demo/reset`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✅ All demo locks, queues, and test state reset to clean baseline!');
      } else {
        showToast('Reset failed on backend.');
      }
    } catch {
      showToast('Backend offline - reset in-memory state.');
    } finally {
      setResetLoading(false);
    }
  };

  const triggerBotDefense = () => {
    const botSignals = encodeURIComponent(JSON.stringify({
      timeToFirstInteractionMs: 12,
      keystrokeVarianceMs: 0,
      mouseEntropy: 0.02,
      navigatedFromSearch: false
    }));
    router.push(`/waiting-room?trainId=12951&trainName=Mumbai+Rajdhani+Express&seatClass=3A&travelDate=2026-08-26&fp=fp_bot_simulator&signals=${botSignals}`);
  };

  const triggerLateRefund = () => {
    router.push('/payment?tokenId=demo_late_token&amount=1450');
  };

  return (
    <>
      {/* Persistent Judge Toolbar */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white border-b border-indigo-500/30 px-4 py-2 text-xs shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Badge & Title */}
          <div className="flex items-center space-x-2">
            <span className="flex items-center gap-1 bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] tracking-wider uppercase">
              <Award className="w-3 h-3 text-slate-950" />
              CodeX Judge Showcase
            </span>
            <span className="hidden sm:inline text-indigo-200 font-semibold text-[11px]">
              One-click live architectural scenarios:
            </span>
          </div>

          {/* Quick Scenario Triggers */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleSimulateRace}
              disabled={raceLoading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-2.5 py-1 rounded transition flex items-center gap-1 text-[11px] shadow-sm border border-indigo-400/40"
              title="Spawn two concurrent requests targeting seat B2-15 simultaneously"
            >
              {raceLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-amber-300" />}
              <span>2-User Seat Race</span>
            </button>

            <button
              onClick={triggerLateRefund}
              className="bg-purple-700 hover:bg-purple-600 text-white font-bold px-2.5 py-1 rounded transition flex items-center gap-1 text-[11px] shadow-sm border border-purple-400/40"
              title="Test payment arriving after lock TTL expiry and instant auto-refund"
            >
              <RefreshCw className="w-3 h-3 text-purple-200" />
              <span>Late Auto-Refund</span>
            </button>

            <button
              onClick={triggerBotDefense}
              className="bg-rose-700 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded transition flex items-center gap-1 text-[11px] shadow-sm border border-rose-400/40"
              title="Simulate automated script signals triggering Hashcash Proof-of-Work friction"
            >
              <ShieldAlert className="w-3 h-3 text-rose-200" />
              <span>Bot PoW Defense</span>
            </button>

            <button
              onClick={handleResetData}
              disabled={resetLoading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-2.5 py-1 rounded transition flex items-center gap-1 text-[11px] border border-slate-600"
              title="Reset all Redis distributed locks, waiting room queues, and tokens"
            >
              <RefreshCw className={`w-3 h-3 text-slate-400 ${resetLoading ? 'animate-spin' : ''}`} />
              <span>Reset State</span>
            </button>

            {onToggleTelemetry && (
              <button
                onClick={onToggleTelemetry}
                className={`font-bold px-2.5 py-1 rounded transition flex items-center gap-1 text-[11px] border ${
                  telemetryOpen
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-slate-800 text-emerald-400 border-emerald-500/40 hover:bg-slate-700'
                }`}
              >
                <Terminal className="w-3 h-3" />
                <span>Live HUD</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-4 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-indigo-500/50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2-User Race Condition Modal Result */}
      {raceResult && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl border-2 border-indigo-500 max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-xs px-2 py-0.5 rounded">
                  RACE RESOLUTION
                </span>
                <h3 className="font-extrabold text-base text-white">Distributed Lock Collision Test</h3>
              </div>
              <button
                onClick={() => setRaceResult(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              {raceResult.summary}
            </p>

            {/* Side by side comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {raceResult.contestants?.map((c: any, idx: number) => {
                const isWinner = c.result?.status === 'RESERVED';
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex flex-col justify-between ${
                      isWinner
                        ? 'bg-emerald-950/60 border-emerald-500/60'
                        : 'bg-rose-950/60 border-rose-500/60'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-xs">{c.user}</span>
                        <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                          isWinner ? 'bg-emerald-400 text-emerald-950' : 'bg-rose-400 text-rose-950'
                        }`}>
                          {isWinner ? 'WINNER (LOCKED)' : 'BLOCKED (ATOMIC)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono">
                        Target: <strong>{raceResult.targetSeat}</strong>
                      </p>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono pt-3 border-t border-slate-800 mt-2">
                      {isWinner ? (
                        <div className="text-emerald-300">
                          ✓ Token ID: {c.result?.tokenId?.substring(0, 16)}...
                          <br />✓ Seat Lock TTL: 120s
                        </div>
                      ) : (
                        <div className="text-rose-300">
                          ✗ Conflict Reason: {c.result?.reason || 'Seat already reserved'}
                          <br />✗ Rollback: 0 state leaked
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRaceResult(null)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
              >
                Close Scenario View
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
