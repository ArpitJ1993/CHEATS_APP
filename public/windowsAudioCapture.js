/**
 * Windows-specific audio capture helper
 * This module handles system audio capture on Windows with proper error handling,
 * retry logic, and validation to work around Windows-specific limitations.
 */

/**
 * Detects if running on Windows platform
 * @returns {boolean} True if running on Windows
 */
function isWindows() {
    if (typeof navigator !== 'undefined' && navigator.platform) {
        return navigator.platform.toLowerCase().includes('win');
    }
    return false;
}

/**
 * Validates that electron-audio-loopback is properly initialized
 * @returns {Promise<boolean>} True if loopback audio can be enabled
 */
async function validateLoopbackAudio() {
    try {
        if (!window?.electronAPI?.enableLoopbackAudio) {
            console.error('[Windows] enableLoopbackAudio API not available');
            console.error('[Windows] Available electronAPI methods:', Object.keys(window?.electronAPI || {}));
            return false;
        }
        
        // Try to check if the IPC handler exists by attempting a test call
        // We'll catch any errors and just log them
        try {
            const testResult = await window.electronAPI.enableLoopbackAudio();
            if (testResult && testResult.error) {
                console.error('[Windows] enableLoopbackAudio returned error:', testResult.error);
                return false;
            }
            // Immediately disable if test succeeded
            if (window?.electronAPI?.disableLoopbackAudio) {
                await window.electronAPI.disableLoopbackAudio().catch(() => {});
            }
        } catch (testError) {
            console.warn('[Windows] Test call to enableLoopbackAudio failed:', testError.message);
            // Don't return false here - the handler might exist but fail for other reasons
        }
        
        return true;
    } catch (error) {
        console.error('[Windows] Error validating loopback audio:', error);
        return false;
    }
}

/**
 * Enables loopback audio with retry logic for Windows
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise<void>}
 */
