const { contextBridge, ipcRenderer } = require('electron');

// Build a single API object and expose once
let currentApiKey = process.env.OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || '';
const vendorKeyStore = {
  openai: currentApiKey,
  gemini: '',
  anthropic: '',
  perplexity: ''
};
const electronAPIObj = {
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  saveFile: (content, filename) => ipcRenderer.invoke('save-file', content, filename),
  getDownloadsFolder: () => ipcRenderer.invoke('get-downloads-folder'),
  manualHideApp: () => ipcRenderer.invoke('manual-hide-app'),
  manualShowApp: () => ipcRenderer.invoke('manual-show-app'),
  toggleAppVisibility: () => ipcRenderer.invoke('toggle-app-visibility'),
  getAppVisibilityStatus: () => ipcRenderer.invoke('get-app-visibility-status'),
  hideAppWindow: () => ipcRenderer.invoke('hide-app-window'),
  showAppWindow: () => ipcRenderer.invoke('show-app-window'),
  // Opacity controls
  getOpacity: () => ipcRenderer.invoke('get-opacity'),
  setOpacity: (value) => ipcRenderer.invoke('set-opacity', value),
  increaseOpacity: () => ipcRenderer.invoke('increase-opacity'),
  decreaseOpacity: () => ipcRenderer.invoke('decrease-opacity'),
  onOpacityUpdated: (callback) => {
    ipcRenderer.on('opacity-updated', (_e, payload) => callback(payload));
  },
  removeOpacityListener: () => {
    ipcRenderer.removeAllListeners('opacity-updated');
  },
  onScreenshotTrigger: (callback) => {
    ipcRenderer.on('trigger-screenshot', callback);
  },
  removeScreenshotListener: () => {
    ipcRenderer.removeAllListeners('trigger-screenshot');
  },
  // Audio functionality
  startAudioRecording: () => ipcRenderer.invoke('start-audio-recording'),
  stopAudioRecording: () => ipcRenderer.invoke('stop-audio-recording'),
  cancelAudioRecording: () => ipcRenderer.invoke('cancel-audio-recording'),
  getAudioServiceStatus: () => ipcRenderer.invoke('get-audio-service-status'),
  transcribeAudioDirect: (arrayBuffer) => ipcRenderer.invoke('transcribe-audio-direct', arrayBuffer),
  extractQuestionsFromAudio: () => ipcRenderer.invoke('extract-questions-from-audio'),
  extractQuestionsFromAudioDirect: () => ipcRenderer.invoke('extract-questions-from-audio-direct'),
  // Meetings renderer requirements
  apiKey: currentApiKey,
  getApiKey: () => currentApiKey,
  setApiKey: (key) => ipcRenderer.invoke('set-openai-api-key', key),
  setVendorApiKey: (vendor, key) => ipcRenderer.invoke('set-vendor-api-key', { vendor, key }),
  getVendorApiKey: (vendor) => vendorKeyStore[vendor] || '',
  enableLoopbackAudio: () => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: () => ipcRenderer.invoke('disable-loopback-audio'),
  onVisibilityStatus: (callback) => {
    ipcRenderer.on('visibility-status', (_e, payload) => callback(payload));
  },
  removeVisibilityStatusListener: () => {
    ipcRenderer.removeAllListeners('visibility-status');
  },
};

// Expose protected methods that allow the renderer process to use the API
contextBridge.exposeInMainWorld('electronAPI', electronAPIObj);

// Keep renderer-side copy of API key in sync when setApiKey is called
ipcRenderer.on('openai-api-key-updated', (_e, key) => {
  currentApiKey = typeof key === 'string' ? key : '';
  vendorKeyStore.openai = currentApiKey;
  electronAPIObj.apiKey = currentApiKey;
});

ipcRenderer.on('vendor-api-key-updated', (_e, payload) => {
  if (!payload || typeof payload.vendor !== 'string') return;
  const { vendor, key } = payload;
  vendorKeyStore[vendor] = typeof key === 'string' ? key : '';
  if (vendor === 'openai') {
    currentApiKey = vendorKeyStore.openai;
    electronAPIObj.apiKey = currentApiKey;
  }
});
