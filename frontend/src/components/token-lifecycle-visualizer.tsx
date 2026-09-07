'use client';

import React, { useState } from 'react';
import { Shield, Key, Shuffle, Lock, CheckCircle2, ArrowRight, Zap, RefreshCw, Layers } from 'lucide-react';

const stages = [
  {
    step: 'Stage 1',
    name: 'Passenger Session Token',
    tech: 'JWT / Session Auth',
    desc: 'Binds each queue request to an authenticated passenger session to prevent anonymous scraping.',
    icon: Shield,
    color: 'from-blue-600 to-indigo-600',
    tag: 'AUTHENTICATION'
  },
  {
    step: 'Stage 2',
    name: 'Waiting Room Queue Token',
    tech: 'Redis Sorted Set',
    desc: 'Buffers incoming traffic in Redis Sorted Sets, protecting database connections during the 10:00 AM rush.',
    icon: Key,
    color: 'from-amber-500 to-orange-600',
    tag: 'CONCURRENCY BUFFER'
  },
  {
    step: 'Stage 3',
    name: 'Deterministic Admission Token',
    tech: 'Fisher-Yates Batch Shuffle',
    desc: 'Randomized batch release without unfair advantage from rapid browser refresh.',
    icon: Shuffle,
    color: 'from-purple-600 to-indigo-700',
    tag: 'FAIR ALLOCATION'
  },
  {
    step: 'Stage 4',
    name: 'Distributed Seat Lock Token',
    tech: '2-Min Atomic TTL Lock',
    desc: 'Holds selected berth with automated TTL expiry to prevent zombie locks; cross-replica verification pending Phase 2.',
    icon: Lock,
    color: 'from-rose-500 to-pink-600',
    tag: 'TTL SEAT HOLD'
  },
  {
    step: 'Stage 5',
    name: 'Confirmed PNR Token',
    tech: 'HMAC-SHA256 Checksum',
    desc: 'Generates confirmed booking token and records transitions to the status_audit_log ledger.',
    icon: CheckCircle2,
    color: 'from-emerald-500 to-teal-600',
    tag: 'AUDIT VERIFIABLE'
  }
];

export default function TokenLifecycleVisualizer() {
  const [activeStage, setActiveStage] = useState<number>(0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-irctc-navy text-amber-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" /> Core Architecture
            </span>
            <span className="text-irctc-orange font-bold text-xs">5-Stage Tokenization Pipeline</span>
          </div>
          <h2 className="text-xl font-extrabold text-irctc-navy mt-1">
            How Tokenization Decouples Fragile Database Transactions
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl mt-0.5">
            Traditional architectures degrade when burst connections open concurrent transactions directly against core tables. Our prototype decouples the workflow into staged coordination tokens.
          </p>
        </div>
      </div>

      {/* 5-Stage Stepper Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          const isSelected = activeStage === idx;
          return (
            <button
              key={st.step}
              type="button"
              onClick={() => setActiveStage(idx)}
              className={`p-4 rounded-xl text-left transition-all border-2 flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'border-irctc-navy bg-slate-900 text-white shadow-lg -translate-y-1'
                  : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 text-slate-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  isSelected ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-200 text-slate-700'
                }`}>
                  {st.step}
                </span>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${st.color} text-white shadow-sm`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div>
                <h4 className={`text-xs font-black leading-tight ${isSelected ? 'text-white' : 'text-irctc-navy'}`}>
                  {st.name}
                </h4>
                <span className={`text-[10px] font-mono mt-0.5 block ${isSelected ? 'text-indigo-300' : 'text-slate-500'}`}>
                  {st.tech}
                </span>
              </div>

              <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                isSelected ? 'text-emerald-400' : 'text-irctc-orange'
              }`}>
                {st.tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* Deep-Dive Active Stage Explainer */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded">
              {stages[activeStage].step}: {stages[activeStage].name}
            </span>
            <span className="text-xs text-indigo-300 font-mono">
              Engine: {stages[activeStage].tech}
            </span>
          </div>
          <span className="text-xs text-amber-300 font-bold">
            Measured Admission Baseline: ~3,155 req/s
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          {stages[activeStage].desc}
        </p>
      </div>
    </div>
  );
}
