import { configureStore } from '@reduxjs/toolkit';
import { themeSlice } from '../slices/themeSlice';
import { appSlice } from '../slices/appSlice';
import { screenshotSlice } from '../slices/screenshotSlice';
import { conversationSlice } from '../slices/conversationSlice';
import { settingsSlice } from '../slices/settingsSlice';
import { errorSlice } from '../slices/errorSlice';

export const store = configureStore({
  reducer: {
    theme: themeSlice.reducer,
    app: appSlice.reducer,
    screenshots: screenshotSlice.reducer,
    conversations: conversationSlice.reducer,
    settings: settingsSlice.reducer,
    errors: errorSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['screenshots/addScreenshot'],
        ignoredPaths: ['screenshots.items.data'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
