require('dotenv').config();

const { app, BrowserWindow, ipcMain, dialog, screen, Tray, Menu, globalShortcut, systemPreferences } = require('electron');
const { initMain: initAudioLoopback } = require('electron-audio-loopback');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const audioService = require('./audioService');

const vendorApiKeys = {
  openai: audioService.apiKey || process.env.OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || '',
  gemini: '',
  anthropic: '',
  perplexity: ''
};

const isDev = process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'electron-dev';

try {
  initAudioLoopback();
  console.log('electron-audio-loopback initialized');
} catch (e) {
  console.warn('electron-audio-loopback init failed:', e?.message || e);
}

let mainWindow;
let overlayWindow;
let tray;
let isManuallyHidden = false;
let isCurrentlyScreenSharing = false;
let isContentProtected = false;
let currentOpacity = 1.0; // fully opaque
const MIN_OPACITY = 0.2;
const MAX_OPACITY = 1.0;
const OPACITY_STEP = 0.1;

function setupScreenSharingDetection() {
  let isScreenSharing = false;
  let windowStateBeforeHiding = null;
  
  const screenSharingApps = [
    'zoom', 'teams', 'meet', 'skype', 'discord', 'slack', 'webex', 'gotomeeting',
    'bluejeans', 'jitsi', 'whereby', 'bigbluebutton', 'record', 'share', 'screen',
    'obs', 'quicktime', 'camtasia', 'screenflow', 'loom', 'bandicam', 'fraps',
    'chrome', 'firefox', 'edge', 'safari', 'opera', 'brave', 'vivaldi'
  ];
  
  setInterval(async () => {
    if (mainWindow) {
      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        let isCurrentlySharing = false;
        
        if (process.platform === 'darwin') {
          try {
            const { stdout: psOutput } = await execAsync('ps aux | grep -E "(zoom|teams|meet|skype|discord|slack|webex|chrome|firefox|safari|obs|quicktime)" | grep -v grep');
            isCurrentlySharing = screenSharingApps.some(app => 
              psOutput.toLowerCase().includes(app.toLowerCase())
            );
            
            if (!isCurrentlySharing) {
              try {
                const { stdout: screenRecord } = await execAsync('ps aux | grep -i "screen.*record\\|record.*screen\\|share.*screen\\|screen.*share" | grep -v grep');
                isCurrentlySharing = screenRecord.length > 0;
              } catch (e) {
                // Ignore if command fails
              }
            }
            
            if (!isCurrentlySharing) {
              try {
                const { stdout: meetCheck } = await execAsync('ps aux | grep -i "google.*meet\\|meet.*google\\|hangouts" | grep -v grep');
                isCurrentlySharing = meetCheck.length > 0;
              } catch (e) {
                // Ignore if command fails
              }
            }
            
          } catch (error) {
            console.log('macOS detection error:', error.message);
            isCurrentlySharing = false;
          }
        } else if (process.platform === 'win32') {
          try {
            const { stdout: tasklistOutput } = await execAsync('tasklist /FO CSV | findstr /I "zoom.exe teams.exe chrome.exe firefox.exe edge.exe skype.exe discord.exe"');
            isCurrentlySharing = tasklistOutput.length > 0;
            
            if (!isCurrentlySharing) {
              try {
                const { stdout: recordApps } = await execAsync('tasklist /FO CSV | findstr /I "obs.exe bandicam.exe fraps.exe camtasia.exe"');
                isCurrentlySharing = recordApps.length > 0;
              } catch (e) {
                // Ignore if command fails
              }
            }
            
            if (!isCurrentlySharing) {
              try {
                const { stdout: browserProcesses } = await execAsync('wmic process where "name=\'chrome.exe\' or name=\'firefox.exe\' or name=\'msedge.exe\'" get commandline /format:csv');
                isCurrentlySharing = browserProcesses.toLowerCase().includes('meet.google.com') || 
                                   browserProcesses.toLowerCase().includes('hangouts.google.com');
              } catch (e) {
                // Ignore if command fails
              }
            }
            
          } catch (error) {
            console.log('Windows detection error:', error.message);
            isCurrentlySharing = false;
          }
        }
        
        if (isCurrentlySharing && !isScreenSharing && !isManuallyHidden) {
          console.log('Screen sharing detected - hiding app from viewers');
          isCurrentlyScreenSharing = true;
          
          if (process.platform === 'darwin') {
            mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
          }
          
          enableContentProtection();
          
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          
          isScreenSharing = true;
          
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('screen-sharing-status', { 
              isScreenSharing: true, 
              message: 'App hidden from screen sharing - you can still use it!' 
            });
          }
        } else if (!isCurrentlySharing && isScreenSharing && !isManuallyHidden) {
          console.log('Screen sharing ended - restoring app visibility');
          isCurrentlyScreenSharing = false;
          
          if (process.platform === 'darwin') {
            mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
          }
          
          disableContentProtection();
          
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          
          mainWindow.focus();
          
          isScreenSharing = false;
          
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('screen-sharing-status', { 
              isScreenSharing: false, 
              message: 'Screen sharing ended - app restored to normal' 
            });
          }
        }
      } catch (error) {
        console.log('Screen sharing detection error:', error.message);
        if (isScreenSharing) {
          console.log('Screen sharing detection failed - restoring app visibility');
          if (process.platform === 'darwin') {
            mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
          }
          disableContentProtection();
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
          isScreenSharing = false;
        }
      }
    }
  }, 500);
}

