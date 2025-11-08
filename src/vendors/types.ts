export type VendorId = 'openai' | 'gemini' | 'anthropic' | 'perplexity';

export interface VendorMetadata {
  id: VendorId;
  label: string;
  description: string;
  supportsImages: boolean;
  supportsMeetingsAudio: boolean;
  supportsAudioRecorder: boolean;
  defaultModel: string;
  modelCatalog?: VendorModelInfo[];
}

export interface StreamCallbacks {
  onChunk?: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface VendorProvider {
  id: VendorId;
  supportsImages: boolean;
  supportsMeetingsAudio: boolean;
  streamText(messages: VendorMessage[], callbacks: StreamCallbacks): Promise<string>;
  streamMultimodal?(messages: VendorMessage[], images: string[], callbacks: StreamCallbacks): Promise<string>;
  streamAudioSummary?(params: AudioSummaryParams): Promise<string>;
}

export interface VendorMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AudioSummaryParams {
  transcript: string;
  callbacks: StreamCallbacks;
}

export interface VendorModelInfo {
  name: string;
  label: string;
  tier: 'free' | 'paid';
  capabilities: VendorModelCapabilities;
}

export interface VendorModelCapabilities {
  text: boolean;
  streaming: boolean;
  images?: boolean;
  audio?: boolean;
  maxOutputTokens?: number;
}

