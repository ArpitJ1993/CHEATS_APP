import { dom } from './dom.js';

const STATUS_LABELS = {
  microphone: 'Microphone',
  system: 'System Audio'
};

export function initializeUi() {
  setMicrophoneButtonState('idle');
  setSystemButtonState('idle');
  setStopButtonEnabled(false);
  setModelDisabled(false);
  setRecordButtonEnabled(false);
  updateRecordStatus(false);
  updateStatus('microphone', false);
  updateStatus('system', false);
  resetTranscriptArea('microphone');
  resetTranscriptArea('system');
}

export function setMicrophoneButtonState(state) {
  const btn = dom.startMicBtn;
  if (!btn) return;
  switch (state) {
    case 'busy':
      btn.disabled = true;
      break;
    case 'running':
      btn.disabled = false;
      btn.textContent = 'Restart Microphone';
      break;
    default:
      btn.disabled = false;
      btn.textContent = 'Start Microphone';
  }
}

export function setSystemButtonState(state) {
  const btn = dom.startSystemBtn;
  if (!btn) return;
  switch (state) {
    case 'busy':
      btn.disabled = true;
      break;
    case 'running':
      btn.disabled = false;
      btn.textContent = 'Restart System Audio Capture';
      break;
    default:
      btn.disabled = false;
      btn.textContent = 'Start System Audio Capture';
  }
}

export function setStopButtonEnabled(enabled) {
  const btn = dom.stopBtn;
  if (btn) {
    btn.disabled = !enabled;
  }
}

export function setModelDisabled(disabled) {
  const select = dom.modelSelect;
  if (select) {
    select.disabled = disabled;
  }
}

export function updateStatus(type, isConnected) {
  const element = type === 'microphone' ? dom.micStatus : dom.speakerStatus;
  const label = STATUS_LABELS[type] || 'Audio';
  if (!element) return;

  if (isConnected) {
    element.textContent = `${label}: Connected`;
    element.className = 'status connected';
  } else {
    element.textContent = `${label}: Disconnected`;
    element.className = 'status disconnected';
  }
}

export function appendTranscript(type, transcript) {
  const target = type === 'microphone' ? dom.micResults : dom.speakerResults;
  if (!target) return;

  const text = transcript.transcript;
  if (!text) return;

  const timestamp = new Date().toLocaleTimeString();
  const prefix = transcript.partial ? '' : `[${timestamp}]`;

  target.textContent += `${prefix} ${text}\n`;
  target.scrollTop = target.scrollHeight;
  target.setAttribute('data-last-update', Date.now().toString());
}

export function resetTranscriptArea(type) {
  const target = type === 'microphone' ? dom.micResults : dom.speakerResults;
  if (!target) return;
  const timestamp = new Date().toLocaleTimeString();
  const waitingMessage = type === 'microphone'
    ? `[${timestamp}] Waiting for microphone input...\n`
    : `[${timestamp}] Waiting for system audio...\n`;
  target.textContent = waitingMessage;
  target.setAttribute('data-last-update', Date.now().toString());
}

export function showError(type, error) {
  const label = STATUS_LABELS[type] || 'Audio';
  const message = error?.message || String(error);
  alert(`Error (${label}): ${message}`);
}

export function updateRecordStatus(isRecording) {
  const recordStatus = dom.recordStatus;
  const recordBtn = dom.recordBtn;

  if (recordStatus) {
    if (isRecording) {
      recordStatus.textContent = 'Recording: Active';
      recordStatus.className = 'status connected';
    } else {
      recordStatus.textContent = 'Recording: Stopped';
      recordStatus.className = 'status disconnected';
    }
  }

  if (recordBtn) {
    recordBtn.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
  }
}

export function setRecordButtonEnabled(enabled) {
  const recordBtn = dom.recordBtn;
  if (recordBtn) {
    recordBtn.disabled = !enabled;
  }
  if (!enabled) {
    updateRecordStatus(false);
  }
}

export function setRecordButtonVisibility(visible) {
  const recordBtn = dom.recordBtn;
  if (recordBtn) {
    recordBtn.style.display = visible ? 'inline-block' : 'none';
  }
}