function enableContentProtection() {
  if (mainWindow && !isContentProtected) {
    try {
      mainWindow.setContentProtection(true);
      isContentProtected = true;
      console.log('Content protection enabled - app protected from screen recording');
    } catch (error) {
      console.log('Failed to enable content protection:', error.message);
    }
  }
}

function disableContentProtection() {
  if (mainWindow && isContentProtected) {
    try {
      mainWindow.setContentProtection(false);
      isContentProtected = false;
      console.log('Content protection disabled');
    } catch (error) {
      console.log('Failed to disable content protection:', error.message);
    }
  }
}

function createOverlayWindow() {
  if (overlayWindow) {
    overlayWindow.close();
  }
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  overlayWindow = new BrowserWindow({
    width: Math.min(1200, width * 0.8),
    height: Math.min(800, height * 0.8),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });
  
  // Load the app - use loadFile for production, loadURL for dev
  if (isDev) {
    overlayWindow.loadURL('http://localhost:3000');
  } else {
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'build', 'index.html');
    
    if (fs.existsSync(indexPath)) {
      overlayWindow.loadFile(indexPath);
    } else {
      const possiblePaths = [
        path.join(__dirname, '..', 'build', 'index.html'),
        path.join(appPath, 'build', 'index.html'),
        path.join(__dirname, 'build', 'index.html'),
      ];
      
      // Add resourcesPath only if it exists (for packaged apps)
      if (process.resourcesPath) {
        possiblePaths.splice(1, 0, path.join(process.resourcesPath, 'app', 'build', 'index.html'));
      }
      
      let foundPath = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          foundPath = possiblePath;
          break;
        }
      }
      
      if (foundPath) {
        overlayWindow.loadFile(foundPath);
      } else {
        console.error('Could not find index.html for overlay window');
      }
    }
  }
  
  // Set bounds only if mainWindow exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    overlayWindow.setBounds(mainWindow.getBounds());
  }
  
  overlayWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });
  
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.show();
  });
  
  console.log('Overlay window created');
}

function hideFromScreenSharing() {
  if (mainWindow) {
    try {
      enableContentProtection();
      
      mainWindow.hide();
      createOverlayWindow();
      
      if (process.platform === 'darwin') {
        mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      }
      
      console.log('App hidden from screen sharing using advanced techniques');
    } catch (error) {
      console.log('Advanced hiding error:', error.message);
      if (process.platform === 'darwin') {
        mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      }
    }
  }
}

