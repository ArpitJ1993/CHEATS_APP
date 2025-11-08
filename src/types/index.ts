import type { VendorId } from '../vendors/types';
// Speech Recognition types
export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Core application types
export interface Screenshot {
  id: string;
  data: string; // base64 encoded image data
  timestamp: number;
  size: number;
}

export interface ScreenshotState {
  id: string;
  state: 'idle' | 'capturing' | 'processing' | 'completed' | 'error';
  timestamp: number;
}

export interface AIResponse {
  id: string;
  content: string;
  timestamp: number;
  isStreaming: boolean;
  isComplete: boolean;
}

export interface UserQuery {
  id: string;
  text: string;
  screenshots: Screenshot[];
  timestamp: number;
}

export interface Conversation {
  id: string;
  queries: UserQuery[];
  responses: AIResponse[];
  timestamp: number;
}

// Theme types
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

export interface Theme {
  mode: 'light' | 'dark' | 'auto';
  colors: ThemeColors;
  typography: {
    fontFamily: string;
    fontSize: {
      small: string;
      medium: string;
      large: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

// API types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  stream: boolean;
  max_tokens?: number;
  temperature?: number;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

// Settings types
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  apiKey: string;
  vendor: VendorId;
  vendorKeys: Record<VendorId, string>;
  userName: string;
  participantName: string;
  maxScreenshots: number;
  autoSave: boolean;
  saveLocation: string;
  shortcuts: {
    screenshot: string;
    toggleVisibility: string;
    reset: string;
    moveUp?: string;
    moveDown?: string;
    moveLeft?: string;
    moveRight?: string;
    opacityIncrease?: string;
    opacityDecrease?: string;
  };
}

// Component props types
export type ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'text';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
}

export interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  type?: string;
  min?: string;
  max?: string;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

// File management types
export interface SavedFile {
  id: string;
  filename: string;
  content: string;
  timestamp: number;
  size: number;
  path: string;
}

// Error types
export interface AppError {
  id: string;
  type: 'api' | 'network' | 'permission' | 'validation' | 'system';
  message: string;
  details?: any;
  timestamp: number;
  resolved: boolean;
}

// Accessibility types
export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
}
