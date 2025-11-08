import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { Button } from '../core-components/Button';
import { Input } from '../core-components/Input';
import { ResponseWindow } from './ResponseWindow';
import { ScreenshotGallery } from './ScreenshotGallery';
import { VisibilityToggle } from './VisibilityToggle';
import { addScreenshot, removeScreenshot, setCapturing, clearScreenshots } from '../slices/screenshotSlice';
import {
  updateResponse,
  completeResponse,
  clearCurrentConversation,
  startResponse
} from '../slices/conversationSlice';
import { addNotification } from '../slices/appSlice';
import { addError } from '../slices/errorSlice';
import { APIError } from '../data';
import { generateFilename } from '../utils';
import { AudioRecorderComponent } from './AudioRecorderComponent';
import { ThemeToggle } from './ThemeToggle';
import { setCurrentView } from '../slices/appSlice';
import { OpacityControl } from './OpacityControl';
import { createVendorProvider, getVendorMetadata } from '../vendors';
import type { VendorProvider } from '../vendors';

// Declare global window.electronAPI
declare global {
  interface Window {
    electronAPI?: {
      takeScreenshot: () => Promise<Uint8Array>;
      saveFile: (content: string, filename: string) => Promise<{ success: boolean; path?: string; message?: string }>;
      getDownloadsFolder: () => Promise<string>;
      manualHideApp: () => Promise<{ success: boolean; message: string }>;
      manualShowApp: () => Promise<{ success: boolean; message: string }>;
      toggleAppVisibility: () => Promise<{ success: boolean; message: string }>;
      getAppVisibilityStatus: () => Promise<{ isManuallyHidden: boolean; isVisible: boolean; isScreenSharing: boolean }>;
      hideAppWindow: () => Promise<{ success: boolean; message?: string }>;
      showAppWindow: () => Promise<{ success: boolean; message?: string }>;
      onScreenshotTrigger: (callback: (event: any) => void) => void;
      removeScreenshotListener: () => void;
      startAudioRecording: () => Promise<{ success: boolean; message?: string; error?: string }>;
      stopAudioRecording: () => Promise<{ success: boolean; message?: string; error?: string; transcription?: { success: boolean; text?: string; confidence?: number; duration?: number; error?: string } }>;
      cancelAudioRecording: () => Promise<{ success: boolean; message?: string; error?: string }>;
      getAudioServiceStatus: () => Promise<{ isRecording: boolean; bufferSize?: number; platform: string }>;
    };
  }
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--color-background);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  
`;

const Title = styled.h1`
  margin: 0;
  font-size: var(--font-size-large);
  font-weight: 600;
  color: var(--color-text);
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
`;

const ContentArea = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const LeftPanel = styled.div`
  display: flex;
  flex-direction: column;
  width: 400px;
  gap: var(--spacing-md);
  padding: 0px 16px;
  overflow-y: auto;
`;

const RightPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const InputSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  justify-content: space-between;
  margin-top: var(--spacing-md);
`;



