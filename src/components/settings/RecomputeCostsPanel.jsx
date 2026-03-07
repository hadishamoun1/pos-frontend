import React, { useMemo, useState, useRef, useEffect } from 'react';
import { axiosClient } from '../api/axiosClient';

// ─── Phase definitions (must match backend emitProgress phase strings) ────────
const PHASES = [
  { key: 'scanning',  label: 'Scanning affected variants',   icon: '🔍' },
  { key: 'building',  label: 'Building event timeline',      icon: '📅' },
  { key: 'baseline',  label: 'Resetting baseline costs',     icon: '🔄' },
  { key: 'replaying', label: 'Replaying events',             icon: '⚙️'  },
  { key: 'snapshots', label: 'Refreshing cost snapshots',    icon: '📸' },
  { key: 'done',      label: 'Complete',                     icon: '✅' },
];

export default function RecomputeCostsPanel() {
  const todayStr = useMemo(() => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }, []);

  const [fromDate, setFromDate]   = useState(todayStr);
  const [jobState, setJobState]   = useState(null); // null = idle
  const [elapsed,  setElapsed]    = useState(0);

  const readerRef  = useRef(null); // ReadableStreamDefaultReader
  const timerRef   = useRef(null);
  const pollRef    = useRef(null); // fallback polling interval
  const jobIdRef   = useRef(null); // stored so polling can use it

  // Cleanup on unmount
  useEffect(() => () => stopAll(), []);

  const stopAll = () => {
    try { readerRef.current?.cancel(); } catch (_) {}
    readerRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
  };

  // Called when SSE drops — polls status endpoint until done/error
  const startPolling = (jobId) => {
    if (pollRef.current) return; // already polling
    setJobState((prev) => ({
      ...prev,
      message: (prev?.message || '') + ' (reconnecting...)',
    }));

    pollRef.current = setInterval(async () => {
      try {
        const res = await axiosClient.get(`/recompute/status/${jobId}`);
        const data = res.data;

        if (data.status === 'done') {
          stopAll();
          setJobState({
            status: 'done',
            phase: 'done',
            current: 1,
            total: 1,
            message: 'Complete!',
            result: data.result,
          });
        } else if (data.status === 'error') {
          stopAll();
          setJobState({
            status: 'error',
            phase: data.progress?.phase || 'snapshots',
            current: 0,
            total: 0,
            message: data.error || 'Unknown error',
          });
        } else if (data.progress) {
          // still running — update phase display from last known progress
          setJobState((prev) => ({
            ...prev,
            ...data.progress,
            status: 'running',
          }));
        }
      } catch (_) {
        // network still down — keep polling silently
      }
    }, 3000);
  };

  const runRecompute = async () => {
    stopAll();
    setElapsed(0);
    setJobState({ status: 'starting', phase: 'scanning', current: 0, total: 0, message: 'Starting job...' });

    try {
      // 1. POST to start job → get jobId back immediately
      const res = await axiosClient.post('/recompute/recompute-costs', { fromDate });
      const { jobId } = res.data;
      jobIdRef.current = jobId;

      // 2. Start elapsed timer
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

      // 3. Connect to SSE stream via fetch (EventSource doesn't support auth headers)
      const baseURL = (axiosClient.defaults.baseURL || '').replace(/\/$/, '');
      const token   =
        localStorage.getItem('token') ||
        sessionStorage.getItem('token') ||
        '';

      const response = await fetch(`${baseURL}/recompute/progress/${jobId}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) throw new Error(`SSE connect failed: ${response.status}`);

      const reader  = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let   buffer  = '';

      // 4. Read stream
      const read = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              setJobState(event);

              if (event.status === 'done' || event.status === 'error') {
                stopAll();
                return;
              }
            } catch (_) {}
          }
        }
        stopAll();
        // Stream ended without a 'done' event — backend may still be running
        if (jobIdRef.current) startPolling(jobIdRef.current);
      };

      read().catch((err) => {
        if (err?.name === 'AbortError') return; // user cancelled
        // ⚠️ SSE stream dropped but backend may still be running — fall back to polling
        if (jobIdRef.current) startPolling(jobIdRef.current);
      });

    } catch (err) {
      stopAll();
      setJobState({
        status: 'error',
        phase: 'scanning',
        current: 0,
        total: 0,
        message:
          err?.response?.data?.message ||
          err?.message ||
          'Failed to start recompute',
      });
    }
  };

  // ─── Derived state ─────────────────────────────────────────────────────────
  const isIdle    = !jobState;
  const isRunning = jobState?.status === 'running' || jobState?.status === 'starting';
  const isDone    = jobState?.status === 'done';
  const isError   = jobState?.status === 'error';

  const currentPhaseIdx = jobState ? PHASES.findIndex((p) => p.key === jobState.phase) : -1;

  const subPct = (phase) =>
    jobState?.phase === phase && jobState.total > 0
      ? Math.round((jobState.current / jobState.total) * 100)
      : 0;

  const replayPct   = isDone ? 100 : subPct('replaying');
  const snapshotPct = isDone ? 100 : subPct('snapshots');

  // Overall progress — replaying and snapshots use sub-progress
  const totalPhases     = PHASES.length - 1;
  const phaseSubPct = jobState?.phase === 'replaying' ? replayPct / 100
                    : jobState?.phase === 'snapshots'  ? snapshotPct / 100
                    : 0;
  const overallProgress = isDone
    ? 100
    : currentPhaseIdx < 0
    ? 0
    : Math.round(((currentPhaseIdx + phaseSubPct) / totalPhases) * 100);

  // ─── Styles ────────────────────────────────────────────────────────────────
  const s = {
    wrap: {
      padding: 24,
      maxWidth: 620,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: '#1e293b',
    },
    heading: {
      margin: '0 0 20px',
      fontSize: 18,
      fontWeight: 700,
      color: '#0f172a',
    },
    row: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-end',
      marginBottom: 20,
      flexWrap: 'wrap',
    },
    col: { display: 'flex', flexDirection: 'column', gap: 4 },
    label: { fontSize: 12, color: '#64748b', fontWeight: 500 },
    input: {
      height: 38,
      padding: '0 12px',
      borderRadius: 8,
      border: '1px solid #cbd5e1',
      fontSize: 14,
      color: '#1e293b',
      outline: 'none',
    },
    btn: (color) => ({
      height: 38,
      padding: '0 20px',
      borderRadius: 8,
      border: 'none',
      fontSize: 14,
      fontWeight: 600,
      cursor: isRunning ? 'not-allowed' : 'pointer',
      background: color,
      color: 'white',
      transition: 'opacity 0.2s',
      opacity: isRunning ? 0.75 : 1,
      whiteSpace: 'nowrap',
    }),
    cancelBtn: {
      height: 38,
      padding: '0 16px',
      borderRadius: 8,
      border: '1px solid #e2e8f0',
      background: 'white',
      color: '#64748b',
      cursor: 'pointer',
      fontSize: 13,
    },
    panel: {
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 14,
      padding: 20,
      marginTop: 4,
    },
    overallBar: {
      height: 8,
      background: '#e2e8f0',
      borderRadius: 999,
      overflow: 'hidden',
      marginBottom: 20,
    },
    overallFill: {
      height: '100%',
      borderRadius: 999,
      width: `${overallProgress}%`,
      background: isError
        ? '#ef4444'
        : isDone
        ? '#22c55e'
        : 'linear-gradient(90deg, #3b82f6, #818cf8)',
      transition: 'width 0.5s ease',
    },
    phaseRow: (isPast, isCurrent, isFuture) => ({
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '8px 0',
      opacity: isFuture ? 0.45 : 1,
      transition: 'opacity 0.3s',
    }),
    stepDot: (isPast, isCurrent) => ({
      width: 30,
      height: 30,
      borderRadius: '50%',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 700,
      background: isPast ? '#22c55e' : isCurrent ? '#3b82f6' : '#e2e8f0',
      color: isPast || isCurrent ? 'white' : '#94a3b8',
      boxShadow: isCurrent ? '0 0 0 4px rgba(59,130,246,0.18)' : 'none',
      transition: 'all 0.35s',
    }),
    phaseLabel: (isCurrent) => ({
      fontSize: 13,
      fontWeight: isCurrent ? 600 : 500,
      color: isCurrent ? '#1d4ed8' : '#374151',
      lineHeight: 1.4,
    }),
    phaseMsg: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2,
    },
    subBarWrap: { marginTop: 6 },
    subBarMeta: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 11,
      color: '#64748b',
      marginBottom: 4,
    },
    subBar: {
      height: 5,
      background: '#e2e8f0',
      borderRadius: 999,
      overflow: 'hidden',
    },
    subFill: {
      height: '100%',
      borderRadius: 999,
      width: `${replayPct}%`,
      background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
      transition: 'width 0.4s ease',
    },
    resultBox: (ok) => ({
      marginTop: 14,
      padding: '10px 14px',
      borderRadius: 8,
      background: ok ? '#f0fdf4' : '#fef2f2',
      border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`,
      color: ok ? '#166534' : '#991b1b',
      fontSize: 13,
      lineHeight: 1.6,
    }),
  };

  const btnColor = isRunning ? '#94a3b8' : isDone ? '#22c55e' : isError ? '#ef4444' : '#3b82f6';
  const btnLabel = isRunning
    ? `⏳ Running... ${elapsed}s`
    : isDone
    ? '✅ Done — Run Again'
    : isError
    ? '❌ Retry'
    : '▶ Run Recompute';

  return (
    <div style={s.wrap}>
      <h2 style={s.heading}>Cost Recompute</h2>

      {/* Controls */}
      <div style={s.row}>
        <div style={s.col}>
          <span style={s.label}>Recompute from date</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            disabled={isRunning}
            style={s.input}
          />
        </div>

        <button onClick={isRunning ? undefined : runRecompute} disabled={isRunning || !fromDate} style={s.btn(btnColor)}>
          {btnLabel}
        </button>

        {isRunning && (
          <button
            style={s.cancelBtn}
            onClick={() => {
              stopAll();
              setJobState((prev) => ({ ...prev, status: 'error', message: 'Cancelled by user' }));
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress panel */}
      {jobState && (
        <div style={s.panel}>

          {/* Overall progress bar */}
          <div style={s.overallBar}>
            <div style={s.overallFill} />
          </div>

          {/* Phase steps */}
          {PHASES.map((phase, idx) => {
            const isPast    = idx < currentPhaseIdx;
            const isCurrent = idx === currentPhaseIdx;
            const isFuture  = idx > currentPhaseIdx;

            return (
              <div key={phase.key} style={s.phaseRow(isPast, isCurrent, isFuture)}>
                {/* Circle */}
                <div style={s.stepDot(isPast, isCurrent)}>
                  {isPast ? '✓' : phase.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div style={s.phaseLabel(isCurrent)}>{phase.label}</div>

                  {isCurrent && jobState.message && (
                    <div style={s.phaseMsg}>{jobState.message}</div>
                  )}

                  {/* Sub-progress bar for replaying phase */}
                  {isCurrent && phase.key === 'replaying' && jobState.total > 0 && (
                    <div style={s.subBarWrap}>
                      <div style={s.subBarMeta}>
                        <span>{jobState.current} / {jobState.total} events</span>
                        <span>{replayPct}%</span>
                      </div>
                      <div style={s.subBar}>
                        <div style={{ ...s.subFill, width: `${replayPct}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Sub-progress bar for snapshots phase */}
                  {isCurrent && phase.key === 'snapshots' && jobState.total > 0 && (
                    <div style={s.subBarWrap}>
                      <div style={s.subBarMeta}>
                        <span>{jobState.current} / {jobState.total} invoices</span>
                        <span>{snapshotPct}%</span>
                      </div>
                      <div style={s.subBar}>
                        <div style={{ ...s.subFill, width: `${snapshotPct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Error box */}
          {isError && (
            <div style={s.resultBox(false)}>
              ❌ <strong>Error:</strong> {jobState.message}
            </div>
          )}

          {/* Done summary */}
          {isDone && jobState.result && (
            <div style={s.resultBox(true)}>
              ✅ <strong>Completed in {elapsed}s</strong>
              <br />
              Variants affected: <strong>{jobState.result.affectedVariants}</strong>
              &nbsp;·&nbsp;
              Total events: <strong>{jobState.result.events}</strong>
              <br />
              Purchases recomputed: <strong>{jobState.result.purchasesDone}</strong>
              &nbsp;·&nbsp;
              Transfers recomputed: <strong>{jobState.result.transfersDone}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}