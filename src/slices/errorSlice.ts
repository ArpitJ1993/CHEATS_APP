import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppError } from '../types';

interface ErrorSliceState {
  errors: AppError[];
  maxErrors: number;
}

const initialState: ErrorSliceState = {
  errors: [],
  maxErrors: 10,
};

const errorSlice = createSlice({
  name: 'errors',
  initialState,
  reducers: {
    addError: (state, action: PayloadAction<Omit<AppError, 'id' | 'timestamp' | 'resolved'>>) => {
      const error: AppError = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: Date.now(),
        resolved: false,
      };
      
      state.errors.unshift(error);
      
      // Keep only the most recent errors
      if (state.errors.length > state.maxErrors) {
        state.errors = state.errors.slice(0, state.maxErrors);
      }
    },
    resolveError: (state, action: PayloadAction<string>) => {
      const error = state.errors.find(e => e.id === action.payload);
      if (error) {
        error.resolved = true;
      }
    },
    removeError: (state, action: PayloadAction<string>) => {
      state.errors = state.errors.filter(e => e.id !== action.payload);
    },
    clearErrors: (state) => {
      state.errors = [];
    },
    clearResolvedErrors: (state) => {
      state.errors = state.errors.filter(e => !e.resolved);
    },
    setMaxErrors: (state, action: PayloadAction<number>) => {
      state.maxErrors = action.payload;
    },
  },
});

export const {
  addError,
  resolveError,
  removeError,
  clearErrors,
  clearResolvedErrors,
  setMaxErrors,
} = errorSlice.actions;

export { errorSlice };
