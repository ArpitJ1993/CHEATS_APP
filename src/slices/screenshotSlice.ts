import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Screenshot, ScreenshotState } from '../types';
import { ScreenshotState as ScreenshotStateEnum } from '../enums';

interface ScreenshotSliceState {
  items: Screenshot[];
  state: ScreenshotStateEnum;
  maxCount: number;
  maxSize: number; // in bytes
  isCapturing: boolean;
  error: string | null;
}

const initialState: ScreenshotSliceState = {
  items: [],
  state: ScreenshotStateEnum.IDLE,
  maxCount: 5,
  maxSize: 10 * 1024 * 1024, // 10MB
  isCapturing: false,
  error: null,
};

const screenshotSlice = createSlice({
  name: 'screenshots',
  initialState,
  reducers: {
    addScreenshot: (state, action: PayloadAction<Screenshot>) => {
      if (state.items.length >= state.maxCount) {
        state.error = 'Maximum number of screenshots reached';
        return;
      }
      
      if (action.payload.size > state.maxSize) {
        state.error = 'Screenshot size exceeds maximum allowed size';
        return;
      }

      state.items.push(action.payload);
      state.error = null;
    },
    removeScreenshot: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
    },
    clearScreenshots: (state) => {
      state.items = [];
      state.error = null;
    },
    reorderScreenshots: (state, action: PayloadAction<{ from: number; to: number }>) => {
      const { from, to } = action.payload;
      const item = state.items[from];
      state.items.splice(from, 1);
      state.items.splice(to, 0, item);
    },
    setScreenshotState: (state, action: PayloadAction<ScreenshotStateEnum>) => {
      state.state = action.payload;
    },
    setCapturing: (state, action: PayloadAction<boolean>) => {
      state.isCapturing = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setMaxCount: (state, action: PayloadAction<number>) => {
      state.maxCount = action.payload;
    },
    setMaxSize: (state, action: PayloadAction<number>) => {
      state.maxSize = action.payload;
    },
  },
});

export const {
  addScreenshot,
  removeScreenshot,
  clearScreenshots,
  reorderScreenshots,
  setScreenshotState,
  setCapturing,
  setError,
  setMaxCount,
  setMaxSize,
} = screenshotSlice.actions;

export { screenshotSlice };
