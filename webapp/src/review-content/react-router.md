---
key: react-router
title: React Router v6
crumb: 15. ReactJS > Patterns & Performance
---

React Router v6 dùng `Routes/Route` component thay vì Switch, hỗ trợ nested routes với `Outlet`, và Data Router API (loader/action) giúp tách data fetching khỏi component — gần với Next.js App Router pattern hơn.

## Điểm Chính

- **Routes + Route**: thay thế `Switch` của v5 — tự động chọn route khớp nhất (không cần exact), hỗ trợ relative paths.
- **useNavigate**: thay thế `useHistory` của v5 — `navigate('/path')`, `navigate(-1)` (back), `navigate('/path', { replace: true })`.
- **useParams**: đọc dynamic segment từ URL — `const { userId } = useParams<{ userId: string }>()`.
- **Outlet**: placeholder trong layout component — nested route render vào đây, không cần render children thủ công.
- **Nested routes**: route con inherit path của route cha — `<Route path="users/:id" element={<Layout />}><Route index element={<UserDetail />} /></Route>`.
- **Protected routes**: wrapper component kiểm tra auth rồi redirect — `<Navigate to="/login" replace />` nếu chưa authenticated.
- **Data Router (createBrowserRouter)**: loader chạy trước render để fetch data (như getServerSideProps), action xử lý form submit — `useLoaderData`, `useActionData`.
- **Link vs NavLink**: `NavLink` tự add `active` class/style khi route match — dùng cho navigation menu.

## Ví Dụ Code

*Nested routes với Outlet; protected route; Data Router với loader*

```tsx
import {
  createBrowserRouter, RouterProvider, Outlet, Link, NavLink,
  Navigate, useNavigate, useParams, useLoaderData,
  type LoaderFunctionArgs,
} from 'react-router-dom';

// ── 1. Layout component với Outlet ─────────────────────────────────────────
function RootLayout() {
  return (
    <div>
      <header>
        <nav>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            Home
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>
            Users
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet /> {/* nested route render vào đây */}
      </main>
    </div>
  );
}

// ── 2. Protected Route: redirect nếu chưa login ────────────────────────────
function useAuth() {
  // Thực tế đọc từ Context/store
  return { isAuthenticated: Boolean(localStorage.getItem('token')) };
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    // replace: true → không thêm vào history stack, không thể back về login page sau khi auth
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Hoặc dùng layout route để protect nhiều route cùng lúc
function AuthLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />; // render child routes nếu authenticated
}

// ── 3. Data Router với loader ──────────────────────────────────────────────
interface User { id: string; name: string; email: string }
interface Post { id: number; title: string; body: string }

// Loader: chạy TRƯỚC khi component render — data sẵn sàng khi render
async function userLoader({ params }: LoaderFunctionArgs): Promise<User> {
  const res = await fetch(`/api/users/${params.userId}`);
  if (!res.ok) throw new Response('User not found', { status: 404 });
  return res.json();
}

async function userPostsLoader({ params }: LoaderFunctionArgs): Promise<Post[]> {
  const res = await fetch(`/api/users/${params.userId}/posts`);
  return res.json();
}

// Component đọc data từ loader (không có loading state — data đã có khi render)
function UserDetailPage() {
  const user = useLoaderData() as User;
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  return (
    <div>
      <button onClick={() => navigate(-1)}>Back</button>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <Link to={`/users/${userId}/posts`}>View Posts</Link>
    </div>
  );
}

function UserPostsPage() {
  const posts = useLoaderData() as Post[];
  return (
    <ul>
      {posts.map(p => <li key={p.id}>{p.title}</li>)}
    </ul>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const handleLogin = () => {
    localStorage.setItem('token', 'fake-token');
    navigate('/dashboard', { replace: true }); // replace: không giữ /login trong history
  };
  return <button onClick={handleLogin}>Login</button>;
}

// ── 4. createBrowserRouter: kết hợp tất cả ────────────────────────────────
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      // Protected routes group
      {
        element: <AuthLayout />,
        children: [
          { path: 'dashboard', element: <Dashboard /> },
          {
            path: 'users/:userId',
            loader: userLoader,        // fetch user trước khi render
            element: <UserDetailPage />,
            children: [
              {
                path: 'posts',
                loader: userPostsLoader, // fetch posts khi navigate đến tab Posts
                element: <UserPostsPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

// Placeholder pages
function HomePage()  { return <h1>Home</h1>; }
function Dashboard() { return <h1>Dashboard</h1>; }
```

## Ứng Dụng Thực Tế

Data Router với loader/action pattern giúp tách fetch logic khỏi component — tương tự `getServerSideProps` của Next.js Pages Router. Trong SPA phức tạp, nested routes với Outlet giảm code duplicate cho layout; protected route pattern là yêu cầu hầu như ở mọi ứng dụng có authentication.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>useNavigate khác Link như thế nào và khi nào dùng cái nào?</strong></summary>

**A:** `Link` render thẻ `<a>` — dùng cho navigation người dùng nhìn thấy và click vào (menu, breadcrumb, card). `useNavigate` dùng cho programmatic navigation trong code — sau submit form thành công, sau logout, redirect conditional. `Link` tốt hơn cho accessibility (hỗ trợ keyboard, screen reader, right-click "Open in new tab"). `useNavigate(-1)` tương đương browser back button. Dùng `replace: true` khi không muốn người dùng back về trang trước — ví dụ sau login thành công không cho back về /login.

</details>

<details>
<summary><strong>Nested routes và Outlet hoạt động như thế nào?</strong></summary>

**A:** Nested routes cho phép route con inherit path của route cha và render trong layout của cha. `Outlet` là placeholder trong layout component — React Router render route con match vào vị trí này. Ví dụ: route `/users/:id` có layout chứa sidebar và header, các route con `/users/:id/posts` và `/users/:id/settings` render nội dung vào `Outlet` mà không duplicate layout. `index` route render khi không có child route nào match (tương đương `exact` route tại path cha).

</details>

<details>
<summary><strong>Pattern protected route trong React Router v6 được implement như thế nào?</strong></summary>

**A:** Có hai approach: (1) **Wrapper component**: `<ProtectedRoute>` check auth, nếu không authenticated return `<Navigate to="/login" replace />`, nếu ok render `children`. Wrap từng route: `<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />`. (2) **Layout route** (gọn hơn khi có nhiều protected route): tạo `<AuthLayout>` component check auth rồi render `<Outlet />`, đặt tất cả protected route làm children. Dùng `replace: true` trong Navigate để tránh `/login` nằm trong history — không cho user back về sau khi đã login.

</details>
