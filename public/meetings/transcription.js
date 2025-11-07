import { appendTranscript, resetTranscriptArea } from './ui.js';

const state = {
  microphone: {
    sessionConfig: null,
    vadTime: 0
  },
  system: {
    sessionConfig: null,
    vadTime: 0
  }
};

export function handleMicrophoneMessage(parsed) {
  handleMessage(parsed, 'microphone');
}

export function handleSystemAudioMessage(parsed) {
  handleMessage(parsed, 'system');
}

function handleMessage(parsed, type) {
  const targetState = state[type];
  if (!targetState) return;

  let transcript = null;

  switch (parsed.type) {
    case 'transcription_session.created':
      targetState.sessionConfig = parsed.session;
      break;
    case 'input_audio_buffer.speech_started':
      transcript = {
        transcript: '...',
        partial: true
      };
      appendTranscript(type, transcript);
      break;
    case 'input_audio_buffer.speech_stopped':
      transcript = {
        transcript: '...',
        partial: true
      };
      appendTranscript(type, transcript);
      if (targetState.sessionConfig?.turn_detection?.silence_duration_ms) {
        targetState.vadTime = performance.now() - targetState.sessionConfig.turn_detection.silence_duration_ms;
      }
      break;
    case 'conversation.item.input_audio_transcription.completed':
      const elapsed = performance.now() - targetState.vadTime;
      transcript = {
        transcript: parsed.transcript,
        partial: false,
        latencyMs: elapsed.toFixed(0)
      };
      appendTranscript(type, transcript);
      break;
    default:
      break;
  }
}

export function resetTranscriptionState(type) {
  if (type === 'microphone' || !type) {
    state.microphone.sessionConfig = null;
    state.microphone.vadTime = 0;
    resetTranscriptArea('microphone');
  }
  if (type === 'system' || !type) {
    state.system.sessionConfig = null;
    state.system.vadTime = 0;
    resetTranscriptArea('system');
  }
}


