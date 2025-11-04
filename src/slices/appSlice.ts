import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppVisibility, LoadingState } from '../enums';
import { LoadingState as LoadingStateType } from '../types';

interface AppState {
  visibility: AppVisibility;
  isLoading: boolean;
  loadingMessage: string;
  currentView: 'main' | 'settings' | 'history' | 'meetings';
  isFullscreen: boolean;
  windowSize: {
    width: number;
    height: number;
  };
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>;
}

const initialState: AppState = {
  visibility: AppVisibility.VISIBLE,
  isLoading: false,
  loadingMessage: '',
  currentView: 'main',
  isFullscreen: false,
  windowSize: {
    width: 1200,
    height: 800,
  },
  notifications: [],
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setVisibility: (state, action: PayloadAction<AppVisibility>) => {
      state.visibility = action.payload;
    },
    toggleVisibility: (state) => {
      state.visibility = state.visibility === AppVisibility.VISIBLE 
        ? AppVisibility.HIDDEN 
        : AppVisibility.VISIBLE;
    },
    setLoading: (state, action: PayloadAction<{ isLoading: boolean; message?: string }>) => {
      state.isLoading = action.payload.isLoading;
      state.loadingMessage = action.payload.message || '';
    },
    setCurrentView: (state, action: PayloadAction<'main' | 'settings' | 'history' | 'meetings'>) => {
      state.currentView = action.payload;
    },
    setFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isFullscreen = action.payload;
    },
    setWindowSize: (state, action: PayloadAction<{ width: number; height: number }>) => {
      state.windowSize = action.payload;
    },
    addNotification: (state, action: PayloadAction<{
      type: 'success' | 'error' | 'warning' | 'info';
      message: string;
    }>) => {
      const notification = {
        id: Date.now().toString(),
        ...action.payload,
        timestamp: Date.now(),
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
  },
});

export const {
  setVisibility,
  toggleVisibility,
  setLoading,
  setCurrentView,
  setFullscreen,
  setWindowSize,
  addNotification,
  removeNotification,
  clearNotifications,
} = appSlice.actions;

export { appSlice };
