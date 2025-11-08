import { APIError } from '../../data';
import { VendorProvider, VendorId, VendorMessage, StreamCallbacks, AudioSummaryParams } from '../types';
import { VENDOR_METADATA } from '../metadata';
import { resolveGeminiModel, invalidateGeminiModelCache } from '../model-resolver/geminiModelResolver';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const IMAGE_BASE_OUTPUT_TOKENS = 4096;
const IMAGE_PER_IMAGE_BONUS = 1024;
const MAX_OUTPUT_TOKEN_CEILING = 8192;

export class GeminiProvider implements VendorProvider {
  public readonly id: VendorId = 'gemini';
  public readonly supportsImages = VENDOR_METADATA.gemini.supportsImages;
  public readonly supportsMeetingsAudio = VENDOR_METADATA.gemini.supportsMeetingsAudio;
  private readonly apiKey?: string;
  private modelPromise: Promise<string>;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
    this.modelPromise = resolveGeminiModel(apiKey, VENDOR_METADATA.gemini.defaultModel);
  }

  private ensureApiKey() {
    if (!this.apiKey) {
      throw new APIError('MISSING_API_KEY', 'Google Gemini API key not configured.');
    }
  }

  async streamText(messages: VendorMessage[], callbacks: StreamCallbacks): Promise<string> {
    this.ensureApiKey();
    return this.streamWithRetry(async () => {
      const model = await this.modelPromise;
      const modelPath = model.startsWith('models/') ? model : `models/${model}`;
      const body = this.buildRequest(messages, [], DEFAULT_MAX_OUTPUT_TOKENS);
      return this.streamRequest(modelPath, body, callbacks);
    });
  }

  async streamMultimodal(messages: VendorMessage[], images: string[], callbacks: StreamCallbacks): Promise<string> {
    if (!this.supportsImages) {
      throw new APIError('UNSUPPORTED', 'Gemini provider does not currently support image inputs in this application.');
    }
    this.ensureApiKey();
    return this.streamWithRetry(async () => {
      const model = await this.modelPromise;
      const modelPath = model.startsWith('models/') ? model : `models/${model}`;
      const imageCount = Math.max(0, images.length);
      const baseMaxTokens = imageCount
        ? Math.min(
            MAX_OUTPUT_TOKEN_CEILING,
            IMAGE_BASE_OUTPUT_TOKENS + Math.max(0, imageCount - 1) * IMAGE_PER_IMAGE_BONUS
          )
        : DEFAULT_MAX_OUTPUT_TOKENS;
      const body = this.buildRequest(messages, images, baseMaxTokens);
      const fallbackMaxTokens = Math.min(MAX_OUTPUT_TOKEN_CEILING, baseMaxTokens * 2);

      return this.streamRequest(modelPath, body, callbacks, {
        onMaxTokens: async (existingText, _lastPayload) => {
          if (existingText.trim()) {
            callbacks.onComplete?.();
            return existingText;
          }

          if (fallbackMaxTokens <= baseMaxTokens) {
            callbacks.onComplete?.();
            return existingText;
          }

          const retryBody = this.buildRequest(messages, images, fallbackMaxTokens);
          const payload = await this.generateContent(modelPath, retryBody);
          const text = extractGeminiText(payload);
          if (text) {
            callbacks.onChunk?.(text);
          }
          callbacks.onComplete?.();
          return text || existingText;
        },
        onEmptyResult: async () => {
          const retryBody = this.buildRequest(messages, images, Math.min(MAX_OUTPUT_TOKEN_CEILING, fallbackMaxTokens));
          const payload = await this.generateContent(modelPath, retryBody);
          const text = extractGeminiText(payload);
          return text || null;
        }
      });
    });
  }

  async streamAudioSummary(params: AudioSummaryParams): Promise<string> {
    const { transcript, callbacks } = params;
    return this.streamText(
      [
        {
          role: 'system',
          content: 'You are a real-time meeting summarizer. Produce concise rolling summaries focusing on decisions, action items, and key points.'
        },
        {
          role: 'user',
          content: transcript
        }
      ],
      callbacks
    );
  }

  private buildRequest(messages: VendorMessage[], images: string[] = [], maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS) {
    let systemInstruction = '';
    const contents: any[] = [];
    let imagesConsumed = false;

    messages.forEach((message) => {
      if (message.role === 'system') {
        systemInstruction += `${message.content}\n\n`;
        return;
      }
      const role = message.role === 'assistant' ? 'model' : 'user';
      const parts = this.buildPartsForMessage(message, imagesConsumed ? [] : images, messages);
      if (!imagesConsumed && message.role === 'user' && parts.some((part) => part.inlineData)) {
        imagesConsumed = true;
      }
      if (parts.length) {
        contents.push({ role, parts });
      }
    });

    const payload: any = { contents };
    if (images.length > 1) {
      systemInstruction += 'Consider every user-provided image together before answering.\n\n';
    }
    if (systemInstruction.trim()) {
      payload.systemInstruction = {
        role: 'system',
        parts: [{ text: systemInstruction.trim() }]
      };
    }

    payload.generationConfig = {
      temperature: 0.7,
      maxOutputTokens: maxOutputTokens
    };

    return payload;
  }

  private buildPartsForMessage(message: VendorMessage, images: string[], allMessages: VendorMessage[]): any[] {
    const isLastUserMessage =
      message.role === 'user' && allMessages[allMessages.length - 1] === message && images.length > 0;

    if (!isLastUserMessage) {
      return message.content ? [{ text: message.content }] : [];
    }

    const question = message.content?.trim() || '';
    const parts: any[] = [];

    images.forEach((image) => {
      const { data, mimeType } = normalizeInlineImage(image);
      if (data) {
        parts.push({ inlineData: { data, mimeType } });
      }
    });

    const promptText = question
      ? `${question}\n\nPlease use every image above when responding.`
      : 'Please analyze all of the images above when responding.';
    parts.push({ text: promptText });

    return parts;
  }

  private async streamRequest(
    modelPath: string,
    body: any,
    callbacks: StreamCallbacks,
    options?: {
      onMaxTokens?: (existingText: string, lastPayload: any | null) => Promise<string>;
      onEmptyResult?: () => Promise<string | null>;
    }
  ): Promise<string> {
    const streamUrl = `${GEMINI_API_BASE}/${modelPath}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const response = await fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new APIError('API_ERROR', `Gemini request failed: ${response.status}`, errorText);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    let full = '';
    let lastParsed: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';

      for (const event of events) {
        const parsed = parseGeminiStreamEvent(event);
        if (!parsed) continue;
        lastParsed = parsed;
        const text = extractGeminiText(parsed);
        if (text) {
          full += text;
          callbacks.onChunk?.(text);
        }
      }
    }

    const leftover = parseGeminiStreamEvent(buffer);
    if (leftover) {
      lastParsed = leftover;
      const text = extractGeminiText(leftover);
      if (text) {
        full += text;
        callbacks.onChunk?.(text);
      }
    }

    if (!full.trim() && lastParsed) {
      const text = extractGeminiText(lastParsed);
      if (text) {
        full = text;
        callbacks.onChunk?.(text);
      }
    }

    if (!full.trim()) {
      const fallbackUrl = `${GEMINI_API_BASE}/${modelPath}:generateContent?key=${this.apiKey}`;
      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (fallbackResponse.ok) {
        const fallbackJson = await fallbackResponse.json();
        const fallbackText = extractGeminiText(fallbackJson);
        if (fallbackText) {
          full = fallbackText;
          callbacks.onChunk?.(fallbackText);
        }
      }
    }

    const finishedBecauseMaxTokens = lastParsed?.candidates?.[0]?.finishReason === 'MAX_TOKENS';
    if (finishedBecauseMaxTokens && !full.trim() && options?.onMaxTokens) {
      return options.onMaxTokens(full, lastParsed);
    }

    if (!full.trim() && options?.onEmptyResult) {
      const fallback = await options.onEmptyResult();
      if (fallback) {
        callbacks.onChunk?.(fallback);
        callbacks.onComplete?.();
        return fallback;
      }
    }

    callbacks.onComplete?.();
    return full;
  }

  private async streamWithRetry(executor: () => Promise<string>, attempt = 0): Promise<string> {
    try {
      return await executor();
    } catch (error) {
      if (attempt === 0 && error instanceof APIError && error.message.includes('NOT_FOUND')) {
        invalidateGeminiModelCache();
        this.modelPromise = resolveGeminiModel(this.apiKey, undefined);
        return this.streamWithRetry(executor, attempt + 1);
      }
      throw error;
    }
  }

  private async generateContent(modelPath: string, body: any): Promise<any> {
    const url = `${GEMINI_API_BASE}/${modelPath}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new APIError('API_ERROR', `Gemini fallback request failed: ${response.status}`, errorText);
    }

    return response.json();
  }
}

