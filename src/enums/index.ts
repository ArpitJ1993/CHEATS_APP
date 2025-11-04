// Application enums
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto'
}

export enum FontSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

export enum ButtonVariant {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  OUTLINED = 'outlined',
  TEXT = 'text'
}

export enum ButtonSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

export enum ErrorType {
  API = 'api',
  NETWORK = 'network',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  SYSTEM = 'system',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

export enum AppVisibility {
  VISIBLE = 'visible',
  HIDDEN = 'hidden'
}

export enum ScreenshotState {
  IDLE = 'idle',
  CAPTURING = 'capturing',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export enum APIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  LOCAL = 'local'
}

export enum FileFormat {
  TXT = 'txt',
  PDF = 'pdf',
  JSON = 'json',
  MD = 'md'
}

export enum KeyboardShortcut {
  SCREENSHOT = 'CmdOrCtrl+H',
  TOGGLE_VISIBILITY = 'CmdOrCtrl+Shift+V',
  RESET = 'CmdOrCtrl+R',
  SAVE = 'CmdOrCtrl+S',
  NEW_QUERY = 'CmdOrCtrl+N'
}

export enum Platform {
  MACOS = 'darwin',
  WINDOWS = 'win32',
  LINUX = 'linux'
}

export enum ImageFormat {
  PNG = 'png',
  JPEG = 'jpeg',
  WEBP = 'webp'
}

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}
