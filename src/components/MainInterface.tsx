import React, { useState, useEffect, useCallback } from 'react';
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
import OpenAIService from '../data/openaiService';
import { AudioRecorderComponent } from './AudioRecorderComponent';
import { ThemeToggle } from './ThemeToggle';
import { setCurrentView } from '../slices/appSlice';
import { OpacityControl } from './OpacityControl';

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

  // Initialize OpenAI service
  const [openaiService] = useState(() => {
    const apiKey = settings.apiKey || process.env.OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY;
    return new OpenAIService(apiKey);
  });

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

    setIsSubmitting(true);
    dispatch(startResponse(''));

    try {
      let fullResponse = '';

      if (screenshots.length > 0) {
        const screenshotsData = screenshots.map(s => s.data);
        
        const messages = [
          {
            role: 'system' as const,
            content: 'You are an expert AI assistant with advanced image analysis capabilities. You can see and analyze screenshots, diagrams, code, UI elements, and any visual content. Provide detailed, accurate, and helpful analysis of the images provided. If the user asks specific questions about the images, answer them thoroughly. If no specific question is asked, provide a comprehensive analysis of what you see in the screenshots.',
          },
          {
            role: 'user' as const,
            content: query.trim() || 'Please analyze these screenshots and provide detailed insights about what you see. Describe the content, identify any important elements, and provide helpful observations.',
          },
        ];
        
        fullResponse = await openaiService.sendMessageWithImages(
          messages,
          screenshotsData,
          (chunk) => {
            fullResponse += chunk;
            dispatch(updateResponse(fullResponse));
          },
          () => {
            dispatch(completeResponse());
            setIsSubmitting(false);
            setQuery('');
            dispatch(clearScreenshots());
          },
          (error) => {
            console.error('Multimodal API error:', error);
            dispatch(addError({
              type: 'api',
              message: error.message,
              details: error instanceof APIError ? error.toSerializable() : { name: (error as Error).name, message: (error as Error).message }
            }));
            setIsSubmitting(false);
          }
        );
      } else if (query.trim()) {
        const messages = [
          {
            role: 'system' as const,
            content: 'You are an expert AI assistant powered by GPT-4. Provide accurate, detailed, and helpful responses to user queries. Be thorough in your analysis and explanations.',
          },
          {
            role: 'user' as const,
            content: query,
          },
        ];

        fullResponse = await openaiService.sendMessage(
          messages,
          (chunk) => {
            fullResponse += chunk;
            dispatch(updateResponse(fullResponse));
          },
          () => {
            dispatch(completeResponse());
            setIsSubmitting(false);
            setQuery('');
          },
          (error) => {
            console.error('Text-only API error:', error);
            dispatch(addError({
              type: 'api',
              message: error.message,
              details: error instanceof APIError ? error.toSerializable() : { name: (error as Error).name, message: (error as Error).message }
            }));
            setIsSubmitting(false);
          }
        );
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
      setIsSubmitting(false);
    }
  }, [query, screenshots, dispatch, openaiService]);

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
              disabled={isSubmitting}
            />
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