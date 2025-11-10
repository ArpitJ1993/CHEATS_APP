import React from 'react';
import styled from '@emotion/styled';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled.div`
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 14px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: default;
  font-size: 1.5rem;
  padding: 4px;
`;

const ScreenshotImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
`;

const ScreenshotInfo = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  color: white;
  padding: 20px;
  font-size: 14px;
`;

interface ScreenshotModalProps {
  screenshot: {
    id: string;
    data: string;
    timestamp: number;
  } | null;
  onClose: () => void;
}

export const ScreenshotModal: React.FC<ScreenshotModalProps> = ({ screenshot, onClose }) => {
  if (!screenshot) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose}>×</CloseButton>
        <ScreenshotImage 
          src={`data:image/png;base64,${screenshot.data}`} 
          alt="Screenshot" 
        />
        <ScreenshotInfo>
          <div>Screenshot taken: {formatDate(screenshot.timestamp)}</div>
          <div>ID: {screenshot.id}</div>
        </ScreenshotInfo>
      </ModalContent>
    </ModalOverlay>
  );
};
