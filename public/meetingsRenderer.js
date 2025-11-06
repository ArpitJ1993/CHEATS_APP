
if (window.__meetingsRendererLoaded) {
  console.debug('meetingsRenderer already loaded; skipping re-init');
} else {
  window.__meetingsRendererLoaded = true;

function getCurrentApiKey() {
    try {
        if (window?.electronAPI?.getApiKey) {
            return window.electronAPI.getApiKey();
        }
        return window?.electronAPI?.apiKey || '';
    } catch { return ''; }
}

class Session {
    constructor(apiKey, streamType) {
        this.apiKey = apiKey; // initial snapshot
        this.streamType = streamType;
        this.useSessionToken = true;
        this.ms = null;
        this.pc = null;
        this.dc = null;
        this.muted = false;
    }

    async start(stream, sessionConfig) {
        await this.startInternal(stream, sessionConfig, "/v1/realtime/sessions");
    }

    async startTranscription(stream, sessionConfig) {
        await this.startInternal(stream, sessionConfig, "/v1/realtime/transcription_sessions");
    }

    stop() {
        this.dc?.close();
        this.dc = null;
        this.pc?.close();
        this.pc = null;
        this.ms?.getTracks().forEach(t => t.stop());
        this.ms = null;
        this.muted = false;
    }

    mute(muted) {
        this.muted = muted;
        this.pc.getSenders().forEach(sender => sender.track.enabled = !muted);
    }

    async startInternal(stream, sessionConfig, tokenEndpoint) {
        this.ms = stream;
        this.pc = new RTCPeerConnection();
        this.pc.ontrack = (e) => this.ontrack?.(e);
        this.pc.addTrack(stream.getTracks()[0]);
        this.pc.onconnectionstatechange = () => this.onconnectionstatechange?.(this.pc.connectionState);
        this.dc = this.pc.createDataChannel("");
        this.dc.onopen = (e) => this.onopen?.();
        this.dc.onmessage = (e) => this.onmessage?.(JSON.parse(e.data));

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        try {
            const answer = await this.signal(offer, sessionConfig, tokenEndpoint);
            await this.pc.setRemoteDescription(answer);
        } catch (e) {
            this.onerror?.(e);
        }
    }

    async signal(offer, sessionConfig, tokenEndpoint) {
        const urlRoot = "https://api.openai.com";
        const realtimeUrl = `${urlRoot}/v1/realtime`;
        let sdpResponse;
        if (this.useSessionToken) {
            const sessionUrl = `${urlRoot}${tokenEndpoint}`;
            const sessionResponse = await fetch(sessionUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${getCurrentApiKey()}`,
                    "openai-beta": "realtime-v1",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(sessionConfig),
            });
            if (!sessionResponse.ok) {
                throw new Error("Failed to request session token");
            }
            const sessionData = await sessionResponse.json();
            const clientSecret = sessionData.client_secret.value;
            sdpResponse = await fetch(`${realtimeUrl}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${clientSecret}`,
                    "Content-Type": "application/sdp"
                },
            });
            if (!sdpResponse.ok) {
                throw new Error("Failed to signal");
            }
        } else {
            const formData = new FormData();
            formData.append("session", JSON.stringify(sessionConfig));
            formData.append("sdp", offer.sdp);
            sdpResponse = await fetch(`${realtimeUrl}`, {
                method: "POST",
                body: formData,
                headers: { Authorization: `Bearer ${getCurrentApiKey()}` },
            });
            if (!sdpResponse.ok) {
                throw new Error("Failed to signal");
            }
        }
        return { type: "answer", sdp: await sdpResponse.text() };
    }

    sendMessage(message) {
        this.dc.send(JSON.stringify(message));
    }
}

class WavRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.combinedStream = null;
    }

    async startRecording(microphoneStream, systemAudioStream) {
        if (this.isRecording) return;

        try {
            const audioContext = new AudioContext();

            const micSource = audioContext.createMediaStreamSource(microphoneStream);
            const systemSource = audioContext.createMediaStreamSource(systemAudioStream);

            const merger = audioContext.createChannelMerger(2);

            micSource.connect(merger, 0, 0);
            systemSource.connect(merger, 0, 1);

            const destination = audioContext.createMediaStreamDestination();
            merger.connect(destination);

            this.combinedStream = destination.stream;

            this.mediaRecorder = new MediaRecorder(this.combinedStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];
            this.isRecording = true;

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };

            this.mediaRecorder.start(1000); // Collect data every second
            console.log('WAV recording started');

        } catch (error) {
            console.error('Error starting WAV recording:', error);
            throw error;
        }
    }

    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;

        this.mediaRecorder.stop();
        this.isRecording = false;
        console.log('WAV recording stopped');
    }

    async saveRecording() {
        if (this.audioChunks.length === 0) return;

        try {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const arrayBuffer = await audioBlob.arrayBuffer();

            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const wavBlob = this.audioBufferToWav(audioBuffer);

            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('WAV file saved');

        } catch (error) {
            console.error('Error saving WAV recording:', error);
        }
    }

    audioBufferToWav(buffer) {
        const length = buffer.length;
        const numberOfChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
        const view = new DataView(arrayBuffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * numberOfChannels * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numberOfChannels * 2, true);

        // Write audio data
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                view.setInt16(offset, sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
}

let microphoneSession = null;
let systemAudioSession = null;
let microphoneSessionConfig = null;
let systemAudioSessionConfig = null;
let microphoneVadTime = 0;
let systemAudioVadTime = 0;
let wavRecorder = new WavRecorder();
let microphoneStream = null;
let systemAudioStream = null;

// Helper functions to get DOM elements safely (re-query to avoid stale references)
// This ensures elements are found even if script loads before React renders
function getMicResults() {
    return document.getElementById('micResults');
}

function getSpeakerResults() {
    return document.getElementById('speakerResults');
}

function getMicStatus() {
    return document.getElementById('micStatus');
}

function getSpeakerStatus() {
    return document.getElementById('speakerStatus');
}

function getMicSelect() {
    return document.getElementById('micSelect');
}

function getRecordStatus() {
    return document.getElementById('recordStatus');
}

function getStartBtn() {
    return document.getElementById('startBtn');
}

function getStopBtn() {
    return document.getElementById('stopBtn');
}

function getRecordBtn() {
    return document.getElementById('recordBtn');
}

function getModelSelect() {
    return document.getElementById('modelSelect');
}

// Cache references for backward compatibility (will be set on DOM ready)
let micResults = null;
let speakerResults = null;
let micStatus = null;
let micSelect = null;
let speakerStatus = null;
let recordStatus = null;
let startBtn = null;
let stopBtn = null;
let recordBtn = null;
let modelSelect = null;

const CONFIG = {
    API_ENDPOINTS: {
        session: 'https://api.openai.com/v1/realtime/sessions',
        realtime: 'https://api.openai.com/v1/realtime'
    },
    VOICE: 'echo',
    VOICES: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'],
    INITIAL_MESSAGE: {
        text: "The transcription will probably be in English."
    }
};

function updateMicSelect() {
    navigator.mediaDevices.enumerateDevices().then(devices => {
        const micSelectEl = getMicSelect();
        if (micSelectEl) {
            micSelectEl.innerHTML = '';
        }
        devices.forEach(device => {
            if (device.kind === 'audioinput') {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label;
                if (micSelectEl) {
                    micSelectEl.appendChild(option);
                }
            }
        });
    });
}

function updateStatus(streamType, isConnected) {
    const statusElement = streamType === 'microphone' ? getMicStatus() : getSpeakerStatus();
    const label = streamType === 'microphone' ? 'Microphone' : 'System Audio';

    if (statusElement) {
        if (isConnected) {
            statusElement.textContent = `${label}: Connected`;
            statusElement.className = 'status connected';
        } else {
            statusElement.textContent = `${label}: Disconnected`;
            statusElement.className = 'status disconnected';
        }
    }
}

function handleMicrophoneMessage(parsed) {
    console.log('Received microphone message:', parsed);
    let transcript = null;

    switch (parsed.type) {
        case "transcription_session.created":
            microphoneSessionConfig = parsed.session;
            console.log("microphone session created: " + microphoneSessionConfig.id);
            break;
        case "input_audio_buffer.speech_started":
            transcript = {
                transcript: '...',
                partial: true,
            }
            handleMicrophoneTranscript(transcript);
            break;
        case "input_audio_buffer.speech_stopped":
            transcript = {
                transcript: '...',
                partial: true,
            }
            handleMicrophoneTranscript(transcript);
            microphoneVadTime = performance.now() - microphoneSessionConfig.turn_detection.silence_duration_ms;
            break;
        case "conversation.item.input_audio_transcription.completed":
            const elapsed = performance.now() - microphoneVadTime;
            transcript = {
                transcript: parsed.transcript,
                partial: false,
                latencyMs: elapsed.toFixed(0)
            }
            handleMicrophoneTranscript(transcript);
            break;
    }
}

function handleSystemAudioMessage(parsed) {
    console.log('Received system audio message:', parsed);
    let transcript = null;

    switch (parsed.type) {
        case "transcription_session.created":
            systemAudioSessionConfig = parsed.session;
            console.log("system audio session created: " + systemAudioSessionConfig.id);
            break;
        case "input_audio_buffer.speech_started":
            transcript = {
                transcript: '...',
                partial: true,
            }
            handleSystemAudioTranscript(transcript);
            break;
        case "input_audio_buffer.speech_stopped":
            transcript = {
                transcript: '...',
                partial: true,
            }
            handleSystemAudioTranscript(transcript);
            systemAudioVadTime = performance.now() - systemAudioSessionConfig.turn_detection.silence_duration_ms;
            break;
        case "conversation.item.input_audio_transcription.completed":
            const elapsed = performance.now() - systemAudioVadTime;
            transcript = {
                transcript: parsed.transcript,
                partial: false,
                latencyMs: elapsed.toFixed(0)
            }
            handleSystemAudioTranscript(transcript);
            break;
    }
}

function handleMicrophoneTranscript(transcript) {
    const text = transcript.transcript;
    if (!text) {
        return;
    }

    const micEl = getMicResults();
    if (!micEl) {
        console.warn('[meetingsRenderer] micResults element not found');
        return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const prefix = transcript.partial ? '' : `[${timestamp}]`;

    // Use textContent += to append, which triggers MutationObserver
    micEl.textContent += `${prefix} ${text}\n`;
    micEl.scrollTop = micEl.scrollHeight;
    
    // Force a mutation event by toggling a data attribute (ensures MutationObserver detects change)
    micEl.setAttribute('data-last-update', Date.now().toString());
}

function handleSystemAudioTranscript(transcript) {
    const text = transcript.transcript;
    if (!text) {
        return;
    }

    const spkEl = getSpeakerResults();
    if (!spkEl) {
        console.warn('[meetingsRenderer] speakerResults element not found');
        return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const prefix = transcript.partial ? '' : `[${timestamp}]`;

    // Use textContent += to append, which triggers MutationObserver
    spkEl.textContent += `${prefix} ${text}\n`;
    spkEl.scrollTop = spkEl.scrollHeight;
    
    // Force a mutation event by toggling a data attribute (ensures MutationObserver detects change)
    spkEl.setAttribute('data-last-update', Date.now().toString());
}

function handleError(e, streamType) {
    console.error(`${streamType} session error:`, e);
    alert(`Error (${streamType}): ` + e.message);
    stop();
}

/**
 * Platform detection utility
 * @returns {string} Platform identifier: 'windows', 'mac', or 'linux'
 */
function detectPlatform() {
    if (typeof navigator !== 'undefined' && navigator.platform) {
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('win')) return 'windows';
        if (platform.includes('mac')) return 'mac';
    }
    return 'linux';
}

/**
 * macOS-specific system audio capture (ORIGINAL IMPLEMENTATION - DO NOT MODIFY)
 * This function is kept exactly as it was to ensure macOS functionality remains unchanged
 */
async function captureSystemAudioMacOS() {
    await window.electronAPI.enableLoopbackAudio();

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {  
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        },
        video: true
    });

    await window.electronAPI.disableLoopbackAudio();

    const videoTracks = displayStream.getTracks().filter(t => t.kind === 'video');
    videoTracks.forEach(t => t.stop() && displayStream.removeTrack(t));

    return displayStream;
}

/**
 * Windows-specific system audio capture
 * Uses Windows-specific helper with retry logic and error handling
 */
async function captureSystemAudioWindows() {
    // Check if Windows audio capture helper is available
    if (!window.WindowsAudioCapture || !window.WindowsAudioCapture.captureWindowsSystemAudio) {
        throw new Error('Windows audio capture helper not loaded. Please ensure windowsAudioCapture.js is loaded before meetingsRenderer.js');
    }

    try {
        const displayStream = await window.WindowsAudioCapture.captureWindowsSystemAudio({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        return displayStream;
    } catch (error) {
        // Ensure cleanup on error
        if (window.WindowsAudioCapture && window.WindowsAudioCapture.disableLoopbackAudioSafe) {
            await window.WindowsAudioCapture.disableLoopbackAudioSafe();
        }
        throw error;
    }
}

/**
 * Platform-agnostic system audio capture
 * Routes to platform-specific implementation
 */
async function captureSystemAudio() {
    const platform = detectPlatform();
    console.log(`[Platform Detection] Detected platform: ${platform}`);

    if (platform === 'windows') {
        console.log('[Platform] Using Windows-specific audio capture');
        return await captureSystemAudioWindows();
    } else {
        // macOS and Linux use the original implementation
        console.log('[Platform] Using macOS/Linux audio capture (original implementation)');
        return await captureSystemAudioMacOS();
    }
}

async function start() {
    try {
        const startBtnEl = getStartBtn();
        const stopBtnEl = getStopBtn();
        const modelSelectEl = getModelSelect();
        const micSelectEl = getMicSelect();
        const recordBtnEl = getRecordBtn();

        if (!startBtnEl || !stopBtnEl || !modelSelectEl) {
            throw new Error('Required UI elements not found. Please refresh the page.');
        }

        startBtnEl.disabled = true;
        stopBtnEl.disabled = false;
        modelSelectEl.disabled = true;

        microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: micSelectEl && micSelectEl.value ? { exact: micSelectEl.value } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

        // Use platform-agnostic system audio capture
        systemAudioStream = await captureSystemAudio();

        microphoneSession = new Session(window.electronAPI.apiKey, 'microphone');
        microphoneSession.onconnectionstatechange = state => {
            console.log('Microphone connection state:', state);
            updateStatus('microphone', state === 'connected');
        };
        microphoneSession.onmessage = handleMicrophoneMessage;
        microphoneSession.onerror = (e) => handleError(e, 'microphone');

        systemAudioSession = new Session(window.electronAPI.apiKey, 'system_audio');
        systemAudioSession.onconnectionstatechange = state => {
            console.log('System audio connection state:', state);
            updateStatus('speaker', state === 'connected');
        };
        systemAudioSession.onmessage = handleSystemAudioMessage;
        systemAudioSession.onerror = (e) => handleError(e, 'system_audio');

        const sessionConfig = {
            input_audio_transcription: {
                model: modelSelectEl.value,
                prompt: "",
            },
            turn_detection: {
                type: "server_vad",
                silence_duration_ms: 10,
            }
        };

        await Promise.all([
            microphoneSession.startTranscription(microphoneStream, sessionConfig),
            systemAudioSession.startTranscription(systemAudioStream, sessionConfig)
        ]);

        if (recordBtnEl) {
            recordBtnEl.disabled = false;
        }
        console.log('Transcription started for both streams');

    } catch (error) {
        console.error('Error starting transcription:', error);
        alert('Error starting transcription: ' + error.message);
        stop();
    }
}

function stop() {
    const startBtnEl = getStartBtn();
    const stopBtnEl = getStopBtn();
    const recordBtnEl = getRecordBtn();
    const modelSelectEl = getModelSelect();
    const micEl = getMicResults();
    const spkEl = getSpeakerResults();

    if (startBtnEl) startBtnEl.disabled = false;
    if (stopBtnEl) stopBtnEl.disabled = true;
    if (recordBtnEl) recordBtnEl.disabled = true;
    if (modelSelectEl) modelSelectEl.disabled = false;

    if (wavRecorder.isRecording) {
        wavRecorder.stopRecording();
        updateRecordStatus(false);
    }

    microphoneSession?.stop();
    microphoneSession = null;
    microphoneSessionConfig = null;

    systemAudioSession?.stop();
    systemAudioSession = null;
    systemAudioSessionConfig = null;

    microphoneStream?.getTracks().forEach(t => t.stop());
    systemAudioStream?.getTracks().forEach(t => t.stop());
    microphoneStream = null;
    systemAudioStream = null;

    updateStatus('microphone', false);
    updateStatus('speaker', false);
    updateRecordStatus(false);

    const timestamp = new Date().toLocaleTimeString();
    if (micEl) {
        micEl.textContent = `[${timestamp}] Waiting for microphone input...\n`;
        micEl.setAttribute('data-last-update', Date.now().toString());
    }
    if (spkEl) {
        spkEl.textContent = `[${timestamp}] Waiting for system audio...\n`;
        spkEl.setAttribute('data-last-update', Date.now().toString());
    }
}

function updateRecordStatus(isRecording) {
    const recordStatusEl = getRecordStatus();
    const recordBtnEl = getRecordBtn();
    
    if (recordStatusEl) {
        if (isRecording) {
            recordStatusEl.textContent = 'Recording: Active';
            recordStatusEl.className = 'status connected';
        } else {
            recordStatusEl.textContent = 'Recording: Stopped';
            recordStatusEl.className = 'status disconnected';
        }
    }
    
    if (recordBtnEl) {
        recordBtnEl.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
    }
}

async function toggleRecording() {
    if (!wavRecorder.isRecording) {
        try {
            await wavRecorder.startRecording(microphoneStream, systemAudioStream);
            updateRecordStatus(true);
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Error starting recording: ' + error.message);
        }
    } else {
        wavRecorder.stopRecording();
        updateRecordStatus(false);
    }
}

// Initialize event listeners when DOM is ready
function initializeEventListeners() {
    const startBtnEl = getStartBtn();
    const stopBtnEl = getStopBtn();
    const recordBtnEl = getRecordBtn();
    
    if (startBtnEl && stopBtnEl && recordBtnEl) {
        startBtnEl.addEventListener('click', start);
        stopBtnEl.addEventListener('click', stop);
        recordBtnEl.addEventListener('click', toggleRecording);
        updateMicSelect();
    } else {
        // Retry if elements aren't ready yet
        setTimeout(initializeEventListeners, 100);
    }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEventListeners);
} else {
    initializeEventListeners();
}

window.addEventListener('beforeunload', stop);

}

