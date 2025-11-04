
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

const micResults = document.getElementById('micResults');
const speakerResults = document.getElementById('speakerResults');
const micStatus = document.getElementById('micStatus');
const micSelect = document.getElementById('micSelect');
const speakerStatus = document.getElementById('speakerStatus');
const recordStatus = document.getElementById('recordStatus');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const recordBtn = document.getElementById('recordBtn');
const modelSelect = document.getElementById('modelSelect');

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
        if (micSelect) {
            micSelect.innerHTML = '';
        }
        devices.forEach(device => {
            if (device.kind === 'audioinput') {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label;
                micSelect.appendChild(option);
            }
        });
    });
}

function updateStatus(streamType, isConnected) {
    const statusElement = streamType === 'microphone' ? micStatus : speakerStatus;
    const label = streamType === 'microphone' ? 'Microphone' : 'System Audio';

    if (isConnected) {
        statusElement.textContent = `${label}: Connected`;
        statusElement.className = 'status connected';
    } else {
        statusElement.textContent = `${label}: Disconnected`;
        statusElement.className = 'status disconnected';
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

    const timestamp = new Date().toLocaleTimeString();
    const prefix = transcript.partial ? '' : `[${timestamp}]`;

    micResults.textContent += `${prefix} ${text}\n`;
    micResults.scrollTop = micResults.scrollHeight;
}

function handleSystemAudioTranscript(transcript) {
    const text = transcript.transcript;
    if (!text) {
        return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const prefix = transcript.partial ? '' : `[${timestamp}]`;

    speakerResults.textContent += `${prefix} ${text}\n`;
    speakerResults.scrollTop = speakerResults.scrollHeight;
}

function handleError(e, streamType) {
    console.error(`${streamType} session error:`, e);
    alert(`Error (${streamType}): ` + e.message);
    stop();
}

async function start() {
    try {
       

        startBtn.disabled = true;
        stopBtn.disabled = false;
        modelSelect.disabled = true;

        microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: micSelect && micSelect.value ? { exact: micSelect.value } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

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

        systemAudioStream = displayStream;

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
                model: modelSelect.value,
                prompt: "",
            },
            turn_detection: {
                type: "server_vad",
                silence_duration_ms: 10,
            }
        };

        await Promise.all([
            microphoneSession.startTranscription(microphoneStream, sessionConfig),
            systemAudioSession.startTranscription(displayStream, sessionConfig)
        ]);

        recordBtn.disabled = false;
        console.log('Transcription started for both streams');

    } catch (error) {
        console.error('Error starting transcription:', error);
        alert('Error starting transcription: ' + error.message);
        stop();
    }
}

function stop() {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    recordBtn.disabled = true;
    modelSelect.disabled = false;

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
    micResults.textContent = `[${timestamp}] Waiting for microphone input...\n`;
    speakerResults.textContent = `[${timestamp}] Waiting for system audio...\n`;
}

function updateRecordStatus(isRecording) {
    if (isRecording) {
        recordStatus.textContent = 'Recording: Active';
        recordStatus.className = 'status connected';
        recordBtn.textContent = 'Stop Recording';
    } else {
        recordStatus.textContent = 'Recording: Stopped';
        recordStatus.className = 'status disconnected';
        recordBtn.textContent = 'Start Recording';
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

if (startBtn && stopBtn && recordBtn) {
    startBtn.addEventListener('click', start);
    stopBtn.addEventListener('click', stop);
    recordBtn.addEventListener('click', toggleRecording);
}
updateMicSelect();

window.addEventListener('beforeunload', stop);

}

