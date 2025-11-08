import { APIError } from '../../data';
import { VendorProvider, VendorId, VendorMessage, StreamCallbacks, AudioSummaryParams } from '../types';
import { VENDOR_METADATA } from '../metadata';
import { resolvePerplexityModel, invalidatePerplexityModelCache, PerplexityModelOptions } from '../model-resolver/perplexityModelResolver';

const PERPLEXITY_ENDPOINT = 'https://api.perplexity.ai/chat/completions';

export class PerplexityProvider implements VendorProvider {
  public readonly id: VendorId = 'perplexity';
  public readonly supportsImages = VENDOR_METADATA.perplexity.supportsImages;
  public readonly supportsMeetingsAudio = VENDOR_METADATA.perplexity.supportsMeetingsAudio;
  private readonly apiKey?: string;
  private modelPromise: Promise<string>;
  private readonly baseResolveOptions: PerplexityModelOptions;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
    this.baseResolveOptions = {
      requestedModel: VENDOR_METADATA.perplexity.defaultModel,
      requiredCapabilities: { text: true, streaming: true }
    };
    this.modelPromise = resolvePerplexityModel(apiKey, this.baseResolveOptions);
  }

  private ensureApiKey() {
    if (!this.apiKey) {
      throw new APIError('MISSING_API_KEY', 'Perplexity API key not configured.');
    }
  }

  async streamText(messages: VendorMessage[], callbacks: StreamCallbacks): Promise<string> {
    this.ensureApiKey();
    const model = await this.modelPromise;
    return this.streamWithRetry(model, messages, callbacks, 0, this.baseResolveOptions);
  }

  async streamMultimodal(messages: VendorMessage[], images: string[], callbacks: StreamCallbacks): Promise<string> {
    this.ensureApiKey();
    const options: PerplexityModelOptions = {
      requiredCapabilities: { text: true, streaming: true, images: true }
    };
    const model = await resolvePerplexityModel(this.apiKey, options);

    const transformedMessages = transformMessagesWithImages(messages, images);
    return this.streamWithRetry(model, transformedMessages, callbacks, 0, options);
  }

  private async streamWithRetry(
    model: string,
    messages: any[],
    callbacks: StreamCallbacks,
    attempt = 0,
    resolveOptions?: PerplexityModelOptions
  ): Promise<string> {
    const response = await fetch(PERPLEXITY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true
        })
      });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      if (response.status === 400 && attempt === 0 && isInvalidModelError(errorText)) {
        invalidatePerplexityModelCache();
        const options = resolveOptions || this.baseResolveOptions;
        const nextModelPromise = resolvePerplexityModel(this.apiKey, options);
        if (!resolveOptions) {
          this.modelPromise = nextModelPromise;
        }
        const fallbackModel = await nextModelPromise;
        if (fallbackModel !== model) {
          return this.streamWithRetry(fallbackModel, messages, callbacks, attempt + 1, options);
        }
      }
      throw new APIError('API_ERROR', `Perplexity request failed: ${response.status}`, errorText);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    let full = '';
    let sawDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';

      for (const event of events) {
        const { payload, done: eventDone } = parsePerplexityStreamEvent(event);
        if (eventDone) {
          sawDone = true;
          continue;
        }
        if (!payload) continue;

        const text = extractPerplexityText(payload);
        if (text) {
          full += text;
          callbacks.onChunk?.(text);
        }
      }
    }

    const leftover = parsePerplexityStreamEvent(buffer);
    if (leftover.payload) {
      const text = extractPerplexityText(leftover.payload);
      if (text) {
        full += text;
        callbacks.onChunk?.(text);
      }
    }
    if (leftover.done) {
      sawDone = true;
    }

    if (!sawDone && !full) {
      const fallback = await collectPerplexityResponse(model, messages, this.apiKey);
      if (fallback) {
        full = fallback;
        callbacks.onChunk?.(fallback);
      }
    }

    callbacks.onComplete?.();
    return full;
  }

  async streamAudioSummary(params: AudioSummaryParams): Promise<string> {
    if (!VENDOR_METADATA.perplexity.supportsMeetingsAudio) {
      throw new APIError('UNSUPPORTED', 'Perplexity provider does not currently support audio summaries.');
    }
    return this.streamText(
      [
        {
          role: 'system',
          content: 'You are a real-time meeting summarizer. Provide concise rolling summaries focusing on decisions, action items, and key topics.'
        },
        {
          role: 'user',
          content: params.transcript
        }
      ],
      params.callbacks
    );
  }
}

function transformMessagesWithImages(messages: VendorMessage[], images: string[]): any[] {
  if (!images.length) {
    return messages;
  }

  const lastIndex = messages.length - 1;
  return messages.map((message, index) => {
    if (message.role === 'user' && index === lastIndex) {
      const parts: any[] = [];
      if (message.content?.trim()) {
        parts.push({ type: 'text', text: message.content });
      }
      images.forEach((image) => {
        parts.push({
          type: 'image_url',
          image_url: {
            url: image.startsWith('data:') ? image : `data:image/png;base64,${image}`
          }
        });
      });
      return {
        role: message.role,
        content: parts
      };
    }
    return {
      role: message.role,
      content: message.content
    };
  });
}

async function collectPerplexityResponse(model: string, messages: any[], apiKey?: string): Promise<string> {
  try {
    const response = await fetch(PERPLEXITY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      })
    });
    if (!response.ok) {
      return '';
    }
    const json = await response.json();
    return extractPerplexityText(json);
  } catch {
    return '';
  }
}

function parsePerplexityStreamEvent(eventPayload: string): { payload: any | null; done: boolean } {
  if (!eventPayload.trim()) {
    return { payload: null, done: false };
  }

  const lines = eventPayload.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim();
      if (!data) {
        continue;
      }
      if (data === '[DONE]') {
        return { payload: null, done: true };
      }
      dataLines.push(data);
    }
  }

  if (!dataLines.length) {
    return { payload: null, done: false };
  }

  try {
    const json = JSON.parse(dataLines.join('\n'));
    return { payload: json, done: false };
  } catch {
    return { payload: null, done: false };
  }
}

function extractPerplexityText(payload: any): string {
  if (!payload) return '';

  const choices = payload?.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const delta = choices[0]?.delta;
    if (delta) {
      const textFromDelta = extractContentParts(delta.content ?? delta);
      if (textFromDelta) return textFromDelta;
    }

    const messageContent = choices[0]?.message?.content;
    const textFromMessage = extractContentParts(messageContent);
    if (textFromMessage) return textFromMessage;
  }

  const outputText = payload?.output_text;
  if (typeof outputText === 'string') {
    return outputText;
  }

  return '';
}

function extractContentParts(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  if (typeof content?.text === 'string') {
    return content.text;
  }
  return '';
}

function isInvalidModelError(raw: string): boolean {
  if (!raw) return false;
  if (raw.toLowerCase().includes('invalid_model')) return true;
  try {
    const parsed = JSON.parse(raw);
    const code = parsed?.error?.type || parsed?.error?.code || parsed?.code;
    if (typeof code === 'string' && code.toLowerCase().includes('invalid')) {
      return true;
    }
  } catch {
    // ignore parse errors
  }
  return false;
}

