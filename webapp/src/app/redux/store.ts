import { configureStore } from '@reduxjs/toolkit';
import blogsReducer from './slices/blogSlice';

export interface RootState {
  blogs: ReturnType<typeof blogsReducer>;
}

// Configure the store
const store = configureStore({
  reducer: {
    blogs: blogsReducer,
  },
});

export default store;

export type AppDispatch = typeof store.dispatch;
