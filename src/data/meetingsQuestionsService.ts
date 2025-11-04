export interface ExtractedQuestion {
  q: string;
  s: 'microphone' | 'system';
}

export interface ExtractQuestionsResult {
  success: boolean;
  questions?: ExtractedQuestion[];
  transcript?: string;
  error?: string;
}

export async function extractQuestionsFromBufferedAudio(): Promise<ExtractQuestionsResult> {
  const electronAPI = (window as any).electronAPI as {
    extractQuestionsFromAudio?: () => Promise<ExtractQuestionsResult>;
    extractQuestionsFromAudioDirect?: () => Promise<ExtractQuestionsResult>;
  } | undefined;

  if (!electronAPI?.extractQuestionsFromAudio) {
    return { success: false, error: 'IPC not available: extractQuestionsFromAudio' };
  }
  try {
    return await electronAPI.extractQuestionsFromAudio();
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function extractQuestionsFromBufferedAudioDirect(): Promise<ExtractQuestionsResult> {
  const electronAPI = (window as any).electronAPI as {
    extractQuestionsFromAudioDirect?: () => Promise<ExtractQuestionsResult>;
  } | undefined;

  if (!electronAPI?.extractQuestionsFromAudioDirect) {
    return { success: false, error: 'IPC not available: extractQuestionsFromAudioDirect' };
  }
  try {
    return await electronAPI.extractQuestionsFromAudioDirect();
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}