function extractGeminiText(payload: any): string {
  const candidate =
    payload?.candidates?.[0] ??
    payload?.result?.candidates?.[0] ??
    payload?.serverContent?.candidates?.[0] ??
    payload?.completion?.candidates?.[0] ??
    payload?.modelOutput?.[0]?.content ??
    payload?.modelOutput?.[0];

  if (!candidate) {
    return '';
  }

  const deltaParts =
    candidate?.delta?.content?.parts ??
    candidate?.delta?.parts ??
    candidate?.delta?.[0]?.parts;
  const contentParts =
    candidate?.content?.parts ??
    candidate?.content?.[0]?.parts ??
    candidate?.output?.[0]?.content?.parts;

  const parts = deltaParts || contentParts;
  if (!parts) return '';

  return parts
    .map((part: any) => {
      if (typeof part?.text === 'string') return part.text;
      if (typeof part === 'string') return part;
      return '';
    })
    .filter(Boolean)
    .join('');
}

function parseGeminiStreamEvent(eventPayload: string): any | null {
  const lines = eventPayload.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') {
        continue;
      }
      dataLines.push(data);
    }
  }

  if (!dataLines.length) {
    return null;
  }

  const combined = dataLines.join('\n');
  try {
    return JSON.parse(combined);
  } catch {
    return null;
  }
}

function normalizeInlineImage(image: string): { data: string | null; mimeType: string } {
  if (!image) {
    return { data: null, mimeType: 'image/png' };
  }

  if (image.startsWith('data:')) {
    const commaIndex = image.indexOf(',');
    if (commaIndex === -1) {
      return { data: null, mimeType: 'image/png' };
    }
    const header = image.slice(5, commaIndex); // skip 'data:'
    const mimeType = header.split(';')[0] || 'image/png';
    const data = image.slice(commaIndex + 1);
    return { data, mimeType };
  }

  return { data: image, mimeType: inferImageMimeType(image) };
}

function inferImageMimeType(base64: string): string {
  const trimmed = base64.trim();
  if (trimmed.startsWith('iVBORw0KGgo')) return 'image/png';
  if (trimmed.startsWith('/9j/')) return 'image/jpeg';
  if (trimmed.startsWith('R0lGOD')) return 'image/gif';
  if (trimmed.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

