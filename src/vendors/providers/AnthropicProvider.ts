import { APIError } from '../../data';
import { VendorProvider, VendorId, VendorMessage, StreamCallbacks, AudioSummaryParams, VendorModelCapabilities } from '../types';
import { VENDOR_METADATA } from '../metadata';
import { resolveAnthropicModel, invalidateAnthropicModelCache } from '../model-resolver/anthropicModelResolver';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const IMAGE_BASE_OUTPUT_TOKENS = 2048;
const IMAGE_PER_IMAGE_BONUS = 512;
const MAX_OUTPUT_TOKEN_CEILING = 4096;

export class AnthropicProvider implements VendorProvider {
  public readonly id: VendorId = 'anthropic';
  public readonly supportsImages = VENDOR_METADATA.anthropic.supportsImages;
  public readonly supportsMeetingsAudio = VENDOR_METADATA.anthropic.supportsMeetingsAudio;
  private readonly apiKey?: string;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
  }

  private ensureApiKey() {
    if (!this.apiKey) {
      throw new APIError('MISSING_API_KEY', 'Anthropic API key not configured.');
    }
  }

  async streamText(messages: VendorMessage[], callbacks: StreamCallbacks): Promise<string> {
    this.ensureApiKey();
    return this.execute(messages, [], DEFAULT_MAX_OUTPUT_TOKENS, callbacks);
  }

  async streamMultimodal(messages: VendorMessage[], images: string[], callbacks: StreamCallbacks): Promise<string> {
    this.ensureApiKey();
    const imageCount = Math.max(0, images.length);
    const maxTokens = imageCount
      ? Math.min(
          MAX_OUTPUT_TOKEN_CEILING,
          IMAGE_BASE_OUTPUT_TOKENS + Math.max(0, imageCount - 1) * IMAGE_PER_IMAGE_BONUS
        )
      : DEFAULT_MAX_OUTPUT_TOKENS;
    return this.execute(messages, images, maxTokens, callbacks);
  }

  async streamAudioSummary(params: AudioSummaryParams): Promise<string> {
    return this.streamText(
      [
        {
          role: 'system',
          content: 'You are a real-time meeting summarizer. Produce concise rolling summaries focusing on decisions, action items, and key points.'
        },
        {
          role: 'user',
          content: params.transcript
        }
      ],
      params.callbacks
    );
  }

  private buildRequest(
    messages: VendorMessage[],
    images: string[] = [],
    maxTokens = DEFAULT_MAX_OUTPUT_TOKENS,
    modelOverride?: string
  ) {
    let systemInstruction = '';
    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: any[] }> = [];

    const lastUserIndex = [...messages].map((msg) => msg.role).lastIndexOf('user');

    messages.forEach((message, index) => {
      if (message.role === 'system') {
        systemInstruction += `${message.content}\n\n`;
        return;
      }

      const role = message.role === 'assistant' ? 'assistant' : 'user';
      const shouldAttachImages = role === 'user' && index === lastUserIndex && images.length > 0;
      const contentParts = this.buildContentParts(message.content, shouldAttachImages ? images : []);
      if (!contentParts.length) return;

      anthropicMessages.push({ role, content: contentParts });
    });

    if (images.length) {
      const hasImageContent = anthropicMessages.some((msg) => msg.content.some((part) => part.type === 'image'));
      if (!hasImageContent) {
        anthropicMessages.push({ role: 'user', content: this.buildContentParts('', images) });
      }
    }

    const payload: any = {
      model: modelOverride || VENDOR_METADATA.anthropic.defaultModel,
      max_tokens: maxTokens,
      messages: anthropicMessages
    };

    if (systemInstruction.trim()) {
      payload.system = systemInstruction.trim();
    }

    return payload;
  }

  private async streamMessages(payload: any, callbacks: StreamCallbacks, hasImages = false): Promise<string> {
    const response = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey as string,
        'anthropic-version': ANTHROPIC_VERSION,
        Accept: 'text/event-stream'
      },
      body: JSON.stringify({ ...payload, stream: true })
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new APIError('API_ERROR', `Anthropic request failed: ${response.status}`, errorText);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const segments = buffer.split('\n\n');
      buffer = segments.pop() || '';

      for (const segment of segments) {
        processAnthropicSegment(segment, (text) => {
          full += text;
          callbacks.onChunk?.(text);
        }, callbacks.onComplete);
      }
    }

    if (buffer.trim()) {
      processAnthropicSegment(buffer, (text) => {
        full += text;
        callbacks.onChunk?.(text);
      }, callbacks.onComplete);
    }

    if (!full.trim() && hasImages) {
      const fallbackResponse = await fetch(ANTHROPIC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey as string,
          'anthropic-version': ANTHROPIC_VERSION
        },
        body: JSON.stringify(payload)
      });

      if (fallbackResponse.ok) {
        const fallbackJson = await fallbackResponse.json();
        const fallbackText = extractAnthropicText(fallbackJson);
        if (fallbackText) {
          full = fallbackText;
          callbacks.onChunk?.(fallbackText);
        }
      }
    }

    callbacks.onComplete?.();
    return full;
  }

  private async execute(
    messages: VendorMessage[],
    images: string[],
    maxTokens: number,
    callbacks: StreamCallbacks,
    attempted: Set<string> = new Set()
  ): Promise<string> {
    const requiredCapabilities: Partial<VendorModelCapabilities> = {
      text: true,
      streaming: true
    };
    if (images.length) {
      requiredCapabilities.images = true;
    }

    const model = await resolveAnthropicModel(this.apiKey, {
      requestedModel: attempted.size === 0 ? VENDOR_METADATA.anthropic.defaultModel : undefined,
      requiredCapabilities,
      excludeModels: Array.from(attempted)
    });

    attempted.add(model);

    const payload = this.buildRequest(messages, images, maxTokens, model);

    try {
      return await this.streamMessages(payload, callbacks, images.length > 0);
    } catch (error) {
      if (error instanceof APIError) {
        const detailString = normalizeErrorDetails(error.details) || error.message || '';
        if (detailString.includes('not_found')) {
          invalidateAnthropicModelCache();
          if (attempted.size < 5) {
            return this.execute(messages, images, maxTokens, callbacks, attempted);
          }
        }
      }
      throw error;
    }
  }

  private buildContentParts(text: string, images: string[]): any[] {
    const trimmed = text?.trim() || '';
    if (!images.length) {
      return trimmed ? [{ type: 'text', text: trimmed }] : [];
    }

    const parts: any[] = [];
    if (trimmed) {
      parts.push({ type: 'text', text: trimmed });
    }

    images.forEach((image) => {
      const { data, mediaType } = normalizeAnthropicImage(image);
      if (data) {
        parts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data
          }
        });
      }
    });

    const closingText = trimmed
      ? 'Please answer the question above using every image provided.'
      : 'Please analyze every image provided in this message.';
    parts.push({ type: 'text', text: closingText });

    return parts;
  }
}

