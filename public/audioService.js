
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const OpenAI = require('openai');
const { Blob, File } = require('node:buffer');

class AudioService {
  constructor() {
    this.recordingProcess = null;
    this.isRecording = false;
    this.audioBuffer = [];
    this.bufferSize = 0;
    this.maxBufferSize = 25 * 1024 * 1024; // 25MB max (OpenAI limit)
    
    const envKey = process.env.OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY;
    this.openai = envKey ? new OpenAI({ apiKey: envKey }) : null;
    this.apiKey = envKey || null;
  }

  setApiKey(key) {
    try {
      if (key && typeof key === 'string' && key.trim()) {
        this.apiKey = key.trim();
        this.openai = new OpenAI({ apiKey: this.apiKey });
        return { success: true };
      }
      return { success: false, error: 'Invalid API key' };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  async startRecording() {
    try {
      console.log('Starting streaming audio recording...');

      this.audioBuffer = [];
      this.bufferSize = 0;

      const platform = os.platform();
      let command, args;

      if (platform === 'darwin') {
        command = 'rec';
        args = ['-t', 'wav', '-r', '16000', '-c', '1', '-']; // 16kHz, mono, WAV format
      } else if (platform === 'linux') {
        command = 'arecord';
        args = ['-f', 'S16_LE', '-r', '16000', '-c', '1', '-']; // 16-bit signed little endian
      } else {
        command = 'powershell';
        args = ['-Command', 'Get-WmiObject -Class Win32_SoundDevice | Select-Object Name'];
      }

      this.recordingProcess = spawn(command, args);

      this.recordingProcess.stdout.on('data', (chunk) => {
        if (this.bufferSize + chunk.length <= this.maxBufferSize) {
          this.audioBuffer.push(chunk);
          this.bufferSize += chunk.length;
        } else {
          console.warn('Audio buffer size limit reached, stopping recording');
          this.stopRecording();
        }
      });

      this.recordingProcess.stderr.on('data', (data) => {
        console.log('Audio recording stderr:', data.toString());
      });

      this.recordingProcess.on('error', (error) => {
        console.error('Recording process error:', error);
        this.isRecording = false;
      });

      this.recordingProcess.on('exit', (code) => {
        console.log('Audio recording process exited with code:', code);
        if (this.isRecording) {
          this.isRecording = false;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      this.isRecording = true;
      console.log('Streaming audio recording started successfully');
      return { success: true, message: 'Recording started' };

    } catch (error) {
      console.error('Failed to start recording:', error);
      return { success: false, error: error.message };
    }
  }

  async stopRecording() {
    try {
      if (!this.recordingProcess && this.audioBuffer.length === 0) {
        throw new Error('No active recording session');
      }

      console.log('Stopping recording...');

      if (this.recordingProcess) {
        this.recordingProcess.kill('SIGTERM');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      this.recordingProcess = null;
      this.isRecording = false;

      if (this.audioBuffer.length === 0) {
        throw new Error('No audio data recorded');
      }

      console.log('Audio buffer size:', this.bufferSize, 'bytes');

      console.log('Starting transcription from memory...');
      const transcriptionResult = await this.transcribeAudioFromBuffer();
      
      this.audioBuffer = [];
      this.bufferSize = 0;

      return {
        success: true,
        message: 'Recording completed successfully',
        transcription: transcriptionResult
      };

    } catch (error) {
      console.error('Failed to stop recording:', error);

      this.audioBuffer = [];
      this.bufferSize = 0;
      this.isRecording = false;
      
      return { success: false, error: error.message };
    }
  }

  async cancelRecording() {
    try {
      if (this.recordingProcess) {
        this.recordingProcess.kill('SIGTERM');
        this.recordingProcess = null;
      }

      this.audioBuffer = [];
      this.bufferSize = 0;
      this.isRecording = false;

      console.log('Recording cancelled');
      return { success: true, message: 'Recording cancelled' };

    } catch (error) {
      console.error('Failed to cancel recording:', error);
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      isRecording: this.isRecording,
      bufferSize: this.bufferSize,
      platform: process.platform
    };
  }

  async transcribeAudioFromBuffer() {
    try {
      console.log('Starting OpenAI transcription from memory buffer...');
      
      if (this.audioBuffer.length === 0) {
        throw new Error('No audio data in buffer');
      }

      if (!this.openai) {
        throw new Error('OpenAI API key not set. Please set it in Settings or via environment variable.');
      }

      const audioData = Buffer.concat(this.audioBuffer);
      console.log('Audio data size:', audioData.length, 'bytes');

      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      
      const audioFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        response_format: "verbose_json",
        language: "en" // You can make this configurable
      });

      console.log('OpenAI transcription completed:', transcription.text);
      
      return {
        success: true,
        text: transcription.text,
        confidence: transcription.segments ? 
          transcription.segments.reduce((acc, seg) => acc + seg.avg_logprob, 0) / transcription.segments.length : 
          0.9, 
        duration: transcription.duration || (audioData.length / 32000) 
      };

    } catch (error) {
      console.error('OpenAI transcription failed:', error);
      
      let errorMessage = error.message;
      if (error && error.code === 'insufficient_quota') {
        errorMessage = 'OpenAI API quota exceeded. Please check your billing.';
      } else if (error && error.code === 'invalid_api_key') {
        errorMessage = 'Invalid OpenAI API key. Please check your API key.';
      } else if (error.message.includes('audio')) {
        errorMessage = 'Audio format not supported. Please ensure the audio is in a supported format.';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async transcribeAudioDirect(audioBuffer) {
    try {
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('No audio data provided');
      }

      if (!this.openai) {
        throw new Error('OpenAI API key not set. Please set it in Settings or via environment variable.');
      }

      const audioData = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);

      const audioBlob = new Blob([audioData], { type: 'audio/webm' });
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: 'en'
      });

      return {
        success: true,
        text: transcription.text,
        confidence: transcription.segments ?
          transcription.segments.reduce((acc, seg) => acc + seg.avg_logprob, 0) / transcription.segments.length : 0.9
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }

  

  async extractQuestionsFromRawAudio() {
    try {
      if (this.audioBuffer.length === 0) {
        throw new Error('No audio data in buffer');
      }

      if (!this.openai) {
        throw new Error('OpenAI API key not set. Please set it in Settings or via environment variable.');
      }

      const audioData = Buffer.concat(this.audioBuffer);
      const audioB64 = audioData.toString('base64');

      const systemPrompt = 'You are a question extraction specialist. Listen to the audio and identify ALL questions. Be comprehensive - catch questions that end with "?", rhetorical questions, indirect questions, and clarification requests. Return ONLY valid JSON array: [{"q":"exact question text","s":"microphone" or "system"}]. No markdown, no explanation.';

      const response = await this.openai.responses.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        input: [
          {
            role: 'system',
            content: [{ type: 'text', text: systemPrompt }]
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Audio follows. Extract questions as JSON array only.' },
              {
                type: 'input_audio',
                audio: {
                  data: audioB64,
                  format: 'wav'
                }
              }
            ]
          }
        ]
      });

      const textParts = (response.output || response).content || response.choices?.[0]?.message?.content || [];
      let contentText = '';
      if (Array.isArray(textParts)) {
        contentText = textParts
          .filter(p => p?.type === 'output_text' || p?.type === 'text')
          .map(p => p.text || '')
          .join('');
      } else if (typeof textParts === 'string') {
        contentText = textParts;
      }

      let parsed = [];
      try {
        parsed = JSON.parse(contentText);
      } catch (_) {
        const match = contentText.match(/\[[\s\S]*?\]/);
        if (match) parsed = JSON.parse(match[0]);
      }

      const questions = Array.isArray(parsed)
        ? parsed
            .map((item) => {
              const q = item?.q || item?.question;
              const s = (item?.s || item?.source) === 'system' ? 'system' : 'microphone';
              return q && String(q).trim().length > 5
                ? { q: String(q).trim(), s }
                : null;
            })
            .filter(Boolean)
        : [];

      return { success: true, questions };
    } catch (error) {
      console.error('extractQuestionsFromRawAudio error:', error);
      return { success: false, error: error?.message || String(error) };
    }
  }

  cleanup() {
    if (this.recordingProcess) {
      this.recordingProcess.stop();
      this.recordingProcess = null;
    }

    this.audioBuffer = [];
    this.bufferSize = 0;
    this.isRecording = false;
    
    console.log('Audio service cleaned up');
  }
}

module.exports = new AudioService();