import axios, { AxiosResponse } from 'axios';
import { OpenAIRequest, OpenAIMessage } from '../types';
import { APIError } from './index';

// Load environment variables
// Also support runtime-provided key from Electron preload (window.electronAPI.apiKey)
// so the app works in Electron without REACT_APP_ build-time injection
function getRuntimeApiKey(): string {
  try {
    if (typeof window === 'undefined') return '';
    const w = (window as unknown) as { electronAPI?: { apiKey?: string } };
    return w?.electronAPI?.apiKey || '';
  } catch {
    return '';
  }
}
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY || process.env.OPENAI_API_KEY || getRuntimeApiKey();
const OPENAI_API_BASE_URL = process.env.REACT_APP_OPENAI_API_BASE_URL || process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.REACT_APP_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4-turbo';
const OPENAI_MAX_TOKENS = parseInt(process.env.REACT_APP_OPENAI_MAX_TOKENS || process.env.OPENAI_MAX_TOKENS || '1000');
const OPENAI_TEMPERATURE = parseFloat(process.env.REACT_APP_OPENAI_TEMPERATURE || process.env.OPENAI_TEMPERATURE || '0.7');

class OpenAIService {
  private apiKey: string;
  private baseURL: string;
  private maxRetries: number = 3;

  constructor(apiKey?: string, baseURL?: string) {
    this.apiKey = apiKey || OPENAI_API_KEY || '';
    this.baseURL = baseURL || OPENAI_API_BASE_URL;
  }

  private resolveApiKey(): string {
    // Prefer instance key; fall back to runtime (preload) each call so packaged builds work
    let key = this.apiKey;
    if (!key && typeof window !== 'undefined') {
      try {
        const w = (window as unknown) as { electronAPI?: { apiKey?: string; getApiKey?: () => string } };
        key = w?.electronAPI?.getApiKey ? w.electronAPI.getApiKey() : (w?.electronAPI?.apiKey || '');
      } catch {}
    }
    if (!key) key = getRuntimeApiKey();
    return key;
  }

  private createHeaders() {
    const key = this.resolveApiKey();
    if (!key) {
      throw new APIError('MISSING_API_KEY', 'OpenAI API key not found. Please set it in Settings.');
    }
    return {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
  }

  async sendMessage(
    messages: OpenAIMessage[],
    onChunk?: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: APIError) => void
  ): Promise<string> {
    try {
      const request: OpenAIRequest = {
        model: OPENAI_MODEL,
        messages,
        stream: true,
        max_tokens: OPENAI_MAX_TOKENS,
        temperature: OPENAI_TEMPERATURE,
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new APIError(
          'API_ERROR',
          errorData.error?.message || 'API request failed',
          errorData
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new APIError('API_ERROR', 'Failed to get response reader');
      }

      let fullResponse = '';
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                onComplete?.();
                return fullResponse;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  onChunk?.(content);
                }
              } catch (e) {
                // Ignore parsing errors for incomplete chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      onComplete?.();
      return fullResponse;
    } catch (error) {
      const apiError = this.handleError(error);
      onError?.(apiError);
      throw apiError;
    }
  }

  async sendMessageWithImages(
    messages: OpenAIMessage[],
    images: string[], // base64 encoded images
    onChunk?: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: APIError) => void
  ): Promise<string> {
    try {
      // Convert images to OpenAI format
      const imageMessages = images.map(image => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:image/png;base64,${image}`,
          detail: 'high' as const,
        },
      }));

      // Create multimodal messages with images
      const multimodalMessages = messages.map(message => {
        if (message.role === 'user' && images.length > 0) {
          return {
            role: message.role,
            content: [
              {
                type: 'text' as const,
                text: message.content,
              },
              ...imageMessages,
            ],
          };
        }
        return message;
      });

      // Use GPT-4 Turbo for image analysis
      const request = {
        model: OPENAI_MODEL,
        messages: multimodalMessages,
        stream: true,
        max_tokens: OPENAI_MAX_TOKENS,
        temperature: OPENAI_TEMPERATURE,
      };


      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new APIError(
          'API_ERROR',
          errorData.error?.message || 'API request failed',
          errorData
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new APIError('API_ERROR', 'Failed to get response reader');
      }

      let fullResponse = '';
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                onComplete?.();
                return fullResponse;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  onChunk?.(content);
                }
              } catch (e) {
                // Ignore parsing errors for incomplete chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      onComplete?.();
      return fullResponse;
    } catch (error) {
      const apiError = this.handleError(error);
      onError?.(apiError);
      throw apiError;
    }
  }

  async sendAudioMessage(
    audioBlob: Blob,
    transcript: string,
    onChunk?: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: APIError) => void
  ): Promise<string> {
    try {
      // For now, we'll use the transcript text
      // In a real implementation, you might want to use Whisper API for audio transcription
      const messages: OpenAIMessage[] = [
        {
          role: 'user',
          content: transcript,
        },
      ];

      return this.sendMessage(messages, onChunk, onComplete, onError);
    } catch (error) {
      const apiError = this.handleError(error);
      onError?.(apiError);
      throw apiError;
    }
  }

  private handleError(error: any): APIError {
    if (error instanceof APIError) {
      return error;
    }

    if (error.response) {
      // API responded with error status
      return new APIError(
        'API_ERROR',
        error.response.data?.error?.message || 'API request failed',
        error.response.data
      );
    } else if (error.request) {
      // Network error
      return new APIError(
        'NETWORK_ERROR',
        'Network request failed. Please check your internet connection.',
        error.request
      );
    } else {
      // Other error
      return new APIError(
        'SYSTEM_ERROR',
        error.message || 'An unexpected error occurred',
        error
      );
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: this.createHeaders(),
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await axios.post(`${this.baseURL}/audio/transcriptions`, formData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.text;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: this.createHeaders(),
      });
      return response.data.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

export default OpenAIService;
