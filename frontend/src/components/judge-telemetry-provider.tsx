'use client';

import React, { useState } from 'react';
import JudgeDemoBar from './judge-demo-bar';
import TelemetryHud from './telemetry-hud';

export default function JudgeTelemetryProvider({ children }: { children: React.ReactNode }) {
  const [telemetryOpen, setTelemetryOpen] = useState(false);

  return (
    <>
      <JudgeDemoBar
        onToggleTelemetry={() => setTelemetryOpen(!telemetryOpen)}
        telemetryOpen={telemetryOpen}
      />
      {children}
      <TelemetryHud
        isOpen={telemetryOpen}
        onClose={() => setTelemetryOpen(false)}
      />
    </>
  );
}