function processAnthropicSegment(segment: string, onText: (text: string) => void, onComplete?: () => void) {
  const lines = segment.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') {
      onComplete?.();
      continue;
    }
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
        onText(parsed.delta.text);
      }
      if (parsed.type === 'message_stop') {
        onComplete?.();
      }
    } catch {
      // ignore parse errors for incomplete fragments
    }
  }
}

function normalizeAnthropicImage(image: string): { data: string | null; mediaType: string } {
  if (!image) {
    return { data: null, mediaType: 'image/png' };
  }

  if (image.startsWith('data:')) {
    const commaIndex = image.indexOf(',');
    if (commaIndex === -1) {
      return { data: null, mediaType: 'image/png' };
    }
    const header = image.slice(5, commaIndex);
    const mediaType = header.split(';')[0] || 'image/png';
    const data = image.slice(commaIndex + 1);
    return { data, mediaType };
  }

  return { data: image, mediaType: inferAnthropicMimeType(image) };
}

function inferAnthropicMimeType(base64: string): string {
  const trimmed = base64.trim();
  if (trimmed.startsWith('iVBORw0KGgo')) return 'image/png';
  if (trimmed.startsWith('/9j/')) return 'image/jpeg';
  if (trimmed.startsWith('R0lGOD')) return 'image/gif';
  if (trimmed.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

function extractAnthropicText(payload: any): string {
  const content = payload?.content;
  if (!Array.isArray(content)) return '';

  return content
    .map((block: any) => {
      if (block?.type === 'text' && typeof block.text === 'string') return block.text;
      return '';
    })
    .filter(Boolean)
    .join('');
}

function normalizeErrorDetails(details: any): string | null {
  if (!details) return null;
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    try {
      return JSON.stringify(details);
    } catch {
      return null;
    }
  }
  return null;
}

