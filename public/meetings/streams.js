import { dom } from './dom.js';
import { setMicrophoneButtonState, setSystemButtonState, setStopButtonEnabled, setModelDisabled, setRecordButtonEnabled, updateRecordStatus, showError, updateStatus, resetTranscriptArea } from './ui.js';
import { startSession, stopSession } from './sessions.js';
import { recorder } from './recorder.js';
import { resetTranscriptionState } from './transcription.js';

const state = {
  microphone: {
    stream: null,
    session: null
  },
  system: {
    stream: null,
    session: null
  }
};

function getModelValue() {
  return dom.modelSelect?.value || 'whisper-1';
}

function getMeetingsConfig() {
  return window.__meetingsConfig || {};
}

function ensureVendorSupportsAudio() {
  const config = getMeetingsConfig();
  if (config.vendorId && config.vendorId !== 'openai') {
    throw new Error(`${config.vendorLabel || 'Selected vendor'} does not support realtime meeting audio yet.`);
  }
  if (!config.apiKey) {
    throw new Error('OpenAI API key not configured. Add it in Settings.');
  }
  return config;
}

export async function startMicrophoneCapture() {
  setMicrophoneButtonState('busy');

  try {
    ensureVendorSupportsAudio();
    if (state.microphone.session) {
      await stopMicrophoneCapture();
    }

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    };

    const micSelect = dom.micSelect;
    if (micSelect && micSelect.value) {
      constraints.audio.deviceId = { exact: micSelect.value };
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    const session = await startSession({
      type: 'microphone',
      stream,
      model: getModelValue(),
      onError: (error) => handleSessionError('microphone', error)
    });

    state.microphone.stream = stream;
    state.microphone.session = session;

    finalizeStart();
    setMicrophoneButtonState('running');
  } catch (error) {
    console.error('Failed to start microphone capture:', error);
    await stopMicrophoneCapture();
    setMicrophoneButtonState('idle');
    showError('microphone', error);
    throw error;
  }
}

export async function startSystemCapture() {
  setSystemButtonState('busy');
  let displayStream = null;

  try {
    ensureVendorSupportsAudio();
    if (state.system.session) {
      await stopSystemCapture();
    }

    await window.electronAPI.enableLoopbackAudio();
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true
    });
    await window.electronAPI.disableLoopbackAudio();

    const videoTracks = displayStream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.stop();
      displayStream.removeTrack(track);
    });

    const session = await startSession({
      type: 'system_audio',
      stream: displayStream,
      model: getModelValue(),
      onError: (error) => handleSessionError('system', error)
    });

    state.system.stream = displayStream;
    state.system.session = session;

    finalizeStart();
    setSystemButtonState('running');
  } catch (error) {
    console.error('Failed to start system audio capture:', error);
    displayStream?.getTracks().forEach((track) => track.stop());
    await window.electronAPI.disableLoopbackAudio().catch(() => {});
    await stopSystemCapture();
    setSystemButtonState('idle');
    showError('system', error);
    throw error;
  }
}

export async function stopAllCaptures() {
  await Promise.all([stopMicrophoneCapture(), stopSystemCapture()]);
  setMicrophoneButtonState('idle');
  setSystemButtonState('idle');
  setStopButtonEnabled(false);
  setModelDisabled(false);
  setRecordButtonEnabled(false);
  updateRecordStatus(false);
  resetTranscriptionState();
}

export async function stopMicrophoneCapture() {
  stopSession(state.microphone.session);
  state.microphone.session = null;

  state.microphone.stream?.getTracks().forEach((track) => track.stop());
  state.microphone.stream = null;

  updateStatus('microphone', false);
  resetTranscriptArea('microphone');
  resetTranscriptionState('microphone');
  updateRecordAvailability();
}

export async function stopSystemCapture() {
  stopSession(state.system.session);
  state.system.session = null;

  state.system.stream?.getTracks().forEach((track) => track.stop());
  state.system.stream = null;

  await window.electronAPI.disableLoopbackAudio().catch(() => {});
  updateStatus('system', false);
  resetTranscriptArea('system');
  resetTranscriptionState('system');
  updateRecordAvailability();
}

export function getActiveStreams() {
  return {
    microphone: state.microphone.stream,
    system: state.system.stream
  };
}

function finalizeStart() {
  updateRecordAvailability();
}

function handleSessionError(type, error) {
  console.error(`Session error (${type})`, error);
  showError(type, error);
  if (type === 'microphone') {
    stopMicrophoneCapture();
  } else {
    stopSystemCapture();
  }
}

function updateRecordAvailability() {
  const anyActive = Boolean(state.microphone.stream || state.system.stream);
  const canRecord = Boolean(state.microphone.stream && state.system.stream);

  setStopButtonEnabled(anyActive);
  setModelDisabled(anyActive);
  setRecordButtonEnabled(canRecord);
  if (!canRecord && recorder.isRecording) {
    recorder.stopRecording();
    updateRecordStatus(false);
  }
}


