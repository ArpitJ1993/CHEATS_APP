import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import styled from '@emotion/styled';
import { useDispatch } from 'react-redux';
import { setCurrentView } from '../slices/appSlice';
import { Button } from '../core-components/Button';
import { Box, Grid, Paper, Typography, FormControl, InputLabel, Select, Chip, Switch, FormControlLabel } from '@mui/material';
import MeetingsSummary from './MeetingsSummary';
import MeetingsQuestions from './MeetingsQuestions';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import ReactMarkdown from 'react-markdown';
import { LoadingIndicator } from '../core-components/LoadingIndicator';
import { createVendorProvider, getVendorMetadata } from '../vendors';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  color: var(--color-text);
  background: linear-gradient(180deg, rgba(0,0,0,0.03) 0%, transparent 100%), var(--color-background);
  overflow: auto;
`;

const Container = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 24px auto;
  padding: 0 16px;
`;

const Title = styled.h1`
  font-size: var(--font-size-large);
  margin: 16px 0;
  font-weight: 700;
  background: linear-gradient(90deg, #6aa0ff 0%, #9a6bff 50%, #ff6ab0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
`;

const StatusRow = styled.div`
  display: flex;
  gap: 12px;
  margin: 8px 0;
`;

const Status = styled.div`
  margin: 8px 0;
  padding: 4px 8px;
  font-size: 0.95em;
  border-radius: 4px;
  border: 1px solid var(--color-border);
`;

const Results = styled.pre`
  margin: 12px 0 24px 0;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  min-height: 140px;
  max-height: 240px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: monospace;
  font-size: 1em;
  white-space: pre-wrap;
  overflow-y: auto;
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(8, 10, 20, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
  z-index: 20;
`;

const OverlayContent = styled.div`
  background: rgba(20, 24, 35, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 32px;
  max-width: 520px;
  width: 90%;
  color: #fff;
  text-align: center;
  box-shadow: 0 20px 55px rgba(0, 0, 0, 0.4);
`;

const OverlayActions = styled.div`
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
`;

