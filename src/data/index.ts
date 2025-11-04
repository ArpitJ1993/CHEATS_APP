// API Error class
export class APIError extends Error {
  public code: string;
  public details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
  }

  // Convert to serializable object for Redux
  toSerializable() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details
    };
  }
}

// API configuration
export const API_CONFIG = {
  OPENAI_BASE_URL: process.env.REACT_APP_OPENAI_API_URL || 'https://api.openai.com/v1',
  MAX_RETRIES: 3,
  TIMEOUT: 30000, // 30 seconds
  MAX_TOKENS: 4000,
  TEMPERATURE: 0.7,
};

// API endpoints
export const ENDPOINTS = {
  CHAT_COMPLETIONS: '/chat/completions',
  MODELS: '/models',
  IMAGES: '/images/generations',
};

// Rate limiting configuration
export const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 60,
  REQUESTS_PER_HOUR: 1000,
  TOKENS_PER_MINUTE: 40000,
};

// Error codes
export const ERROR_CODES = {
  INVALID_API_KEY: 'invalid_api_key',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  QUOTA_EXCEEDED: 'quota_exceeded',
  MODEL_NOT_FOUND: 'model_not_found',
  INVALID_REQUEST: 'invalid_request',
  NETWORK_ERROR: 'network_error',
  TIMEOUT_ERROR: 'timeout_error',
  UNKNOWN_ERROR: 'unknown_error',
};

// Request/Response types
export interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface APIResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// Streaming response handler
export interface StreamHandler {
  onChunk?: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: APIError) => void;
}

// API service interface
export interface APIService {
  sendMessage(
    messages: any[],
    onChunk?: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: APIError) => void
  ): Promise<string>;
  
  sendMessageWithImages(
    messages: any[],
    images: string[],
    onChunk?: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: APIError) => void
  ): Promise<string>;
  
  sendAudioMessage(
    audioBlob: Blob,
    transcript: string,
    onChunk?: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: APIError) => void
  ): Promise<string>;
  
  validateApiKey(): Promise<boolean>;
  getModels(): Promise<string[]>;
}
