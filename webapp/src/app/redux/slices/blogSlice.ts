import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { GithubFile } from "../../model/github";
import { getPosts } from "../../apis";
import { Category } from "../../utils/contants";

interface BlogsState {
  blogs: GithubFile[];
  loading: boolean;
  error: string | null;
}

const initialState: BlogsState = {
  blogs: [],
  loading: false,
  error: null,
};

export const fetchBlogs = createAsyncThunk("blogs/fetchBlogs", async () => {
  const response = getPosts({ category: Category.BLOGS });
  return response;
});

const blogsSlice = createSlice({
  name: "blogs",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBlogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchBlogs.fulfilled,
        (state, action: PayloadAction<GithubFile[] | undefined>) => {
          state.loading = false;
          state.blogs = action.payload || [];
        }
      )
      .addCase(fetchBlogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch blogs";
      });
  },
});

export default blogsSlice.reducer;
