---
key: react-redux
title: Redux & Redux Toolkit
crumb: 15. ReactJS > State Management
---

Redux Toolkit (RTK) là cách hiện đại để dùng Redux — loại bỏ boilerplate với `createSlice`, `createAsyncThunk`; RTK Query tích hợp data fetching/caching trực tiếp vào store.

## Điểm Chính

- **Redux Toolkit**: thư viện chính thức, bao gồm `createSlice`, `createAsyncThunk`, `configureStore`, `createEntityAdapter` — thay thế hoàn toàn Redux vanilla.
- **createSlice**: tạo reducer + action creators từ một object — dùng Immer bên trong nên có thể "mutate" state trực tiếp (thực ra immutable).
- **createAsyncThunk**: xử lý async action (fetch API) với 3 lifecycle: `pending`, `fulfilled`, `rejected` — tự tạo action types.
- **useSelector**: đọc state từ store với selector function — re-render khi giá trị selector thay đổi (so sánh `===`).
- **useDispatch**: lấy dispatch function để gửi action — reference ổn định, không cần `useCallback`.
- **RTK Query**: data fetching solution tích hợp — define endpoints, tự generate hooks (`useGetUsersQuery`, `useCreateUserMutation`), cache, invalidation.
- **Selector memoization**: `createSelector` (re-exported từ Reselect) — computed value chỉ recalculate khi input selectors thay đổi.
- Redux phù hợp khi: state phức tạp nhiều slice, cần devtools time-travel, nhiều async flows, cần chia sẻ state giữa nhiều feature không liên quan.

## Ví Dụ Code

*createSlice với async thunk; RTK Query với caching và mutation*

```tsx
import { createSlice, createAsyncThunk, createSelector, configureStore } from '@reduxjs/toolkit';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { useSelector, useDispatch, Provider } from 'react-redux';

// ── 1. createSlice + createAsyncThunk ─────────────────────────────────────
interface Post { id: number; title: string; body: string; userId: number }
interface PostsState {
  items: Post[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

export const fetchPosts = createAsyncThunk<Post[], void>(
  'posts/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=10');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Post[];
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

const postsSlice = createSlice({
  name: 'posts',
  initialState: { items: [], status: 'idle', error: null } as PostsState,
  reducers: {
    postAdded(state, action: { payload: Post }) {
      // Immer cho phép "mutate" trực tiếp — thực ra produce immutable update
      state.items.push(action.payload);
    },
    postRemoved(state, action: { payload: number }) {
      state.items = state.items.filter(p => p.id !== action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchPosts.pending, state => { state.status = 'loading'; })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

export const { postAdded, postRemoved } = postsSlice.actions;

// ── 2. RTK Query: data fetching với automatic caching ─────────────────────
interface User { id: number; name: string; email: string }

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['User'],
  endpoints: builder => ({
    getUsers: builder.query<User[], void>({
      query: () => '/users',
      providesTags: ['User'],         // cache tag
    }),
    getUserById: builder.query<User, number>({
      query: id => `/users/${id}`,
      providesTags: (_, __, id) => [{ type: 'User', id }],
    }),
    createUser: builder.mutation<User, Omit<User, 'id'>>({
      query: body => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['User'],      // xóa cache sau khi tạo thành công
    }),
  }),
});

export const { useGetUsersQuery, useGetUserByIdQuery, useCreateUserMutation } = usersApi;

// ── 3. Memoized selector với createSelector ────────────────────────────────
interface RootState { posts: PostsState }

const selectPosts = (state: RootState) => state.posts.items;
const selectPostsByUser = createSelector(
  [selectPosts, (_: RootState, userId: number) => userId],
  (posts, userId) => posts.filter(p => p.userId === userId)
  // Chỉ recompute khi posts hoặc userId thay đổi
);

// ── 4. Component sử dụng ──────────────────────────────────────────────────
function PostList() {
  const dispatch = useDispatch();
  const { items, status } = useSelector((s: RootState) => s.posts);
  const user1Posts = useSelector((s: RootState) => selectPostsByUser(s, 1));

  return (
    <div>
      {status === 'idle' && (
        <button onClick={() => dispatch(fetchPosts())}>Load Posts</button>
      )}
      {status === 'loading' && <p>Loading…</p>}
      {items.map(p => (
        <div key={p.id}>
          {p.title}
          <button onClick={() => dispatch(postRemoved(p.id))}>Delete</button>
        </div>
      ))}
    </div>
  );
}

function UserList() {
  const { data: users, isLoading, error } = useGetUsersQuery();
  const [createUser, { isLoading: creating }] = useCreateUserMutation();

  if (isLoading) return <p>Loading users…</p>;
  if (error) return <p>Error loading users</p>;

  return (
    <div>
      {users?.map(u => <div key={u.id}>{u.name}</div>)}
      <button
        disabled={creating}
        onClick={() => createUser({ name: 'New User', email: 'new@example.com' })}
      >
        {creating ? 'Creating…' : 'Add User'}
      </button>
    </div>
  );
}
```

## Ứng Dụng Thực Tế

RTK Query đặc biệt mạnh cho CRUD application — tự handle loading states, caching với TTL, optimistic updates, và cache invalidation. Trong dự án thực, RTK Query thường thay thế hoàn toàn `useEffect` + fetch thủ công, giảm đáng kể boilerplate và bug liên quan đến race condition.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Redux khác Context API như thế nào và khi nào chọn Redux?</strong></summary>

**A:** Context là primitive của React, không có selector (mọi consumer re-render khi value thay đổi), không có middleware, không devtools. Redux có: selector memoization (chỉ re-render khi phần state quan tâm thay đổi), middleware (thunk, saga, logger), Redux DevTools (time-travel, replay). Chọn Redux khi: state phức tạp nhiều slice độc lập, cần devtools để debug async flows, team lớn cần conventions rõ ràng, nhiều async operations cần orchestrate. Chọn Context khi: state đơn giản, ít thay đổi, không cần advanced debugging.

</details>

<details>
<summary><strong>createSlice hoạt động như thế nào và Immer integration là gì?</strong></summary>

**A:** `createSlice` nhận name, initialState và reducers object — tự sinh ra action creators và action types từ reducer names. Bên trong nó dùng Immer: bạn có thể viết `state.items.push(item)` trong reducer mà không phá vỡ immutability — Immer intercept và produce immutable update. Kết quả: reducer code ngắn gọn hơn nhiều so với spread operator. `extraReducers` xử lý action từ slice khác hoặc `createAsyncThunk` — là nơi handle pending/fulfilled/rejected lifecycle.

</details>

<details>
<summary><strong>RTK Query khác react-query như thế nào?</strong></summary>

**A:** Cả hai đều xử lý server state với caching, background refetch, loading/error states. Khác biệt chính: RTK Query tích hợp vào Redux store — cache sống trong Redux state, devtools đồng nhất, có thể combine với Redux reducers. React Query (TanStack Query) là standalone, không cần Redux, API đơn giản hơn, và thường ưa dùng hơn nếu không cần Redux cho global state. Nếu dự án đã dùng Redux, RTK Query là lựa chọn tự nhiên; nếu chỉ cần server state caching, TanStack Query thường được ưu tiên hơn.

</details>
