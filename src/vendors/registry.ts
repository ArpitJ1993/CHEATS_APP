import { VendorId, VendorProvider, VendorMessage, StreamCallbacks } from './types';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { PerplexityProvider } from './providers/PerplexityProvider';

export function createVendorProvider(vendorId: VendorId, apiKey: string | undefined): VendorProvider {
  switch (vendorId) {
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'perplexity':
      return new PerplexityProvider(apiKey);
    default:
      throw new Error(`Unknown vendor: ${vendorId}`);
  }
}

export type { VendorProvider, VendorMessage, StreamCallbacks };

