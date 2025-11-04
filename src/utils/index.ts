// Date and time utilities
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return `${day}-${month}-${year}-${hours}:${minutes}:${seconds}`;
};

export const generateFilename = (prefix: string = 'response'): string => {
  const timestamp = formatTimestamp(Date.now());
  return `${timestamp}.txt`;
};

// File size utilities
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Validation utilities
export const validateApiKey = (apiKey: string): boolean => {
  return apiKey.length > 0 && apiKey.startsWith('sk-');
};

export const validateScreenshotSize = (size: number, maxSize: number): boolean => {
  return size <= maxSize;
};

export const validateAudioDuration = (duration: number, maxDuration: number): boolean => {
  return duration <= maxDuration;
};

// String utilities
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-z0-9.-]/gi, '_');
};

// Array utilities
export const reorderArray = <T>(array: T[], from: number, to: number): T[] => {
  const result = Array.from(array);
  const [removed] = result.splice(from, 1);
  result.splice(to, 0, removed);
  return result;
};

// Local storage utilities
export const saveToLocalStorage = (key: string, value: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

export const loadFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

export const removeFromLocalStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to remove from localStorage:', error);
  }
};

// Error handling utilities
export const createError = (type: string, message: string, details?: any): AppError => {
  return {
    id: Date.now().toString(),
    type: type as any,
    message,
    details,
    timestamp: Date.now(),
    resolved: false,
  };
};

export const isNetworkError = (error: any): boolean => {
  return error.code === 'NETWORK_ERROR' || 
         error.message?.includes('network') ||
         error.message?.includes('fetch');
};

export const isApiError = (error: any): boolean => {
  return error.code === 'API_ERROR' ||
         error.status >= 400 ||
         error.message?.includes('API');
};

// Platform detection
export const getPlatform = (): 'mac' | 'windows' | 'linux' => {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'mac';
  if (platform.includes('win')) return 'windows';
  return 'linux';
};

export const getKeyboardShortcut = (key: string): string => {
  const platform = getPlatform();
  if (platform === 'mac') {
    return key.replace('CmdOrCtrl', '⌘');
  }
  return key.replace('CmdOrCtrl', 'Ctrl');
};

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Import AppError type
import { AppError } from '../types';
