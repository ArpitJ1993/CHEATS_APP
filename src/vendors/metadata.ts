import { VendorId, VendorMetadata } from './types';

export const VENDOR_IDS: VendorId[] = ['openai', 'gemini', 'anthropic', 'perplexity'];

export const VENDOR_METADATA: Record<VendorId, VendorMetadata> = {
  openai: {
    id: 'openai',
    label: 'OpenAI (ChatGPT)',
    description: 'OpenAI GPT models with multimodal support and realtime audio transcription.',
    supportsImages: true,
    supportsMeetingsAudio: true,
    supportsAudioRecorder: true,
    defaultModel: 'gpt-4o-mini'
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Google Gemini multimodal models with high-quality reasoning.',
    supportsImages: true,
    supportsMeetingsAudio: false,
    supportsAudioRecorder: false,
    defaultModel: 'gemini-2.5-flash'
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    description: 'Claude 3 family with fast and reliable text generation.',
    supportsImages: true,
    supportsMeetingsAudio: false,
    supportsAudioRecorder: false,
    defaultModel: 'claude-3-5-sonnet-20240620'
  },
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity',
    description: 'Perplexity conversational search with web-grounded answers.',
    supportsImages: true,
    supportsMeetingsAudio: false,
    supportsAudioRecorder: false,
    defaultModel: 'sonar',
    modelCatalog: [
      {
        name: 'sonar-pro',
        label: 'Sonar Pro',
        tier: 'paid',
        capabilities: {
          text: true,
          streaming: true,
          images: true,
          audio: false,
          maxOutputTokens: 8000
        }
      },
      {
        name: 'sonar',
        label: 'Sonar',
        tier: 'free',
        capabilities: {
          text: true,
          streaming: true,
          images: true,
          audio: false,
          maxOutputTokens: 6000
        }
      },
      {
        name: 'sonar-reasoning-pro',
        label: 'Sonar Reasoning Pro',
        tier: 'paid',
        capabilities: {
          text: true,
          streaming: true,
          images: true,
          audio: false,
          maxOutputTokens: 8000
        }
      },
      {
        name: 'sonar-reasoning',
        label: 'Sonar Reasoning',
        tier: 'paid',
        capabilities: {
          text: true,
          streaming: true,
          images: false,
          audio: false,
          maxOutputTokens: 4000
        }
      },
      {
        name: 'sonar-deep-research',
        label: 'Sonar Deep Research',
        tier: 'paid',
        capabilities: {
          text: true,
          streaming: false,
          images: false,
          audio: false,
          maxOutputTokens: 20000
        }
      }
    ]
  }
};

export function getVendorMetadata(id: VendorId): VendorMetadata {
  return VENDOR_METADATA[id];
}

