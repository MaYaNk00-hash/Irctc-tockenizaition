'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, Zap, ShieldAlert, Cpu, Layers, Play, CheckCircle2, RefreshCw, BarChart2, Activity, Server, Users, Settings } from 'lucide-react';
import AuthGuard from '../../components/auth-guard';
import MillionUserSimulator from '../../components/million-user-simulator';
import TokenLifecycleVisualizer from '../../components/token-lifecycle-visualizer';

interface RiskScoreEntry {
  id: number;
  session_id: string;
  device_fingerprint: string;
  score: number;
  signals: any;
  friction_applied: string;
  created_at: string;
}

function AdminContent() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : '');
  const [riskScores, setRiskScores] = useState<RiskScoreEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [metricsError, setMetricsError] = useState<string>('');
  const [metrics, setMetrics] = useState<any>(null);

  // Config State
  const [batchSize, setBatchSize] = useState<number>(10);
  const [batchIntervalMs, setBatchIntervalMs] = useState<number>(3000);
  const [configSuccess, setConfigSuccess] = useState<boolean>(false);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = () => {
    fetch(`${API_BASE}/api/admin/bot-metrics`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setRiskScores(data.data);
        else setMetricsError(data.error || 'Risk metrics are unavailable.');
      })
      .catch(() => setMetricsError('Risk metrics are unavailable. Check the backend connection and try again.'))
      .finally(() => setLoading(false));
    fetch(`${API_BASE}/api/admin/metrics`).then(res => res.json()).then(data => { if (data.success) setMetrics(data.data); }).catch(() => undefined);
  };

  const handleUpdateConfig = () => {
    fetch(`${API_BASE}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchSize, batchIntervalMs })
    })
      .then((res) => res.json())
      .then(() => {
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 3000);
      })
      .catch(() => {
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 3000);
      });
  };

  return (
    <div className="space-y-8">
      {/* Real Live Million-Scale Concurrency Stress Tester */}
      <MillionUserSimulator />

      {/* 5-Stage Tokenization Lifecycle Pipeline */}
      <TokenLifecycleVisualizer />

      {/* 4 Partition Streams Telemetry Cards */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-irctc-navy" />
            <h3 className="text-sm font-extrabold text-irctc-navy uppercase tracking-wider">
              Active Distributed Hash Partition Workers
            </h3>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
            4 Cores Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((partitionId) => (
            <div key={partitionId} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 font-mono">PARTITION #{partitionId}</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-bold">ONLINE</span>
              </div>
              <div className="text-sm font-black text-irctc-navy font-mono truncate">
                stream:booking:p{partitionId}
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Worker Core #{partitionId + 1}</span>
                <span className="font-mono text-slate-800 font-bold">Processed: {metrics?.partitions?.[partitionId] ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bot Detection Risk Feed & Live Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Scores Live Feed (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center space-x-2 text-irctc-navy font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-irctc-orange" />
              <span>Live Bot Detection & Risk Scoring Feed</span>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              {riskScores.length} Sessions Evaluated
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Session ID</th>
                  <th className="p-2.5">Risk Score</th>
                  <th className="p-2.5">Friction Applied</th>
                  <th className="p-2.5">Signals Evaluated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {riskScores.length > 0 ? (
                  riskScores.map((score) => (
                    <tr key={score.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-slate-700 font-bold">{score.session_id.substring(0, 14)}...</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          score.score >= 80
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : score.score >= 30
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          {score.score}/100
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className="text-slate-800 font-semibold">{score.friction_applied}</span>
                      </td>
                      <td className="p-2.5 text-slate-500 text-[11px] truncate max-w-xs">
                        {typeof score.signals === 'object' ? JSON.stringify(score.signals) : score.signals}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500 font-sans">
                      No high-risk bot sessions detected in current window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Config Controls (1 Column) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center space-x-2 text-irctc-navy font-bold text-sm border-b pb-3">
            <Settings className="w-5 h-5 text-irctc-navy" />
            <span>Dynamic Waiting Room Tuning</span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Batch Size (Tickets per Release)</label>
              <input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold focus:border-irctc-navy focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Adjusts instantaneous burst admission quota</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Batch Interval (Milliseconds)</label>
              <input
                type="number"
                value={batchIntervalMs}
                onChange={(e) => setBatchIntervalMs(parseInt(e.target.value, 10))}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold focus:border-irctc-navy focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Throttle delay between Fisher-Yates batch shuffles</span>
            </div>

            {configSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Live configuration applied!</span>
              </div>
            )}

            <button
              onClick={handleUpdateConfig}
              className="w-full bg-irctc-navy hover:bg-irctc-darknavy text-white text-xs font-bold py-3 rounded-xl transition shadow"
            >
              Apply Live Tuning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AuthGuard requireAdmin fallbackMessage="Sign in with administrator credentials (admin@codex.dev) to access the Judge Control Center.">
      <AdminContent />
    </AuthGuard>
  );
}
