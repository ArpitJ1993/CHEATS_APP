import { dom } from './meetings/dom.js';
import { initializeUi, setMicrophoneButtonState, setSystemButtonState, setStopButtonEnabled, setModelDisabled, setRecordButtonEnabled, updateRecordStatus, showError } from './meetings/ui.js';
import { startMicrophoneCapture, startSystemCapture, stopAllCaptures, getActiveStreams } from './meetings/streams.js';
import { recorder } from './meetings/recorder.js';

if (window.__meetingsRendererLoaded) {
  console.debug('meetingsRenderer already loaded; skipping re-init');
} else {
  window.__meetingsRendererLoaded = true;
  initialize();
}

async function initialize() {
  initializeUi();
  await refreshMicrophoneOptions();
  attachEventListeners();

  if (navigator?.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', refreshMicrophoneOptions);
  }

  window.addEventListener('beforeunload', () => {
    stopAllCaptures().catch(() => {});
  });
}

function attachEventListeners() {
  const micBtn = dom.startMicBtn;
  const systemBtn = dom.startSystemBtn;
  const stopBtn = dom.stopBtn;
  const recordBtn = dom.recordBtn;

  micBtn?.addEventListener('click', async () => {
    try {
      await startMicrophoneCapture();
        } catch (error) {
      console.error('Microphone start failed:', error);
    }
  });

  systemBtn?.addEventListener('click', async () => {
    try {
      await startSystemCapture();
        } catch (error) {
      console.error('System audio start failed:', error);
    }
  });

  stopBtn?.addEventListener('click', async () => {
    await stopAllCaptures();
    setMicrophoneButtonState('idle');
    setSystemButtonState('idle');
    setStopButtonEnabled(false);
    setModelDisabled(false);
    setRecordButtonEnabled(false);
    updateRecordStatus(false);
  });

  if (recordBtn) {
    recordBtn.disabled = true;
    recordBtn.addEventListener('click', toggleRecording);
  }
}

async function refreshMicrophoneOptions() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const micSelect = dom.micSelect;
    if (!micSelect) return;

    const selected = micSelect.value;
            micSelect.innerHTML = '';

    devices
      .filter((device) => device.kind === 'audioinput')
      .forEach((device) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
        option.textContent = device.label || `Microphone (${device.deviceId})`;
                micSelect.appendChild(option);
      });

    if (selected) {
      micSelect.value = selected;
    }
  } catch (error) {
    console.error('Failed to enumerate audio devices:', error);
  }
}

async function toggleRecording() {
  if (recorder.isRecording) {
    recorder.stopRecording();
    updateRecordStatus(false);
        return;
    }

  const { microphone, system } = getActiveStreams();
  if (!microphone || !system) {
    showError('microphone', new Error('Start both microphone and system audio before recording.'));
        return;
    }

  try {
    await recorder.startRecording(microphone, system);
    updateRecordStatus(true);
    } catch (error) {
    console.error('Failed to start recording:', error);
    showError('microphone', error);
        updateRecordStatus(false);
    }
}