async function enableLoopbackAudioWithRetry(maxRetries = 3, retryDelay = 500) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Windows] Attempting to enable loopback audio (attempt ${attempt}/${maxRetries})`);
            
            // Validate API availability first
            if (!await validateLoopbackAudio()) {
                throw new Error('Loopback audio API not available');
            }
            
            // Enable loopback audio
            const result = await window.electronAPI.enableLoopbackAudio();
            
            // Check if enableLoopbackAudio returned an error
            if (result && result.error) {
                throw new Error(result.error);
            }
            
            // Add a longer delay to ensure loopback audio plugin is fully ready
            // The plugin needs time to intercept getDisplayMedia calls
            const activationDelay = attempt === 1 ? 1000 : retryDelay; // Longer delay on first attempt
            console.log(`[Windows] Waiting ${activationDelay}ms for loopback audio to activate...`);
            await new Promise(resolve => setTimeout(resolve, activationDelay));
            
            console.log('[Windows] Loopback audio enabled successfully');
            return;
            
        } catch (error) {
            lastError = error;
            console.warn(`[Windows] Failed to enable loopback audio (attempt ${attempt}/${maxRetries}):`, error.message);
            
            if (attempt < maxRetries) {
                const waitTime = attempt * retryDelay; // Exponential backoff
                console.log(`[Windows] Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    throw new Error(`Failed to enable loopback audio after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Captures system audio using getDisplayMedia with Windows-specific handling
 * @param {Object} options - Display media options
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise<MediaStream>} MediaStream containing system audio
 */
async function captureSystemAudioWindows(options = {}, maxRetries = 3, retryDelay = 500) {
    // Validate getDisplayMedia availability
    if (!navigator?.mediaDevices?.getDisplayMedia) {
        throw new Error('getDisplayMedia API is not supported in this browser/environment');
    }
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Windows] Attempting to capture system audio (attempt ${attempt}/${maxRetries})`);
            
            // Ensure loopback audio is enabled before each attempt with longer delay
            // Use longer delay to ensure plugin has time to intercept getDisplayMedia
            await enableLoopbackAudioWithRetry(2, 800);
            
            // Add additional delay after enabling loopback to ensure plugin is ready
            // This is critical - the plugin needs time to set up its interception
            const pluginReadyDelay = attempt === 1 ? 1500 : 800;
            console.log(`[Windows] Waiting ${pluginReadyDelay}ms for plugin to be ready...`);
            await new Promise(resolve => setTimeout(resolve, pluginReadyDelay));
            
            // Windows requires video: true even if we only want audio
            // According to electron-audio-loopback docs, video MUST be true
            const displayMediaOptions = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    ...options.audio
                },
                video: true, // REQUIRED - plugin won't work without this
                ...options
            };
            
            // Remove any video-specific options that might interfere
            delete displayMediaOptions.video;
            displayMediaOptions.video = true; // Ensure video is explicitly true
            
            console.log('[Windows] Calling getDisplayMedia with options:', JSON.stringify(displayMediaOptions, null, 2));
            
            // Capture display media (includes system audio on Windows)
            // The electron-audio-loopback plugin intercepts this call
            const displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            
            // Verify we got audio tracks
            const audioTracks = displayStream.getAudioTracks();
            const videoTracks = displayStream.getVideoTracks();
            
            console.log(`[Windows] Stream obtained - Audio tracks: ${audioTracks.length}, Video tracks: ${videoTracks.length}`);
            
            if (audioTracks.length === 0) {
                console.warn('[Windows] No audio tracks found in display stream - this may indicate the plugin did not intercept properly');
                // Still return the stream - it might have audio even if tracks aren't detected
            } else {
                console.log(`[Windows] Successfully captured system audio with ${audioTracks.length} audio track(s)`);
                audioTracks.forEach((track, index) => {
                    console.log(`[Windows] Audio track ${index + 1}:`, {
                        id: track.id,
                        label: track.label,
                        enabled: track.enabled,
                        muted: track.muted,
                        readyState: track.readyState
                    });
                });
            }
            
            return displayStream;
            
        } catch (error) {
            lastError = error;
            console.error(`[Windows] Failed to capture system audio (attempt ${attempt}/${maxRetries}):`, error);
            console.error('[Windows] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // Check if it's a NotSupportedError
            if (error.name === 'NotSupportedError' || error.message?.includes('Not supported')) {
                console.error('[Windows] NotSupportedError detected - this may indicate:');
                console.error('  1. electron-audio-loopback not properly initialized in main process');
                console.error('  2. Windows audio permissions not granted');
                console.error('  3. Audio drivers not supporting loopback capture');
                console.error('  4. Plugin did not intercept getDisplayMedia call (timing issue)');
                
                if (attempt < maxRetries) {
                    const waitTime = attempt * 1000; // Longer wait for NotSupportedError
                    console.log(`[Windows] Retrying with longer delay (${waitTime}ms)...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            } else {
                // For other errors, use standard retry delay
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
    }
    
    // Provide helpful error message with troubleshooting steps
    const errorMessage = lastError?.name === 'NotSupportedError' 
        ? 'System audio capture is not supported on Windows. Troubleshooting steps:\n\n' +
          '1. Ensure electron-audio-loopback is properly initialized (check main process console)\n' +
          '2. Grant Windows audio permissions in Settings > Privacy > Microphone\n' +
          '3. Update audio drivers to latest version\n' +
          '4. Restart the application after granting permissions\n' +
          '5. Check if other applications can capture system audio\n\n' +
          'If the issue persists, this may be a limitation of your Windows audio drivers.'
        : `Failed to capture system audio after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`;
    
    throw new Error(errorMessage);
}

/**
 * Disables loopback audio with error handling
 * @returns {Promise<void>}
 */
async function disableLoopbackAudioSafe() {
    try {
        if (window?.electronAPI?.disableLoopbackAudio) {
            await window.electronAPI.disableLoopbackAudio();
            console.log('[Windows] Loopback audio disabled successfully');
        } else {
            console.warn('[Windows] disableLoopbackAudio API not available');
        }
    } catch (error) {
        console.error('[Windows] Error disabling loopback audio:', error);
        // Don't throw - this is cleanup, failure is not critical
    }
}

/**
 * Main function to capture system audio on Windows
 * This is the entry point that should be called from meetingsRenderer.js
 * @param {Object} options - Display media options
 * @returns {Promise<MediaStream>} MediaStream containing system audio (video tracks removed)
 */
async function captureWindowsSystemAudio(options = {}) {
    if (!isWindows()) {
        throw new Error('This function is only for Windows platform');
    }
    
    let displayStream = null;
    
    try {
        // Capture system audio with Windows-specific handling
        displayStream = await captureSystemAudioWindows(options);
        
        // Remove video tracks as per electron-audio-loopback documentation
        const videoTracks = displayStream.getVideoTracks();
        videoTracks.forEach(track => {
            track.stop();
            displayStream.removeTrack(track);
        });
        
        console.log('[Windows] System audio stream prepared successfully');
        
        return displayStream;
        
    } catch (error) {
        // Ensure cleanup on error
        if (displayStream) {
            displayStream.getTracks().forEach(track => track.stop());
        }
        await disableLoopbackAudioSafe();
        throw error;
    }
}

// Export functions for use in meetingsRenderer.js
if (typeof window !== 'undefined') {
    window.WindowsAudioCapture = {
        captureWindowsSystemAudio,
        enableLoopbackAudioWithRetry,
        disableLoopbackAudioSafe,
        isWindows,
        validateLoopbackAudio
    };
}

// For Node.js/CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        captureWindowsSystemAudio,
        enableLoopbackAudioWithRetry,
        disableLoopbackAudioSafe,
        isWindows,
        validateLoopbackAudio
    };
}


