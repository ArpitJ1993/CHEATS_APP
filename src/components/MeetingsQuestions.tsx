import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Paper, Typography, Box, List, ListItem, ListItemText, Chip } from '@mui/material';
import { LoadingIndicator } from '../core-components/LoadingIndicator';
import { createVendorProvider } from '../vendors';

interface Question {
  id: string;
  text: string;
  source: 'microphone' | 'system';
  timestamp: string;
}

interface MeetingsQuestionsProps {
  enabled: boolean;
  onSelect?: (text: string) => void;
  resetCounter?: number;
}

export const MeetingsQuestions: React.FC<MeetingsQuestionsProps> = ({ enabled, onSelect, resetCounter }) => {
  const { settings } = useSelector((state: RootState) => state.settings);
  const micLabel = settings.userName?.trim() || 'Microphone';
  const sysLabel = settings.participantName?.trim() || 'System';
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const transcriptRef = useRef('');
  const lastProcessedLengthRef = useRef(0);
  const observerRef = useRef<MutationObserver | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const questionsMapRef = useRef<Map<string, Question>>(new Map());
  const vendorKey = settings.vendorKeys?.[settings.vendor] || '';
  const provider = useMemo(() => createVendorProvider(settings.vendor, vendorKey), [settings.vendor, vendorKey]);

  // Reset handler: when counter changes, clear questions state
  useEffect(() => {
    if (resetCounter === undefined) return;
    questionsMapRef.current.clear();
    setQuestions([]);
    lastProcessedLengthRef.current = 0;
  }, [resetCounter]);

  const validateQuestionsWithAI = useCallback(async () => {
    const transcript = transcriptRef.current;
    if (!transcript || transcript.length < 50) return;

    setIsProcessing(true);

    try {
      const messages = [
        {
          role: 'system' as const,
          content:
            'You are a question extraction specialist. Analyze the transcript and identify ALL questions. Be comprehensive - catch questions that end with "?", rhetorical questions, indirect questions, and clarification requests. Return ONLY valid JSON array: [{"q":"exact question text","s":"microphone" or "system"}]. No markdown, no explanation.'
        },
        {
          role: 'user' as const,
          content: `Transcript:\n${transcript}\n\nExtract all questions as JSON array:`
        }
      ];

      let response = '';
      await provider.streamText(
        messages,
        {
          onChunk: (chunk: string) => { response += chunk; },
          onComplete: () => {
            try {
              // Multiple JSON extraction attempts
              let extracted = null;

              // Try 1: Direct parse
              try {
                extracted = JSON.parse(response);
              } catch {
                // Try 2: Find JSON array in response
                const jsonMatch = response.match(/\[[\s\S]*?\]/);
                if (jsonMatch) {
                  extracted = JSON.parse(jsonMatch[0]);
                }
              }

              if (Array.isArray(extracted) && extracted.length > 0) {
                extracted.forEach((item: { q?: string; question?: string; s?: string; source?: string }) => {
                  const questionText = item.q || item.question;
                  const source = (item.s || item.source) === 'system' ? 'system' : 'microphone';

                  if (questionText && questionText.trim().length > 5) {
                    const questionId = `ai-${source}-${questionText.substring(0, 50)}`;

                    if (!questionsMapRef.current.has(questionId)) {
                      questionsMapRef.current.set(questionId, {
                        id: questionId,
                        text: questionText.trim(),
                        source,
                        timestamp: new Date().toLocaleTimeString()
                      });
                    }
                  }
                });

                setQuestions(Array.from(questionsMapRef.current.values()));
              }
            } catch (e) {
              console.warn('AI validation parse error', e);
            }
            setIsProcessing(false);
          },
          onError: () => setIsProcessing(false)
        }
      );
    } catch (err) {
      console.error('AI validation error', err);
      setIsProcessing(false);
    }
  }, [provider]);

  useEffect(() => {
    if (!enabled) return;
    const micEl = document.getElementById('micResults');
    const spkEl = document.getElementById('speakerResults');
    if (!micEl || !spkEl) return;

    const collect = () => {
      const micText = micEl.textContent || '';
      const spkText = spkEl.textContent || '';
      const fullTranscript = `MIC: ${micText}\n\nSYSTEM: ${spkText}`.trim();
      
      // Only process if there's new content
      if (fullTranscript.length > lastProcessedLengthRef.current) {
        transcriptRef.current = fullTranscript;
        
        lastProcessedLengthRef.current = fullTranscript.length;
        
        // Debounce AI validation for better accuracy (shorter debounce for responsiveness)
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          validateQuestionsWithAI();
        }, 800);
      }
    };

    collect();

    observerRef.current = new MutationObserver(collect);
    observerRef.current.observe(micEl, { childList: true, subtree: true, characterData: true });
    observerRef.current.observe(spkEl, { childList: true, subtree: true, characterData: true });

    return () => {
      observerRef.current?.disconnect();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    return () => {
      observerRef.current?.disconnect();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [enabled, validateQuestionsWithAI]);

  return (
    <Paper elevation={2} sx={{ p: 2, height: 'calc(100vh - 160px)', overflow: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <Typography variant="h6" gutterBottom sx={{ color: 'var(--color-text)', fontWeight: 600 }}>
        Questions
      </Typography>
      {isProcessing ? (
        <LoadingIndicator loading message="Extracting questions…" size="small" />
      ) : questions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
          No questions detected yet. Start streaming to capture questions.
        </Box>
      ) : (
        <List data-questions-list sx={{ 
          '& .MuiListItem-root:hover': { background: 'rgba(100, 149, 237, 0.08)' }
        }}>
          {questions.map((q) => (
            <ListItem 
              key={q.id} 
              sx={{ borderBottom: '1px solid', borderColor: 'divider', cursor: onSelect ? 'pointer' : 'default' }}
              onClick={() => onSelect?.(q.text)}
            >
              <ListItemText
                primary={q.text}
                secondary={
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                    <Chip 
                      label={q.source === 'microphone' ? `🎤 ${micLabel}` : `🔊 ${sysLabel}`} 
                      size="small" 
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {q.timestamp}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default MeetingsQuestions;

