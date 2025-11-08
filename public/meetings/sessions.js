import { handleMicrophoneMessage, handleSystemAudioMessage } from './transcription.js';
import { updateStatus } from './ui.js';

class Session {
  constructor(apiKey, streamType) {
    this.apiKey = apiKey;
    this.streamType = streamType;
    this.useSessionToken = true;
    this.ms = null;
    this.pc = null;
    this.dc = null;
    this.muted = false;
  }

  async start(stream, sessionConfig) {
    await this.startInternal(stream, sessionConfig, '/v1/realtime/sessions');
  }

  async startTranscription(stream, sessionConfig) {
    await this.startInternal(stream, sessionConfig, '/v1/realtime/transcription_sessions');
  }

  stop() {
    this.dc?.close();
    this.dc = null;
    this.pc?.close();
    this.pc = null;
    this.ms?.getTracks().forEach((t) => t.stop());
    this.ms = null;
    this.muted = false;
  }

  mute(muted) {
    this.muted = muted;
    this.pc?.getSenders().forEach((sender) => {
      sender.track.enabled = !muted;
    });
  }

  async startInternal(stream, sessionConfig, tokenEndpoint) {
    this.ms = stream;
    this.pc = new RTCPeerConnection();
    this.pc.ontrack = (e) => this.ontrack?.(e);
    const track = stream.getTracks()[0];
    if (track) {
      this.pc.addTrack(track);
    }
    this.pc.onconnectionstatechange = () => this.onconnectionstatechange?.(this.pc.connectionState);
    this.dc = this.pc.createDataChannel('');
    this.dc.onopen = () => this.onopen?.();
    this.dc.onmessage = (e) => this.onmessage?.(JSON.parse(e.data));

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    try {
      const answer = await this.signal(offer, sessionConfig, tokenEndpoint);
      await this.pc.setRemoteDescription(answer);
    } catch (e) {
      this.onerror?.(e);
      throw e;
    }
  }

  async signal(offer, sessionConfig, tokenEndpoint) {
    const urlRoot = 'https://api.openai.com';
    const realtimeUrl = `${urlRoot}/v1/realtime`;
    let sdpResponse;
    if (this.useSessionToken) {
      const sessionUrl = `${urlRoot}${tokenEndpoint}`;
      const sessionResponse = await fetch(sessionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'openai-beta': 'realtime-v1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionConfig)
      });
      if (!sessionResponse.ok) {
        throw new Error('Failed to request session token');
      }
      const sessionData = await sessionResponse.json();
      const clientSecret = sessionData.client_secret.value;
      sdpResponse = await fetch(`${realtimeUrl}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp'
        }
      });
      if (!sdpResponse.ok) {
        throw new Error('Failed to signal');
      }
    } else {
      const formData = new FormData();
      formData.append('session', JSON.stringify(sessionConfig));
      formData.append('sdp', offer.sdp);
      sdpResponse = await fetch(`${realtimeUrl}`, {
        method: 'POST',
        body: formData,
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      if (!sdpResponse.ok) {
        throw new Error('Failed to signal');
      }
    }
    return { type: 'answer', sdp: await sdpResponse.text() };
  }

  sendMessage(message) {
    this.dc?.send(JSON.stringify(message));
  }
}

export async function startSession({ type, stream, model, onError }) {
  const config = (window.__meetingsConfig || {});
  const vendorId = config.vendorId || 'openai';
  if (vendorId !== 'openai') {
    throw new Error(`${config.vendorLabel || 'Selected vendor'} does not support realtime meeting audio yet.`);
  }

  let apiKey = config.apiKey;
  if (!apiKey) {
    apiKey = window.electronAPI?.getVendorApiKey?.('openai') || window.electronAPI?.getApiKey?.() || window.electronAPI?.apiKey;
  }

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Add it in Settings.');
  }

  const session = new Session(apiKey, type === 'microphone' ? 'microphone' : 'system_audio');

  session.onconnectionstatechange = (state) => {
    updateStatus(type === 'microphone' ? 'microphone' : 'system', state === 'connected');
  };
  session.onmessage = type === 'microphone' ? handleMicrophoneMessage : handleSystemAudioMessage;
  session.onerror = (error) => {
    onError?.(error);
  };

  const sessionConfig = {
    input_audio_transcription: {
      model,
      prompt: ''
    },
    turn_detection: {
      type: 'server_vad',
      silence_duration_ms: 10
    }
  };

  await session.startTranscription(stream, sessionConfig);
  return session;
}

export function stopSession(session) {
  try {
    session?.stop();
  } catch (error) {
    console.error('Error stopping session:', error);
  }
}

export { Session };


