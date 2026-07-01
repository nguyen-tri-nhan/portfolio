---
key: react-suspense
title: Suspense & Error Boundary
crumb: 15. ReactJS > Patterns & Performance
---

`Suspense` cho phép component "đợi" khi chưa sẵn sàng (lazy loading, data fetching) và hiển thị fallback trong thời gian đó; `ErrorBoundary` bắt lỗi render để tránh crash toàn bộ ứng dụng.

## Điểm Chính

- **Suspense**: bao quanh component "suspending" — khi component chưa sẵn sàng (throw Promise), Suspense hiển thị fallback thay thế.
- **Lazy loading**: dùng chủ yếu với `React.lazy()` — chunk JavaScript chưa load → Suspense hiển thị skeleton/spinner.
- **Data fetching với Suspense**: framework như Next.js, React Query, Relay tích hợp Suspense — component đọc data synchronously, tự suspend nếu chưa có.
- **Nested Suspense**: đặt Suspense ở nhiều cấp để kiểm soát granularity của loading state — phần nào load xong trước, hiện trước.
- **ErrorBoundary**: class component bắt lỗi trong render, lifecycle, constructor của component con — không bắt được event handler, async, hay lỗi trong chính ErrorBoundary.
- **react-error-boundary**: thư viện nhỏ cung cấp `ErrorBoundary` component với API tốt hơn — `fallbackRender`, `onError`, `onReset`.
- **Reset error**: `resetKeys` prop trong react-error-boundary — khi key thay đổi (ví dụ route change), error được reset và component thử render lại.
- React 18 Suspense + concurrent rendering: loading state không block interaction, user vẫn có thể tương tác với phần đã load.

## Ví Dụ Code

*Suspense với lazy loading; ErrorBoundary; React Query + Suspense mode*

```tsx
import {
  lazy, Suspense, Component,
  type ReactNode, type ErrorInfo,
} from 'react';

// ── 1. Suspense skeleton pattern ───────────────────────────────────────────
const UserProfile  = lazy(() => import('./UserProfile'));
const ActivityFeed = lazy(() => import('./ActivityFeed'));

function ProfileSkeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton-avatar" />
      <div className="skeleton-line" style={{ width: '60%' }} />
      <div className="skeleton-line" style={{ width: '40%' }} />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

// Nested Suspense: profile và feed có loading state độc lập
function ProfilePage({ userId }: { userId: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfile userId={userId} />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <ActivityFeed userId={userId} />
      </Suspense>
    </div>
  );
}

// ── 2. ErrorBoundary: class component (bắt buộc với React) ────────────────
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to monitoring service (Sentry, Datadog)
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;
      return typeof fallback === 'function'
        ? fallback(this.state.error, this.reset)
        : fallback;
    }
    return this.props.children;
  }
}

// ── 3. Kết hợp Suspense + ErrorBoundary ───────────────────────────────────
function AsyncWidget({ id }: { id: string }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="error-card">
          <p>Something went wrong: {error.message}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}
      onError={(error) => {
        // Gửi lên Sentry trong production
        console.error('Widget error:', error);
      }}
    >
      <Suspense fallback={<div className="spinner">Loading widget…</div>}>
        {/* Widget có thể suspend (data fetching) hoặc throw (render error) */}
        <WidgetContent id={id} />
      </Suspense>
    </ErrorBoundary>
  );
}

// Placeholder — thực tế dùng với framework hỗ trợ Suspense data fetching
function WidgetContent({ id }: { id: string }) {
  // Với TanStack Query v5:
  // const { data } = useSuspenseQuery({ queryKey: ['widget', id], queryFn: ... });
  return <div>Widget {id}</div>;
}

// ── 4. App-level error boundary ────────────────────────────────────────────
function AppErrorFallback() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1>Oops! Something went wrong</h1>
      <button onClick={() => window.location.reload()}>Reload Page</button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary fallback={<AppErrorFallback />}>
      <Suspense fallback={<div>Loading app…</div>}>
        <ProfilePage userId={1} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## Ứng Dụng Thực Tế

Pattern `<ErrorBoundary><Suspense>` là bộ đôi không thể thiếu trong production React app — Suspense xử lý loading state, ErrorBoundary đảm bảo lỗi không crash toàn app. TanStack Query v5 và Next.js App Router đều hỗ trợ Suspense mode cho data fetching — cho phép viết component synchronous mà không cần quản lý loading state thủ công.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Suspense là gì và cơ chế hoạt động bên dưới?</strong></summary>

**A:** Suspense là component React để handle trạng thái "chưa sẵn sàng" của component con. Cơ chế: component con throw một Promise khi chưa có data — React bắt Promise này, hiển thị fallback của Suspense gần nhất, rồi khi Promise resolve, React thử render lại component. `React.lazy` dùng đúng cơ chế này — dynamic import trả về Promise. Framework như Next.js và TanStack Query tích hợp cách thư viện throw Promise khi data chưa có trong cache. Từ React 18, Suspense tích hợp với concurrent rendering để không block UI khác.

</details>

<details>
<summary><strong>ErrorBoundary là gì và bắt được những lỗi nào?</strong></summary>

**A:** ErrorBoundary là class component implement `getDerivedStateFromError` và/hoặc `componentDidCatch` — bắt lỗi trong render, lifecycle method, constructor của component con trong subtree. **Không bắt được**: lỗi trong event handler (dùng try/catch bình thường), async code không trong render (setTimeout, fetch), lỗi trong chính ErrorBoundary, Server-Side Rendering. Cần có ít nhất một ErrorBoundary ở app level để tránh crash toàn trang; nên có thêm ở feature level để granular error handling. Thư viện `react-error-boundary` cung cấp function component wrapper tiện hơn.

</details>

<details>
<summary><strong>Suspense khác loading state thông thường (isLoading) như thế nào?</strong></summary>

**A:** `isLoading` state thủ công cần mỗi component tự quản lý — `if (isLoading) return <Spinner>`, logic lặp lại ở mọi nơi, khó compose. Với Suspense: component viết như thể data luôn có sẵn, framework/library lo phần suspend; Suspense tự động tổng hợp nhiều loading state trong subtree — nếu A và B đều suspend, chỉ một fallback hiển thị thay vì hai spinner riêng. Với nested Suspense, có thể kiểm soát granularity: phần nào sẵn sàng trước hiển thị trước, không cần chờ tất cả. Dùng Suspense mode yêu cầu library/framework hỗ trợ (Next.js, TanStack Query v5, SWR với `suspense: true`).

</details>
