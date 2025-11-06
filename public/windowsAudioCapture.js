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
            return false;
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
            await window.electronAPI.enableLoopbackAudio();
            
            // Add a delay to ensure loopback audio is fully activated
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            console.log('[Windows] Loopback audio enabled successfully');
            return;
            
        } catch (error) {
            lastError = error;
            console.warn(`[Windows] Failed to enable loopback audio (attempt ${attempt}/${maxRetries}):`, error.message);
            
            if (attempt < maxRetries) {
                console.log(`[Windows] Retrying in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
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
            
            // Ensure loopback audio is enabled before each attempt
            await enableLoopbackAudioWithRetry(2, retryDelay);
            
            // Windows requires video: true even if we only want audio
            const displayMediaOptions = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    ...options.audio
                },
                video: true, // Required for Windows
                ...options
            };
            
            console.log('[Windows] Calling getDisplayMedia with options:', displayMediaOptions);
            
            // Capture display media (includes system audio on Windows)
            const displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            
            // Verify we got audio tracks
            const audioTracks = displayStream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('[Windows] No audio tracks found in display stream');
                // Don't throw immediately, try to continue
            } else {
                console.log(`[Windows] Successfully captured system audio with ${audioTracks.length} audio track(s)`);
            }
            
            return displayStream;
            
        } catch (error) {
            lastError = error;
            console.error(`[Windows] Failed to capture system audio (attempt ${attempt}/${maxRetries}):`, error);
            
            // Check if it's a NotSupportedError
            if (error.name === 'NotSupportedError' || error.message?.includes('Not supported')) {
                console.error('[Windows] NotSupportedError detected - this may indicate:');
                console.error('  1. electron-audio-loopback not properly initialized');
                console.error('  2. Windows audio permissions not granted');
                console.error('  3. Audio drivers not supporting loopback capture');
                
                if (attempt < maxRetries) {
                    console.log(`[Windows] Retrying with longer delay (${retryDelay * 2}ms)...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay * 2));
                }
            } else {
                // For other errors, use standard retry delay
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
    }
    
    // Provide helpful error message
    const errorMessage = lastError?.name === 'NotSupportedError' 
        ? 'System audio capture is not supported. Please ensure:\n' +
          '1. Windows audio permissions are granted\n' +
          '2. Audio drivers support loopback capture\n' +
          '3. electron-audio-loopback is properly initialized'
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

