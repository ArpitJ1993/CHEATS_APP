import { VendorModelInfo, VendorModelCapabilities } from '../types';
import { VENDOR_METADATA } from '../metadata';

const PERPLEXITY_CACHE_KEY = 'perplexity_preferred_model';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

type PerplexityTier = 'free' | 'paid';

interface CachedModel {
  model: string;
  timestamp: number;
}

export interface PerplexityModelOptions {
  requestedModel?: string;
  requiredCapabilities?: Partial<VendorModelCapabilities>;
  preferredTier?: PerplexityTier;
}

export async function resolvePerplexityModel(apiKey: string | undefined, options?: PerplexityModelOptions): Promise<string> {
  const { requestedModel, requiredCapabilities, preferredTier } = options || {};

  if (requestedModel) {
    return requestedModel;
  }

  const cached = getCachedModel();
  if (cached) {
    return cached;
  }

  const catalog = getPerplexityCatalog();
  const candidates = catalog.filter((entry) => matchesCapabilities(entry, requiredCapabilities));

  const ranked = rankModels(candidates, preferredTier);
  if (ranked.length) {
    const preferred = ranked[0].name;
    cacheModel(preferred);
    return preferred;
  }

  const fallback = VENDOR_METADATA.perplexity.defaultModel;
  cacheModel(fallback);
  return fallback;
}

export function invalidatePerplexityModelCache() {
  try {
    localStorage.removeItem(PERPLEXITY_CACHE_KEY);
  } catch {
    // ignore
  }
}

function matchesCapabilities(entry: VendorModelInfo, required?: Partial<VendorModelCapabilities>): boolean {
  if (!required) return true;
  return Object.entries(required).every(([key, value]) => {
    if (value === undefined) return true;
    const capabilityValue = (entry.capabilities as any)[key];
    if (typeof value === 'boolean') {
      return Boolean(capabilityValue) === value;
    }
    if (typeof value === 'number') {
      return typeof capabilityValue === 'number' && capabilityValue >= value;
    }
    return capabilityValue === value;
  });
}

function rankModels(models: VendorModelInfo[], preferredTier?: PerplexityTier): VendorModelInfo[] {
  return [...models].sort((a, b) => {
    const tierScore = (tier: PerplexityTier) => {
      if (!preferredTier) return tier === 'paid' ? 2 : 1;
      return tier === preferredTier ? 3 : 1;
    };
    const capabilityScore = (entry: VendorModelInfo) => {
      const caps = entry.capabilities;
      return (caps.streaming ? 2 : 0) + (caps.images ? 1 : 0) + (caps.audio ? 1 : 0) + (caps.maxOutputTokens || 0) / 10000;
    };
    const aScore = tierScore(a.tier) + capabilityScore(a);
    const bScore = tierScore(b.tier) + capabilityScore(b);
    return bScore - aScore;
  });
}

function cacheModel(model: string) {
  try {
    const payload: CachedModel = {
      model,
      timestamp: Date.now()
    };
    localStorage.setItem(PERPLEXITY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function getCachedModel(): string | null {
  try {
    const item = localStorage.getItem(PERPLEXITY_CACHE_KEY);
    if (!item) return null;
    const parsed: CachedModel = JSON.parse(item);
    if (!parsed.model || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(PERPLEXITY_CACHE_KEY);
      return null;
    }
    return parsed.model;
  } catch {
    return null;
  }
}

function getPerplexityCatalog(): VendorModelInfo[] {
  const explicit = VENDOR_METADATA.perplexity.modelCatalog;
  if (explicit && explicit.length) {
    return explicit;
  }

  // Fallback catalog based on public documentation.
  return [
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
  ];
}

