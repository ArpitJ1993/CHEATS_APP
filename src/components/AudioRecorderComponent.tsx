import React, { useState, useEffect, useCallback } from "react";
import styled from "@emotion/styled";
import { Button } from "../core-components/Button";

const AudioContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
`;

const RecordingStatus = styled.div<{ isRecording: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius);
  background-color: ${(props) =>
    props.isRecording
      ? "var(--color-error-light)"
      : "var(--color-background-light)"};
  color: ${(props) =>
    props.isRecording ? "var(--color-error)" : "var(--color-text)"};
  font-size: 0.875rem;
  transition: all 0.2s ease;
`;

const RecordingIndicator = styled.div<{ isRecording: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${(props) =>
    props.isRecording ? "var(--color-error)" : "var(--color-text-muted)"};
  animation: ${(props) => (props.isRecording ? "pulse 1s infinite" : "none")};

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
    100% {
      opacity: 1;
    }
  }
`;

const AudioControls = styled.div`
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
`;

const ErrorMessage = styled.div`
  padding: var(--spacing-sm);
  background-color: var(--color-error-light);
  border-radius: var(--border-radius);
  border: 1px solid var(--color-error);
  font-size: 0.875rem;
  color: var(--color-error);
`;

const InfoMessage = styled.div`
  padding: var(--spacing-sm);
  background-color: var(--color-info-light);
  border-radius: var(--border-radius);
  border: 1px solid var(--color-info);
  font-size: 0.875rem;
  color: var(--color-info);
`;

const SuccessMessage = styled.div`
  padding: var(--spacing-sm);
  background-color: var(--color-success-light);
  border-radius: var(--border-radius);
  border: 1px solid var(--color-success);
  font-size: 0.875rem;
  color: var(--color-success);
`;

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  disabled?: boolean;
}

export const AudioRecorderComponent: React.FC<AudioRecorderProps> = ({
  onTranscriptionComplete,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localRecorder, setLocalRecorder] = useState<MediaRecorder | null>(
    null
  );
  const localChunksRef = React.useRef<BlobPart[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing || disabled) return;

    try {
      setError("");
      setIsRecording(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      localChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) localChunksRef.current.push(e.data);
      };
      mr.onerror = (e) => console.error("MediaRecorder error", e);
      mr.start(500);
      setLocalStream(stream);
      setLocalRecorder(mr);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setError(
        `Failed to start recording: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setIsRecording(false);
    }
  }, [isRecording, isProcessing, disabled]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    try {
      setIsProcessing(true);
      setIsRecording(false);

      if (localRecorder) {
        await new Promise<void>((resolve) => {
          localRecorder.onstop = () => resolve();
          localRecorder.stop();
        });
        const stream = localStream;
        stream?.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        setLocalRecorder(null);
        const blob = new Blob(localChunksRef.current, { type: "audio/webm" });
        localChunksRef.current = [];
        const buf = await blob.arrayBuffer();
        const direct = await (
          window as any
        ).electronAPI?.transcribeAudioDirect?.(buf);
        if (direct?.success && direct?.text) {
          onTranscriptionComplete(direct.text);
        } else {
          setError(direct?.error || "Recording failed");
        }
      }
    } catch (error) {
      console.error("Failed to complete recording:", error);
      setError(
        `Failed to process audio: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording, onTranscriptionComplete, localRecorder, localStream]);

  const cancelRecording = useCallback(async () => {
    if (!isRecording) return;

    try {
      await window.electronAPI!.cancelAudioRecording();
      setIsRecording(false);
      setIsProcessing(false);
      setError("");
    } catch (error) {
      console.error("Failed to cancel recording:", error);
      setError("Failed to cancel recording.");
    }
  }, [isRecording]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!window.electronAPI) {
    return (
      <AudioContainer>
        <ErrorMessage>
          Audio recording is only available in the desktop app. Please use the
          Electron version.
        </ErrorMessage>
      </AudioContainer>
    );
  }

  return (
    <AudioContainer>
      <RecordingStatus isRecording={isRecording}>
        <RecordingIndicator isRecording={isRecording} />
        {isRecording
          ? `Recording... ${formatDuration(recordingDuration)}`
          : isProcessing
          ? "Processing audio..."
          : "Ready to record"}
      </RecordingStatus>

      <AudioControls>
        <Button
          variant={isRecording ? "secondary" : "outlined"}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isProcessing}
          size="small"
        >
          {isRecording ? "⏹️ Stop Recording" : "🎤 Start Recording"}
        </Button>

        {isRecording && (
          <Button
            variant="secondary"
            onClick={cancelRecording}
            disabled={disabled}
            size="small"
          >
            Cancel
          </Button>
        )}
      </AudioControls>

      {error && <ErrorMessage>{error}</ErrorMessage>}
    </AudioContainer>
  );
};
