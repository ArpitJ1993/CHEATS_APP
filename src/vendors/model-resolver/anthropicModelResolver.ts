import { VendorModelCapabilities, VendorModelInfo } from '../types';

const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';
const CACHE_KEY = 'anthropic_preferred_model';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const DEFAULT_FALLBACK_MODEL = 'claude-3-5-sonnet-20240620';

interface AnthropicModelEntry {
  id: string;
  display_name?: string;
  input_modalities?: string[];
  output_modalities?: string[];
  metadata?: Record<string, any>;
  max_output_tokens?: number;
}

interface CachedModel {
  model: string;
  timestamp: number;
}

export interface AnthropicModelOptions {
  requestedModel?: string;
  requiredCapabilities?: Partial<VendorModelCapabilities>;
  excludeModels?: string[];
}

export async function resolveAnthropicModel(
  apiKey: string | undefined,
  options?: AnthropicModelOptions
): Promise<string> {
  const { requestedModel, requiredCapabilities, excludeModels } = options || {};
  const excluded = new Set(excludeModels || []);

  if (requestedModel && !excluded.has(requestedModel)) {
    return requestedModel;
  }

  const cached = getCachedModel();
  if (cached && !excluded.has(cached)) {
    return cached;
  }

  if (!apiKey) {
    return DEFAULT_FALLBACK_MODEL;
  }

  try {
    const response = await fetch(ANTHROPIC_MODELS_URL, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list Anthropic models: ${response.status}`);
    }

    const payload = await response.json();
    const models: AnthropicModelEntry[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.models)
      ? payload.models
      : [];

    const modelInfos = models.map(normalizeModelEntry).filter(Boolean) as VendorModelInfo[];

    const candidates = filterByCapabilities(modelInfos, requiredCapabilities, excluded);
    if (candidates.length) {
      const preferred = pickPreferredModel(candidates);
      if (preferred) {
        cacheModel(preferred);
        return preferred;
      }
    }
  } catch (error) {
    console.warn('Anthropic model discovery failed, using fallback:', error);
  }

  const safeFallback = pickSafeFallback(excluded);
  cacheModel(safeFallback);
  return safeFallback;
}

export function invalidateAnthropicModelCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

function filterByCapabilities(
  models: VendorModelInfo[],
  required: Partial<VendorModelCapabilities> | undefined,
  excluded: Set<string>
): VendorModelInfo[] {
  if (!required) return models;
  return models.filter((model) => {
    if (excluded.has(model.name)) return false;
    const caps = model.capabilities;
    if (required.text && !caps.text) return false;
    if (required.streaming && !caps.streaming) return false;
    if (required.images && !caps.images) return false;
    if (required.audio && !caps.audio) return false;
    if (
      typeof required.maxOutputTokens === 'number' &&
      typeof caps.maxOutputTokens === 'number' &&
      caps.maxOutputTokens < required.maxOutputTokens
    ) {
      return false;
    }
    return true;
  });
}

function pickPreferredModel(models: VendorModelInfo[]): string | null {
  if (!models.length) return null;
  const ranked = [...models].sort((a, b) => scoreModel(b) - scoreModel(a));
  return ranked[0].name;
}

function scoreModel(model: VendorModelInfo): number {
  const name = model.name || '';
  const caps = model.capabilities;
  let score = 0;

  if (name.includes('3-5-sonnet')) score += 10;
  else if (name.includes('3-sonnet')) score += 8;
  else if (name.includes('3-haiku')) score += 5;
  else score += 1;

  if (caps.images) score += 2;
  if (caps.audio) score += 1;
  if (typeof caps.maxOutputTokens === 'number') {
    score += caps.maxOutputTokens / 1000;
  }

  return score;
}

function normalizeModelEntry(entry: AnthropicModelEntry): VendorModelInfo | null {
  if (!entry?.id) return null;
  const inputModalities: string[] = entry.input_modalities || entry.metadata?.input_modalities || [];
  const outputModalities: string[] = entry.output_modalities || entry.metadata?.output_modalities || [];

  const capabilities: VendorModelCapabilities = {
    text: outputModalities.includes('text') || true,
    streaming: true,
    images: inputModalities.includes('image'),
    audio: inputModalities.includes('audio') || outputModalities.includes('audio'),
    maxOutputTokens: entry.max_output_tokens || entry.metadata?.max_output_tokens
  };

  return {
    name: entry.id,
    label: entry.display_name || entry.id,
    tier: inferTier(entry.id),
    capabilities
  };
}

function inferTier(id: string): 'free' | 'paid' {
  if (id.includes('haiku')) return 'free';
  return 'paid';
}

function pickSafeFallback(excluded: Set<string>): string {
  const fallbackList = [
    'claude-3-5-sonnet-latest',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    DEFAULT_FALLBACK_MODEL
  ];

  for (const model of fallbackList) {
    if (!excluded.has(model)) {
      return model;
    }
  }
  return DEFAULT_FALLBACK_MODEL;
}

function getCachedModel(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedModel = JSON.parse(raw);
    if (!parsed?.model || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.model;
  } catch {
    return null;
  }
}

function cacheModel(model: string) {
  try {
    const payload: CachedModel = {
      model,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {}
}
