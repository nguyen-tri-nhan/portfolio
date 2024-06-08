import { createSelector } from 'reselect';
import { RootState } from '../store';

const selectBlogsState = (state: RootState) => state.blogs;

export const selectBlogs = createSelector(
  [selectBlogsState],
  (blogsState) => blogsState.blogs
);

export const selectBlogsLoading = createSelector(
  [selectBlogsState],
  (blogsState) => blogsState.loading
);

export const selectBlogsError = createSelector(
  [selectBlogsState],
  (blogsState) => blogsState.error
);