export const MeetingsPage: React.FC = () => {
  const dispatch = useDispatch();
  const { settings } = useSelector((state: RootState) => state.settings);

  const [questionsEnabled, setQuestionsEnabled] = React.useState(false);
  const [summaryEnabled, setSummaryEnabled] = React.useState(false);
  const [resetCounter, setResetCounter] = React.useState(0);
  const [inputText, setInputText] = React.useState('');
  const [resultText, setResultText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const vendorMetadata = useMemo(() => getVendorMetadata(settings.vendor), [settings.vendor]);
  const vendorKey = settings.vendorKeys?.[settings.vendor] || '';
  const provider = useMemo(() => createVendorProvider(settings.vendor, vendorKey), [settings.vendor, vendorKey]);

  const audioRequirementsMessage = useMemo(() => {
    if (!vendorMetadata.supportsMeetingsAudio) {
      return `${vendorMetadata.label} does not currently support meeting audio in this application.`;
    }
    if (!vendorKey) {
      return `Add a ${vendorMetadata.label} API key in Settings to enable meeting transcription.`;
    }
    return null;
  }, [vendorMetadata, vendorKey]);

  useEffect(() => {
    (window as any).__meetingsConfig = {
      vendorId: settings.vendor,
      vendorLabel: vendorMetadata.label,
      apiKey: vendorKey,
      supportsMeetingsAudio: vendorMetadata.supportsMeetingsAudio
    };

    return () => {
      delete (window as any).__meetingsConfig;
    };
  }, [settings.vendor, vendorMetadata.label, vendorMetadata.supportsMeetingsAudio, vendorKey]);

  useEffect(() => {
    const micResults = document.getElementById('micResults');
    const speakerResults = document.getElementById('speakerResults');
    if (micResults && micResults.textContent?.trim() === '') {
      micResults.textContent = 'Waiting for microphone input...';
    }
    if (speakerResults && speakerResults.textContent?.trim() === '') {
      speakerResults.textContent = 'Waiting for system audio...';
    }

    // Clear existing microphone options before re-initializing
    const micSelect = document.getElementById('micSelect') as HTMLSelectElement;
    if (micSelect) {
      micSelect.innerHTML = '';
    }

    const isDev = process.env.NODE_ENV === 'development' || process.env.REACT_APP_DEV === 'true';

    if (!vendorMetadata.supportsMeetingsAudio || !vendorKey) {
      return;
    }

    const script = document.createElement('script');
    script.src = isDev ? '/meetingsRenderer.js' : 'meetingsRenderer.js';
    script.type = 'module';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      try {
        (window as any).__meetingsRendererLoaded = false;
        if (script.parentNode) {
          document.body.removeChild(script);
        }
      } catch (e) {}
    };
  }, [vendorMetadata.supportsMeetingsAudio, vendorKey]);

  const handleQuestionSelect = (text: string) => {
    setInputText(text);
  };

  const handleReset = () => {
    // Clear input, result, questions only
    setInputText('');
    setResultText('');
    setResetCounter((c) => c + 1);
    // Do NOT clear summary here per requirements
  };

  const handleSubmit = useCallback(async () => {
    const q = inputText.trim();
    if (!q) return;

    if (!vendorKey) {
      setResultText(`Add your ${vendorMetadata.label} API key in Settings before submitting.`);
      return;
    }
    setIsSubmitting(true);
    setResultText('');
    let full = '';
    const messages = [
      { role: 'system' as const, content: 'You are a helpful assistant. Provide concise, accurate answers.' },
      { role: 'user' as const, content: q }
    ];
    try {
      await provider.streamText(messages, {
        onChunk: (chunk: string) => {
          full += chunk;
          setResultText(full);
        },
        onComplete: () => setIsSubmitting(false),
        onError: () => setIsSubmitting(false)
      });
    } catch (error) {
      console.error('Meeting answer generation failed:', error);
      setIsSubmitting(false);
    }
  }, [inputText, provider, vendorKey, vendorMetadata.label]);

  const handleExport = async () => {
    const mic = (document.getElementById('micResults')?.textContent || '').trim();
    const spk = (document.getElementById('speakerResults')?.textContent || '').trim();
    const questions = document.querySelectorAll('[data-questions-list] li');
    const questionTexts = Array.from(questions).map((li) => li.textContent || '').filter(Boolean);
    const lines: string[] = [];
    if (resultText.trim()) {
      lines.push('RESULT:\n' + resultText.trim());
    }
    const summaryEl = document.querySelector('[data-summary-text]');
    const summaryText = summaryEl ? summaryEl.textContent || '' : '';
    if (summaryText.trim()) {
      lines.push('SUMMARY:\n' + summaryText.trim());
    }
    if (questionTexts.length > 0) {
      lines.push('QUESTIONS:\n' + questionTexts.join('\n'));
    }
    const content = lines.join('\n\n');
    if (!content.trim()) return;
    try {
      const filename = `meeting_export_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      const res = await window.electronAPI?.saveFile(content, filename);
      // no-op on UI
    } catch {}
  };

  return (
    <Wrapper>
      {audioRequirementsMessage && (
        <Overlay>
          <OverlayContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#fff', fontWeight: 600 }}>
              Meeting audio unavailable for {vendorMetadata.label}
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 2 }}>
              {audioRequirementsMessage}
            </Typography>
            <OverlayActions>
              <Button variant="primary" onClick={() => dispatch(setCurrentView('main'))}>
                Go Back to Home
              </Button>
            </OverlayActions>
          </OverlayContent>
        </Overlay>
      )}
      <Container>
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={1} mb={1}>
          <Button variant="outlined" onClick={() => dispatch(setCurrentView('main'))}>⬅ Back</Button>
          <Box display="flex" gap={1} alignItems="center">
            <FormControlLabel control={<Switch checked={summaryEnabled} onChange={(e) => setSummaryEnabled(e.target.checked)} />} label="Summary" />
            <FormControlLabel control={<Switch checked={questionsEnabled} onChange={(e) => setQuestionsEnabled(e.target.checked)} />} label="Questions" />
          </Box>
        </Box>
        <Title style={{ color: 'var(--color-text)', letterSpacing: 0.3 }}>Meetings</Title>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper elevation={1} style={{ padding: 12 }}>
              <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                <button
                  id="startMicBtn"
                  type="button"
                  style={
                    {
                      padding: '6px 16px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: '#1976d2',
                      color: 'white',
                      cursor: 'default',
                      textTransform: 'uppercase',
                      boxShadow: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)'
                    }
                  }
                >
                  Start Microphone
                </button>
                <button
                  id="startSystemBtn"
                  type="button"
                  style={{
                    padding: '6px 16px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: '#388e3c',
                    color: 'white',
                    cursor: 'default',
                    textTransform: 'uppercase',
                    boxShadow: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)'
                  }}
                >
                  Start System Audio Capture
                </button>
                <button
                  id="stopBtn"
                  type="button"
                  disabled
                  style={{
                    padding: '5px 15px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: '1px solid rgba(25, 118, 210, 0.5)',
                    backgroundColor: 'transparent',
                    color: '#1976d2',
                    cursor: 'default',
                    textTransform: 'uppercase'
                  }}
                >
                  Stop All
                </button>
                {/* Hidden record button to preserve renderer references without exposing UI */}
                <button id="recordBtn" style={{ display: 'none' }}>Start Recording</button>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="micSelectLabel">Microphone</InputLabel>
                  <Select labelId="micSelectLabel" label="Microphone" native id="micSelect" />
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="modelSelectLabel">Model</InputLabel>
                  <Select labelId="modelSelectLabel" label="Model" native id="modelSelect">
                    <option value="whisper-1">whisper-1</option>
                    <option value="gpt-4o-transcribe">GPT-4o-transcribe</option>
                    <option value="gpt-4o-mini-transcribe">GPT-4o-mini-transcribe</option>
                  </Select>
                </FormControl>

                <Chip id="micStatus" label="Microphone: Disconnected" color="default" variant="outlined" />
                <Chip id="speakerStatus" label="System Audio: Disconnected" color="default" variant="outlined" />
                <Chip id="recordStatus" label="Recording: Stopped" color="default" variant="outlined" />
              </Box>
            </Paper>
          </Grid>

          {/* Keep transcript containers in DOM but hide them; renderer.js updates these IDs */}
          <Grid item xs={12} sx={{ display: 'none' }}>
            <div className="section">Microphone Transcription</div>
            <Results id="micResults">Waiting for microphone input...</Results>
            <div className="section">System Audio Transcription</div>
            <Results id="speakerResults">Waiting for system audio...</Results>
          </Grid>

          <Grid item xs={12} md={6}>
            <MeetingsSummary enabled={summaryEnabled} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <MeetingsQuestions enabled={questionsEnabled} onSelect={handleQuestionSelect} resetCounter={resetCounter} />
            <Paper elevation={2} style={{ padding: 12, marginTop: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'var(--color-text)' }}>Input</Typography>
              <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} style={{ width: '100%', minHeight: 100, borderRadius: 4, padding: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }} />
              <Box display="flex" gap={8} mt={1} />
            </Paper>
            <Paper elevation={2} style={{ padding: 12, marginTop: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'var(--color-text)' }}>Result</Typography>
              {isSubmitting ? (
                <LoadingIndicator loading message="Generating answer…" size="small" />
              ) : (
                <div style={{ color: 'var(--color-text)' }}>
                  <ReactMarkdown>{resultText || ''}</ReactMarkdown>
                </div>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Box display="flex" justifyContent="flex-end" alignItems="center" gap={8} mt={2} mb={1}>
          <button type="button" onClick={handleReset} style={{ padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'default', background: 'transparent', color: 'var(--color-text)' }}>Reset</button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || !inputText.trim()} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#1976d2', color: 'white', cursor: 'default', opacity: isSubmitting || !inputText.trim() ? 0.7 : 1 }}>Submit</button>
          <button type="button" onClick={handleExport} style={{ padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'default', background: 'transparent', color: 'var(--color-text)' }}>Export</button>
        </Box>
      </Container>
    </Wrapper>
  );
};

export default MeetingsPage;


