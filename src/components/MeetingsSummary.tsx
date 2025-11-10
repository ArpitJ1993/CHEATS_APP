import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Paper, Typography, Box } from '@mui/material';
import { LoadingIndicator } from '../core-components/LoadingIndicator';
import { createVendorProvider, getVendorMetadata } from '../vendors';

interface MeetingsSummaryProps {
  enabled: boolean;
  resetCounter?: number;
  onClear?: () => void;
}

export const MeetingsSummary: React.FC<MeetingsSummaryProps> = ({ enabled, resetCounter, onClear }) => {
  const { settings } = useSelector((state: RootState) => state.settings);
  const [summary, setSummary] = useState('Waiting for meeting to start...');
  const [isStreaming, setIsStreaming] = useState(false);
  const transcriptRef = useRef('');
  const observerRef = useRef<MutationObserver | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightAbortRef = useRef<() => void>();
  const vendorKey = settings.vendorKeys?.[settings.vendor] || '';
  const provider = useMemo(() => createVendorProvider(settings.vendor, vendorKey), [settings.vendor, vendorKey]);

  const runSummary = useCallback(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;

    let cancelled = false;
    inFlightAbortRef.current = () => { cancelled = true; };
    setIsStreaming(true);

    let buffer = '';

    const callbacks = {
      onChunk: (chunk: string) => {
        if (cancelled) return;
        buffer += chunk;
        setSummary(buffer);
      },
      onComplete: () => {
        if (cancelled) return;
        setIsStreaming(false);
      },
      onError: () => {
        if (cancelled) return;
        setIsStreaming(false);
      }
    };

    const summaryMessages = [
      {
        role: 'system' as const,
        content: 'You are a real-time meeting summarizer. Produce concise summaries focused on key points, decisions, and action items.'
      },
      {
        role: 'user' as const,
        content: `Latest transcript chunk (append-only log, may contain duplicates):\n\n${transcript}\n\nReturn just the current best summary:`
      }
    ];

    const summaryPromise = provider.streamAudioSummary
      ? provider.streamAudioSummary({ transcript, callbacks })
      : provider.streamText(summaryMessages, callbacks);

    summaryPromise.catch(() => {
      if (cancelled) return;
      setIsStreaming(false);
    });
  }, [provider]);

  // Reset handler: clear only when resetCounter changes if we want to clear result but retain summary based on MeetingsPage logic
  useEffect(() => {
    if (resetCounter === undefined) return;
    // Intentionally do not clear summary here; MeetingsPage controls whether to clear
  }, [resetCounter]);

  useEffect(() => {
    if (!enabled) return;
    const micEl = document.getElementById('micResults');
    const spkEl = document.getElementById('speakerResults');
    if (!micEl || !spkEl) return;

    const collect = () => {
      const micText = micEl.textContent || '';
      const spkText = spkEl.textContent || '';
      transcriptRef.current = `${micText}\n${spkText}`.trim();
      // debounce summarization
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        runSummary();
      }, 1500);
    };

    // initial collect
    collect();

    observerRef.current = new MutationObserver(collect);
    observerRef.current.observe(micEl, { childList: true, subtree: true, characterData: true });
    observerRef.current.observe(spkEl, { childList: true, subtree: true, characterData: true });

    return () => {
      observerRef.current?.disconnect();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (inFlightAbortRef.current) inFlightAbortRef.current();
    };
  }, [enabled, runSummary]);

  return (
    <Paper elevation={2} sx={{ p: 2, height: 'calc(100vh - 160px)', overflow: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <Typography variant="h6" gutterBottom sx={{ color: 'var(--color-text)', fontWeight: 600 }}>
        Summary
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <button 
          type="button"
          onClick={() => setSummary('')}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'default', background: 'transparent', color: 'var(--color-text)' }}
        >
          Clear Summary
        </button>
      </Box>
      {isStreaming ? (
        <LoadingIndicator loading message="Summarizing…" size="small" />
      ) : (
        <Box component="div" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }} data-summary-text>
          {summary}
        </Box>
      )}
    </Paper>
  );
};

export default MeetingsSummary;