function restoreFromScreenSharing(windowStateBeforeHiding) {
  if (mainWindow) {
    try {
      if (overlayWindow) {
        overlayWindow.close();
        overlayWindow = null;
      }
      
      disableContentProtection();
      
      if (process.platform === 'darwin') {
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      }
      
      if (windowStateBeforeHiding && windowStateBeforeHiding.bounds) {
        mainWindow.setBounds(windowStateBeforeHiding.bounds);
      } else {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        const windowWidth = Math.min(1200, width * 0.8);
        const windowHeight = Math.min(800, height * 0.8);
        mainWindow.setBounds({
          x: Math.floor((width - windowWidth) / 2),
          y: Math.floor((height - windowHeight) / 2),
          width: windowWidth,
          height: windowHeight
        });
      }
      
      mainWindow.show();
      mainWindow.focus();
      
      mainWindow.setSkipTaskbar(false);
      mainWindow.setAlwaysOnTop(false);
      
      console.log('App visibility restored to normal');
    } catch (error) {
      console.log('Restoration error:', error.message);
      mainWindow.show();
      mainWindow.focus();
    }
  }
}

function createTray() {
  if (tray) {
    tray.destroy();
  }
  
  const trayIconCandidate = (() => {
    if (process.platform === 'darwin') return path.join(__dirname, 'assets', 'vscode.icns');
    if (process.platform === 'win32') return path.join(__dirname, 'assets', 'vscode.ico');
    return path.join(__dirname, 'assets', 'vscode.png');
  })();
  if (!fs.existsSync(trayIconCandidate)) {
    console.warn('Tray icon not found at', trayIconCandidate, '- skipping tray creation');
    return;
  }
  tray = new Tray(trayIconCandidate);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide from Screen Sharing',
      click: () => {
        if (mainWindow) {
          manuallyHideApp();
        }
      }
    },
    {
      label: 'Restore from Screen Sharing',
      click: () => {
        if (mainWindow) {
          manuallyShowApp();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Cheats App - Screen Sharing Protection');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        try { mainWindow.hide(); } catch {}
      } else {
        try { mainWindow.show(); mainWindow.focus(); } catch {}
      }
    }
  });
  
  console.log('System tray created');
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const windowOptions = {
    width: Math.min(1200, width * 0.8),
    height: Math.min(800, height * 0.8),
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow screen capture
    },
    titleBarStyle: 'hiddenInset',
    show: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    transparent: false,
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true
  };
  const windowIconCandidate = (() => {
    if (process.platform === 'darwin') return path.join(__dirname, 'assets', 'vscode.icns');
    if (process.platform === 'win32') return path.join(__dirname, 'assets', 'vscode.ico');
    return path.join(__dirname, 'assets', 'vscode.png');
  })();
  if (fs.existsSync(windowIconCandidate)) {
    windowOptions.icon = windowIconCandidate;
  }
  mainWindow = new BrowserWindow(windowOptions);

  try { mainWindow.setOpacity(currentOpacity); } catch {}

  const keyFromEnv = process.env.OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY;
  if (keyFromEnv) {
    try { audioService.setApiKey(keyFromEnv); } catch {}
  }

  // Load the app - use loadFile for production, loadURL for dev
  if (isDev) {
    const startUrl = 'http://localhost:3000';
    mainWindow.loadURL(startUrl);
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load dev server:', errorCode, errorDescription);
      console.log('Make sure React dev server is running on http://localhost:3000');
    });
  } else {
    // In production, use app.getAppPath() to get the correct path
    // When packaged, __dirname points to the app's resources directory
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'build', 'index.html');
    
    // Verify the file exists before loading
    if (fs.existsSync(indexPath)) {
      console.log('Loading production build from:', indexPath);
      mainWindow.loadFile(indexPath);
    } else {
      // Fallback: try different possible paths
      const possiblePaths = [
        path.join(__dirname, '..', 'build', 'index.html'),
        path.join(appPath, 'build', 'index.html'),
        path.join(__dirname, 'build', 'index.html'),
      ];
      
      // Add resourcesPath only if it exists (for packaged apps)
      if (process.resourcesPath) {
        possiblePaths.splice(1, 0, path.join(process.resourcesPath, 'app', 'build', 'index.html'));
      }
      
      let foundPath = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          foundPath = possiblePath;
          console.log('Found build at:', foundPath);
          break;
        }
      }
      
      if (foundPath) {
        mainWindow.loadFile(foundPath);
      } else {
        console.error('Could not find index.html in any of these locations:');
        possiblePaths.forEach(p => console.error('  -', p));
        mainWindow.webContents.on('did-finish-load', () => {
          mainWindow.webContents.executeJavaScript(`
            document.body.innerHTML = '<div style="padding: 20px; font-family: system-ui; color: red;">
              <h1>Error: Could not find build files</h1>
              <p>Please rebuild the application:</p>
              <pre>npm run build</pre>
              <p>Build files should be in: ${appPath}/build/</p>
            </div>';
          `);
        });
      }
    }
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load production build:', errorCode, errorDescription);
      console.error('Attempted URL:', validatedURL);
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="padding: 20px; font-family: system-ui; color: red;">
          <h1>Failed to load application</h1>
          <p>Error: ${errorDescription}</p>
          <p>Error Code: ${errorCode}</p>
          <p>Please check the console for more details.</p>
        </div>';
      `);
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.platform === 'darwin') {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  createTray();

  setupScreenSharingDetection();

  mainWindow.on('closed', () => {
    if (overlayWindow) {
      overlayWindow.close();
    }
    if (tray) {
      tray.destroy();
    }
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      if (status !== 'granted') {
        await systemPreferences.askForMediaAccess('microphone');
      }
    } catch (e) {
      console.log('Microphone permission check error:', e?.message || e);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('take-screenshot', async () => {
  console.log('take-screenshot IPC handler called');
  
  try {
    const { desktopCapturer } = require('electron');
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('Hiding window for screenshot...');
      mainWindow.hide();
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('Getting desktop sources...');
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    console.log('Found sources:', sources.length);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('Restoring window...');
      mainWindow.show();
      mainWindow.focus();
    }
    
    if (sources.length > 0) {
      const primaryScreen = sources.find(source => source.name === 'Entire Screen') || sources[0];
      console.log('Using source:', primaryScreen.name);
      
      const pngData = primaryScreen.thumbnail.toPNG();
      console.log('Screenshot data size:', pngData.length, 'bytes');
      
      return pngData;
    }
    
    console.log('No screen sources found');
    throw new Error('No screen sources available. Please check screen recording permissions in System Preferences > Security & Privacy > Privacy > Screen Recording.');
    
  } catch (error) {
    console.error('Screenshot error:', error);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('Restoring window after error...');
      mainWindow.show();
      mainWindow.focus();
    }
    
    throw error;
  }
});

ipcMain.handle('save-file', async (event, content, filename) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, path: result.filePath };
    }
    
    return { success: false, message: 'Save cancelled' };
  } catch (error) {
    console.error('Save file error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-downloads-folder', () => {
  return app.getPath('downloads');
});

function manuallyHideApp() {
  if (mainWindow) {
    try {
      enableContentProtection();
      if (process.platform === 'darwin') {
        try { mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
        try { app.dock?.hide?.(); } catch {}
      }
      try { mainWindow.setSkipTaskbar(true); } catch {}
      try { if (!mainWindow.isVisible()) mainWindow.show(); } catch {}
      try { mainWindow.focus(); } catch {}
      isManuallyHidden = true;
  try { mainWindow?.webContents?.send('visibility-status', { isManuallyHidden: true }); } catch {}
      console.log('App manually hidden from screen sharing (still visible to user)');
      return { success: true, message: 'Hidden from screen sharing' };
    } catch (error) {
      console.log('Manual hide error:', error.message);
      return { success: false, message: error.message };
    }
  }
  return { success: false, message: 'No main window found' };
}

function manuallyShowApp() {
  if (mainWindow) {
    try {
      disableContentProtection();
      try { mainWindow.show(); } catch {}
      try { mainWindow.focus(); } catch {}
      if (process.platform === 'darwin') {
        try { app.dock?.show?.(); } catch {}
      }
      try { mainWindow.setSkipTaskbar(false); } catch {}
      isManuallyHidden = false;
  try { mainWindow?.webContents?.send('visibility-status', { isManuallyHidden: false }); } catch {}
      console.log('App visible to screen sharing');
      return { success: true, message: 'Visible to screen sharing' };
    } catch (error) {
      console.log('Manual show error:', error.message);
      return { success: false, message: error.message };
    }
  }
  return { success: false, message: 'No main window found' };
}

ipcMain.handle('manual-hide-app', () => {
  return manuallyHideApp();
});

ipcMain.handle('manual-show-app', () => {
  return manuallyShowApp();
});

ipcMain.handle('toggle-app-visibility', () => {
  if (isManuallyHidden) {
    return manuallyShowApp();
  } else {
    return manuallyHideApp();
  }
});

ipcMain.handle('get-app-visibility-status', () => {
  return {
    isManuallyHidden: isManuallyHidden,
    isVisible: mainWindow ? mainWindow.isVisible() : false,
    isScreenSharing: isCurrentlyScreenSharing
  };
});

ipcMain.handle('hide-app-window', () => {
  try {
    if (!mainWindow) return { success: false, message: 'No main window found' };
    try { if (process.platform === 'darwin') app.dock?.hide?.(); } catch {}
    try { mainWindow.setSkipTaskbar(true); } catch {}
    try { mainWindow.hide(); } catch {}
    return { success: true };
  } catch (e) {
    return { success: false, message: e?.message || String(e) };
  }
});

ipcMain.handle('show-app-window', () => {
  try {
    if (!mainWindow) return { success: false, message: 'No main window found' };
    try { if (process.platform === 'darwin') app.dock?.show?.(); } catch {}
    try { mainWindow.setSkipTaskbar(false); } catch {}
    try { mainWindow.show(); mainWindow.focus(); } catch {}
    return { success: true };
  } catch (e) {
    return { success: false, message: e?.message || String(e) };
  }
});

ipcMain.handle('get-opacity', () => {
  return { value: currentOpacity, min: MIN_OPACITY, max: MAX_OPACITY, step: OPACITY_STEP };
});

ipcMain.handle('set-opacity', (_e, value) => {
  const v = Math.max(MIN_OPACITY, Math.min(MAX_OPACITY, Number(value) || 1));
  currentOpacity = v;
  try { mainWindow?.setOpacity(currentOpacity); } catch {}
  try { mainWindow?.webContents?.send('opacity-updated', { value: currentOpacity, min: MIN_OPACITY, max: MAX_OPACITY, step: OPACITY_STEP }); } catch {}
  return { value: currentOpacity };
});

ipcMain.handle('increase-opacity', () => {
  const v = Math.min(MAX_OPACITY, currentOpacity + OPACITY_STEP);
  currentOpacity = v;
  try { mainWindow?.setOpacity(currentOpacity); } catch {}
  try { mainWindow?.webContents?.send('opacity-updated', { value: currentOpacity, min: MIN_OPACITY, max: MAX_OPACITY, step: OPACITY_STEP }); } catch {}
  return { value: currentOpacity };
});

ipcMain.handle('decrease-opacity', () => {
  const v = Math.max(MIN_OPACITY, currentOpacity - OPACITY_STEP);
  currentOpacity = v;
  try { mainWindow?.setOpacity(currentOpacity); } catch {}
  try { mainWindow?.webContents?.send('opacity-updated', { value: currentOpacity, min: MIN_OPACITY, max: MAX_OPACITY, step: OPACITY_STEP }); } catch {}
  return { value: currentOpacity };
});

ipcMain.handle('increaseOpacity', () => ipcMain.emit('increase-opacity'));
ipcMain.handle('decreaseOpacity', () => ipcMain.emit('decrease-opacity'));
ipcMain.handle('opacity-increase', () => ipcMain.emit('increase-opacity'));
ipcMain.handle('opacity-decrease', () => ipcMain.emit('decrease-opacity'));

app.whenReady().then(() => {
  const screenshotShortcut = process.platform === 'darwin' ? 'Cmd+H' : 'Ctrl+H';
  globalShortcut.register(screenshotShortcut, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('trigger-screenshot');
      } catch (error) {
        console.error('Error sending screenshot trigger:', error);
      }
    }
  });
  
  const toggleVisibilityShortcut = 'CmdOrCtrl+Shift+V';
  globalShortcut.register(toggleVisibilityShortcut, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        if (isManuallyHidden) {
          manuallyShowApp();
          console.log('App manually restored via shortcut');
        } else {
          manuallyHideApp();
          console.log('App manually hidden via shortcut');
        }
      } catch (error) {
        console.error('Error in hide/show shortcut:', error);
      }
    }
  });

  const moveBy = 50;
  const moveWindow = (dx, dy) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const bounds = mainWindow.getBounds();
      const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
      const workArea = display.workArea;
      const newX = Math.max(workArea.x, Math.min(bounds.x + dx, workArea.x + workArea.width - bounds.width));
      const newY = Math.max(workArea.y, Math.min(bounds.y + dy, workArea.y + workArea.height - bounds.height));
      mainWindow.setBounds({ x: newX, y: newY, width: bounds.width, height: bounds.height }, false);
    } catch {}
  };

  globalShortcut.register('CmdOrCtrl+Up', () => moveWindow(0, -moveBy));
  globalShortcut.register('CmdOrCtrl+Down', () => moveWindow(0, moveBy));
  globalShortcut.register('CmdOrCtrl+Left', () => moveWindow(-moveBy, 0));
  globalShortcut.register('CmdOrCtrl+Right', () => moveWindow(moveBy, 0));

  const applyOpacity = (value) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const clamped = Math.max(MIN_OPACITY, Math.min(MAX_OPACITY, Number(value) || 1));
    currentOpacity = clamped;
    try { mainWindow.setOpacity(currentOpacity); } catch {}
    try {
      mainWindow.webContents.send('opacity-updated', {
        value: currentOpacity,
        min: MIN_OPACITY,
        max: MAX_OPACITY,
        step: OPACITY_STEP,
      });
    } catch {}
  };

  globalShortcut.register('CmdOrCtrl+Alt+,', () => applyOpacity(currentOpacity - OPACITY_STEP));
  globalShortcut.register('CmdOrCtrl+Alt+.', () => applyOpacity(currentOpacity + OPACITY_STEP));
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  audioService.cleanup();
});

ipcMain.handle('start-audio-recording', async () => {
  return await audioService.startRecording();
});

ipcMain.handle('stop-audio-recording', async () => {
  return await audioService.stopRecording();
});

ipcMain.handle('cancel-audio-recording', async () => {
  return await audioService.cancelRecording();
});

ipcMain.handle('get-audio-service-status', () => {
  return audioService.getStatus();
});

ipcMain.handle('extract-questions-from-audio-direct', async () => {
  return await audioService.extractQuestionsFromRawAudio();
});
ipcMain.handle('transcribe-audio-direct', async (_evt, arrayBuffer) => {
  return await audioService.transcribeAudioDirect(Buffer.from(arrayBuffer));
});

ipcMain.handle('set-openai-api-key', async (_evt, key) => {
  return setVendorApiKeyInternal('openai', key);
});

ipcMain.handle('set-vendor-api-key', async (_evt, payload) => {
  const { vendor, key } = payload || {};
  if (!vendorApiKeys.hasOwnProperty(vendor)) {
    return { success: false, error: `Unsupported vendor: ${vendor}` };
  }
  return setVendorApiKeyInternal(vendor, key);
});

ipcMain.handle('get-vendor-api-key', (_evt, vendor) => {
  return vendorApiKeys[vendor] || '';
});

function setVendorApiKeyInternal(vendor, key) {
  const normalizedKey = typeof key === 'string' ? key.trim() : '';
  vendorApiKeys[vendor] = normalizedKey;

  if (vendor === 'openai') {
    const result = audioService.setApiKey(normalizedKey);
    if (!result.success) {
      return result;
    }
    try { mainWindow?.webContents?.send('openai-api-key-updated', normalizedKey); } catch {}
  }

  try {
    mainWindow?.webContents?.send('vendor-api-key-updated', { vendor, key: normalizedKey });
  } catch {}

  return { success: true };
}


