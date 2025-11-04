import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Conversation, UserQuery, AIResponse } from '../types';

interface ConversationSliceState {
  currentConversation: Conversation | null;
  conversations: Conversation[];
  currentQuery: UserQuery | null;
  currentResponse: AIResponse | null;
  isStreaming: boolean;
  error: string | null;
}

const initialState: ConversationSliceState = {
  currentConversation: null,
  conversations: [],
  currentQuery: null,
  currentResponse: null,
  isStreaming: false,
  error: null,
};

const conversationSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    createConversation: (state) => {
      const conversation: Conversation = {
        id: Date.now().toString(),
        queries: [],
        responses: [],
        timestamp: Date.now(),
      };
      state.currentConversation = conversation;
      state.conversations.push(conversation);
    },
    setCurrentQuery: (state, action: PayloadAction<UserQuery>) => {
      state.currentQuery = action.payload;
      if (state.currentConversation) {
        state.currentConversation.queries.push(action.payload);
      }
    },
    startResponse: (state, action: PayloadAction<string>) => {
      const response: AIResponse = {
        id: Date.now().toString(),
        content: action.payload,
        timestamp: Date.now(),
        isStreaming: true,
        isComplete: false,
      };
      state.currentResponse = response;
      state.isStreaming = true;
      state.error = null;
    },
    updateResponse: (state, action: PayloadAction<string>) => {
      if (state.currentResponse) {
        state.currentResponse.content = action.payload;
      }
    },
    completeResponse: (state) => {
      if (state.currentResponse) {
        state.currentResponse.isStreaming = false;
        state.currentResponse.isComplete = true;
        if (state.currentConversation) {
          state.currentConversation.responses.push(state.currentResponse);
        }
      }
      state.isStreaming = false;
    },
    clearCurrentConversation: (state) => {
      state.currentQuery = null;
      state.currentResponse = null;
      state.isStreaming = false;
      state.error = null;
    },
    resetConversation: (state) => {
      state.currentConversation = null;
      state.currentQuery = null;
      state.currentResponse = null;
      state.isStreaming = false;
      state.error = null;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isStreaming = false;
    },
    archiveConversation: (state, action: PayloadAction<string>) => {
      const conversation = state.conversations.find(c => c.id === action.payload);
      if (conversation) {
        // Mark as archived (you could add a status field to Conversation type)
        state.conversations = state.conversations.filter(c => c.id !== action.payload);
      }
    },
    deleteConversation: (state, action: PayloadAction<string>) => {
      state.conversations = state.conversations.filter(c => c.id !== action.payload);
      if (state.currentConversation?.id === action.payload) {
        state.currentConversation = null;
        state.currentQuery = null;
        state.currentResponse = null;
      }
    },
    loadConversation: (state, action: PayloadAction<string>) => {
      const conversation = state.conversations.find(c => c.id === action.payload);
      if (conversation) {
        state.currentConversation = conversation;
        // Set the last query and response as current
        const lastQuery = conversation.queries[conversation.queries.length - 1];
        const lastResponse = conversation.responses[conversation.responses.length - 1];
        state.currentQuery = lastQuery || null;
        state.currentResponse = lastResponse || null;
      }
    },
  },
});

export const {
  createConversation,
  setCurrentQuery,
  startResponse,
  updateResponse,
  completeResponse,
  clearCurrentConversation,
  resetConversation,
  setError,
  archiveConversation,
  deleteConversation,
  loadConversation,
} = conversationSlice.actions;

export { conversationSlice };
