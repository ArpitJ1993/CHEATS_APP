import React, { useState } from 'react';
import styled from '@emotion/styled';
import { Screenshot } from '../types';
import { Button } from '../core-components/Button';
import { ScreenshotModal } from './ScreenshotModal';
import { formatFileSize } from '../utils';

const GalleryContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`;

const GalleryTitle = styled.h3`
  margin: 0;
  font-size: var(--font-size-medium);
  font-weight: 500;
  color: var(--color-text);
`;

const ScreenshotGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-sm);
`;

const ScreenshotItem = styled.div<{ isSelected: boolean }>`
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.02);
  cursor: default;
  outline: ${(props) => (props.isSelected ? '2px solid var(--color-primary)' : 'none')};
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const ScreenshotImage = styled.img`
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
`;

const ScreenshotInfo = styled.div`
  padding: var(--spacing-xs);
  background-color: var(--color-surface);
`;

const ScreenshotMeta = styled.div`
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
`;

const ScreenshotActions = styled.div`
  display: flex;
  gap: var(--spacing-xs);
`;

const RemoveButton = styled(Button)`
  flex: 1;
  font-size: var(--font-size-small);
  padding: 4px 8px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  text-align: center;
`;

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  onRemove?: (id: string) => void;
  onReorder?: (from: number, to: number) => void;
}

export const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({
  screenshots,
  onRemove,
  onReorder
}) => {
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);

  const handleRemove = (id: string) => {
    onRemove?.(id);
  };

  const handleScreenshotClick = (screenshot: Screenshot) => {
    setSelectedScreenshot(screenshot);
  };

  const handleCloseModal = () => {
    setSelectedScreenshot(null);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (screenshots.length === 0) {
    return (
      <GalleryContainer>
        <GalleryTitle>Screenshots</GalleryTitle>
        <EmptyState>
          📸 No screenshots captured yet
          <br />
          <small>Press Cmd+H (Mac) or Ctrl+H (Windows) to capture</small>
        </EmptyState>
      </GalleryContainer>
    );
  }

  return (
    <GalleryContainer>
      <GalleryTitle>Screenshots ({screenshots.length})</GalleryTitle>
      <ScreenshotGrid>
        {screenshots.map((screenshot, index) => (
          <ScreenshotItem
            key={screenshot.id}
            isSelected={selectedScreenshot?.id === screenshot.id}
            onClick={() => handleScreenshotClick(screenshot)}
          >
            <ScreenshotImage
              src={`data:image/png;base64,${screenshot.data}`}
              alt={`Screenshot ${index + 1}`}
            />
            <ScreenshotInfo>
              <ScreenshotMeta>
                {formatTimestamp(screenshot.timestamp)}
                <br />
                {formatFileSize(screenshot.size)}
              </ScreenshotMeta>
              <ScreenshotActions>
                <RemoveButton
                  variant="text"
                  size="small"
                  onClick={(e) => {
                    e?.stopPropagation();
                    handleRemove(screenshot.id);
                  }}
                >
                  Remove
                </RemoveButton>
              </ScreenshotActions>
            </ScreenshotInfo>
          </ScreenshotItem>
        ))}
      </ScreenshotGrid>
      <ScreenshotModal 
        screenshot={selectedScreenshot} 
        onClose={handleCloseModal} 
      />
    </GalleryContainer>
  );
};