export const MainInterface: React.FC = () => {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { items: screenshots } = useSelector((state: RootState) => state.screenshots);
  const { currentResponse, isStreaming } = useSelector((state: RootState) => state.conversations);
  const { settings } = useSelector((state: RootState) => state.settings);

  const vendorMetadata = useMemo(() => getVendorMetadata(settings.vendor), [settings.vendor]);
  const vendorKey = settings.vendorKeys?.[settings.vendor] || '';

  const provider = useMemo<VendorProvider>(() => {
    return createVendorProvider(settings.vendor, vendorKey);
  }, [settings.vendor, vendorKey]);

  const handleAudioTranscription = useCallback((transcribedText: string) => {
    if (transcribedText.trim()) {
      setQuery(prev => prev ? `${prev}\n\n${transcribedText}` : transcribedText);
      dispatch(addNotification({ type: 'success', message: 'Audio recorded successfully!' }));
    }
  }, [dispatch]);

  const handleScreenshotCapture = useCallback(async () => {
    try {
      dispatch(setCapturing(true));
      dispatch(addNotification({ type: 'info', message: 'Taking screenshot... Window will be hidden briefly.' }));
      
      if (window.electronAPI) {
        const screenshotData = await window.electronAPI.takeScreenshot();
        const uint8Array = new Uint8Array(screenshotData);
        let binaryString = '';
        const chunkSize = 8192;
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64Data = btoa(binaryString);
        
        const screenshot = {
          id: Date.now().toString(),
          data: base64Data,
          timestamp: Date.now(),
          size: screenshotData.length,
        };
        
        dispatch(addScreenshot(screenshot));
        dispatch(addNotification({ type: 'success', message: 'Screenshot captured successfully!' }));
      } else {
        dispatch(addError({ type: 'system', message: 'Electron API not available' }));
      }
    } catch (error) {
      console.error('Screenshot capture error:', error);
      dispatch(addError({
        type: 'system',
        message: 'Failed to capture screenshot',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message
        } : String(error)
      }));
    } finally {
      dispatch(setCapturing(false));
    }
  }, [dispatch]);

  const handleScreenshotRemove = useCallback((id: string) => {
    dispatch(removeScreenshot(id));
  }, [dispatch]);

  const handleSubmitQuery = useCallback(async () => {
    const currentQuery = query;
    
    if (!currentQuery.trim() && screenshots.length === 0) {
      dispatch(addNotification({
        type: 'warning',
        message: 'Please provide a text query or capture a screenshot before submitting.'
      }));
      return;
    }

    if (!vendorKey) {
      dispatch(addNotification({
        type: 'warning',
        message: `Add your ${vendorMetadata.label} API key in Settings before submitting.`
      }));
      return;
    }

    if (screenshots.length > 0 && (!provider.streamMultimodal || !provider.supportsImages)) {
      dispatch(addNotification({
        type: 'warning',
        message: `${vendorMetadata.label} does not currently support screenshot analysis in this app.`
      }));
      return;
    }

    setIsSubmitting(true);
    dispatch(startResponse(''));

    try {
      let fullResponse = '';

      const baseMessages = [
        {
          role: 'system' as const,
          content: 'You are an expert AI assistant. Provide accurate, detailed, and helpful responses to user queries. Be thorough in your analysis and explanations.'
        },
        {
          role: 'user' as const,
          content: query
        }
      ];

      const callbacks = {
        onChunk: (chunk: string) => {
          fullResponse += chunk;
          dispatch(updateResponse(fullResponse));
        },
        onComplete: () => {
          dispatch(completeResponse());
          setIsSubmitting(false);
          setQuery('');
          if (screenshots.length > 0) {
            dispatch(clearScreenshots());
          }
        },
        onError: (error: Error) => {
          dispatch(addError({
            type: 'api',
            message: error.message,
            details: error instanceof APIError ? error.toSerializable() : { name: error.name, message: error.message }
          }));
          dispatch(completeResponse());
          setIsSubmitting(false);
        }
      };

      if (screenshots.length > 0) {
         const screenshotsData = screenshots.map((s) => s.data);
         const imageMessages = [
           baseMessages[0],
           {
             role: 'user' as const,
             content: query.trim() || 'Please analyze these screenshots and provide detailed insights.'
           }
         ];
        if (!provider.streamMultimodal) {
          throw new Error('This provider does not support multimodal streaming.');
        }
        await provider.streamMultimodal(imageMessages, screenshotsData, callbacks);
      } else if (query.trim()) {
        await provider.streamText(baseMessages, callbacks);
      }
    } catch (error) {
      console.error('Query submission error:', error);
      dispatch(addError({
        type: 'api',
        message: 'Failed to process request',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message
        } : String(error)
      }));
      dispatch(completeResponse());
      setIsSubmitting(false);
    }
  }, [query, screenshots, dispatch, provider, vendorMetadata.label, vendorKey]);

  const handleReset = useCallback(() => {
    setQuery('');
    dispatch(clearScreenshots());
    dispatch(clearCurrentConversation());
  }, [dispatch]);

  const handleSaveResponse = useCallback(async () => {
    if (!currentResponse) {
      dispatch(addNotification({
        type: 'warning',
        message: 'No response to save'
      }));
      return;
    }

    try {
      const filename = generateFilename();
      const result = await window.electronAPI?.saveFile(currentResponse.content, filename);
      
      if (result?.success) {
        dispatch(addNotification({
          type: 'success',
          message: `Response saved to ${result.path}`
        }));
      } else {
        dispatch(addNotification({
          type: 'error',
          message: result?.message || 'Failed to save response'
        }));
      }
    } catch (error) {
      dispatch(addError({
        type: 'system',
        message: 'Failed to save response',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message
        } : String(error)
      }));
    }
  }, [currentResponse, dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'h':
            e.preventDefault();
            handleScreenshotCapture();
            break;
          case 'r':
            e.preventDefault();
            handleReset();
            break;
          case 's':
            e.preventDefault();
            handleSaveResponse();
            break;
          case 'Enter':
            if (e.shiftKey) {
              e.preventDefault();
              handleSubmitQuery();
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleScreenshotCapture, handleReset, handleSaveResponse, handleSubmitQuery]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onScreenshotTrigger(() => {
        handleScreenshotCapture();
      });
    }

    return () => {
      window.electronAPI?.removeScreenshotListener();
    };
  }, [handleScreenshotCapture]);

  return (
    <Container>
      <Header>
        <Title>Arpit's AI Assistant</Title>
        <ControlsRow>
          <Button variant="outlined" onClick={() => dispatch(setCurrentView('settings'))}>
            ⚙ Settings
          </Button>
          <Button variant="outlined" onClick={() => dispatch(setCurrentView('meetings'))}>
            🎤 Meetings
          </Button>
          <ThemeToggle />
          <VisibilityToggle />
          <OpacityControl />
        </ControlsRow>
      </Header>

      <ContentArea>
        <LeftPanel>
          <InputSection>
            <Input
              value={query}
              onChange={setQuery}
              placeholder="Enter your query here..."
              multiline
              rows={3}
            />
            
            <ButtonGroup>
              <Button
                variant="outlined"
                onClick={handleScreenshotCapture}
                disabled={screenshots.length >= settings.maxScreenshots}
              >
                📷 Screenshot (Hides App) ({screenshots.length}/{settings.maxScreenshots})
              </Button>
            </ButtonGroup>

            <AudioRecorderComponent 
              onTranscriptionComplete={handleAudioTranscription}
              disabled={isSubmitting || !vendorMetadata.supportsAudioRecorder}
            />
            {!vendorMetadata.supportsAudioRecorder && (
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                Voice recording is currently available only with vendors that support this feature (e.g., OpenAI).
              </span>
            )}
          </InputSection>

          <ScreenshotGallery 
            screenshots={screenshots} 
            onRemove={handleScreenshotRemove} 
          />
        </LeftPanel>

        <RightPanel>
          <ResponseWindow 
            response={currentResponse}
            isStreaming={isStreaming}
          />
          
          <ActionButtons>
            <Button variant="outlined" onClick={handleReset}>
              Reset
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSubmitQuery}
              disabled={isSubmitting}
            >
              Submit
            </Button>
            <Button variant="secondary" onClick={handleSaveResponse}>
              Save
            </Button>
          </ActionButtons>
        </RightPanel>
      </ContentArea>
    </Container>
  );
};