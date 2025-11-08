const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_CACHE_KEY = 'gemini_preferred_model';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const GEMINI_DEFAULT_MODELS = [
  'models/gemini-2.5-flash',
  'models/gemini-2.0-flash',
  'models/gemini-flash-latest',
  'models/gemini-1.5-flash-latest'
];

interface GeminiModelEntry {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

interface CachedModel {
  model: string;
  timestamp: number;
}

export async function resolveGeminiModel(apiKey: string | undefined, requestedModel?: string): Promise<string> {
  if (!apiKey) {
    const cached = getCachedModel();
    return cached || GEMINI_DEFAULT_MODELS[0];
  }

  if (requestedModel) {
    return ensurePrefixed(requestedModel);
  }

  const cached = getCachedModel();
  if (cached) {
    return cached;
  }

  try {
    const url = `${GEMINI_MODELS_URL}?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list Gemini models: ${response.status}`);
    }
    const payload = await response.json();
    const models: GeminiModelEntry[] = payload.models || [];

    const streamingCandidates = models.filter((model) => {
      const methods = model.supportedGenerationMethods || (model as any).supportedMethods || [];
      return methods.includes('generateContent') || methods.includes('streamGenerateContent');
    });

    const preferred = pickPreferredModel(streamingCandidates);
    if (preferred) {
      cacheModel(preferred);
      return preferred;
    }
  } catch (error) {
    console.warn('Gemini model discovery failed, using fallback:', error);
  }

  return GEMINI_DEFAULT_MODELS[0];
}

function pickPreferredModel(models: GeminiModelEntry[]): string | null {
  if (!models.length) return null;

  const ranked = [...models].sort((a, b) => score(b) - score(a));
  const best = ranked[0];
  return ensurePrefixed(best.name);
}

function score(model: GeminiModelEntry): number {
  const name = model.name || '';
  if (name.includes('2.5-pro')) return 5;
  if (name.includes('2.5-flash')) return 4;
  if (name.includes('2.0-pro')) return 3.5;
  if (name.includes('2.0-flash')) return 3;
  if (name.includes('1.5-pro')) return 2;
  if (name.includes('1.5-flash')) return 1.5;
  if (name.includes('1.0-pro')) return 1;
  if (name.includes('flash')) return 0.5;
  return 0;
}

function ensurePrefixed(model: string): string {
  if (!model.startsWith('models/')) {
    return `models/${model}`;
  }
  return model;
}

function getCachedModel(): string | null {
  try {
    const item = localStorage.getItem(GEMINI_CACHE_KEY);
    if (!item) return null;
    const parsed: CachedModel = JSON.parse(item);
    if (!parsed.model || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(GEMINI_CACHE_KEY);
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
    localStorage.setItem(GEMINI_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

export function invalidateGeminiModelCache() {
  try {
    localStorage.removeItem(GEMINI_CACHE_KEY);
  } catch {}
}

