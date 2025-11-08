import OpenAIService from '../../data/openaiService';
import { APIError } from '../../data';
import { VendorProvider, VendorId, VendorMessage, StreamCallbacks, AudioSummaryParams } from '../types';

export class OpenAIProvider implements VendorProvider {
  public readonly id: VendorId = 'openai';
  public readonly supportsImages = true;
  public readonly supportsMeetingsAudio = true;
  private service: OpenAIService;

  constructor(apiKey: string | undefined) {
    this.service = new OpenAIService(apiKey);
  }

  async streamText(messages: VendorMessage[], callbacks: StreamCallbacks): Promise<string> {
    return this.service.sendMessage(
      messages,
      callbacks.onChunk,
      callbacks.onComplete,
      (error) => callbacks.onError?.(error)
    );
  }

  async streamMultimodal(messages: VendorMessage[], images: string[], callbacks: StreamCallbacks): Promise<string> {
    return this.service.sendMessageWithImages(
      messages,
      images,
      callbacks.onChunk,
      callbacks.onComplete,
      (error) => callbacks.onError?.(error)
    );
  }

  async streamAudioSummary(params: AudioSummaryParams): Promise<string> {
    const { transcript, callbacks } = params;
    return this.streamText(
      [
        {
          role: 'system',
          content: 'You are a real-time meeting summarizer. Produce concise rolling summaries focusing on decisions, action items, and key points. Avoid repeating previous context.'
        },
        {
          role: 'user',
          content: transcript
        }
      ],
      callbacks
    );
  }
}

