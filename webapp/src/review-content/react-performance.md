---
key: react-performance
title: React Performance Optimization
crumb: 15. ReactJS > Patterns & Performance
---

Tối ưu React performance dựa trên đo lường — dùng Profiler để tìm bottleneck thật sự, sau đó áp dụng đúng kỹ thuật: code splitting cho initial load, virtualization cho list lớn, memoization có chọn lọc.

## Điểm Chính

- **React DevTools Profiler**: đo thời gian render từng component, số lần render, "why did this render" — luôn đo trước khi optimize.
- **Code splitting với lazy/Suspense**: tách bundle theo route/feature, chỉ load khi cần — giảm initial bundle size, cải thiện TTI (Time to Interactive).
- **Virtualization**: chỉ render rows đang visible trong viewport — với `react-window` hoặc `@tanstack/react-virtual`; cần thiết cho list >100 items.
- **Tránh re-render không cần thiết**: `React.memo`, `useMemo`, `useCallback` — nhưng chỉ dùng sau khi profile xác nhận vấn đề.
- **State co-location**: đặt state gần nơi dùng nhất — giới hạn re-render subtree nhỏ thay vì re-render toàn bộ.
- **Tránh anonymous function trong JSX**: `onClick={() => fn()}` tạo reference mới mỗi render → dùng `useCallback` nếu truyền xuống `React.memo` child.
- **Key ổn định**: không dùng `Math.random()` hay index trong key của list có reorder/add/delete.
- **Web Vitals**: LCP (Largest Contentful Paint), INP (Interaction to Next Paint), CLS — code splitting và virtualization ảnh hưởng trực tiếp.

## Ví Dụ Code

*Code splitting với lazy/Suspense; react-window cho list lớn; Profiler API*

```tsx
import {
  lazy, Suspense, useState, memo, useCallback, Profiler,
  type ProfilerOnRenderCallback,
} from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';

// ── 1. Code splitting: lazy + Suspense ────────────────────────────────────
// Mỗi route là bundle riêng, chỉ load khi navigate đến
const HomePage    = lazy(() => import('./pages/HomePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() =>
  // Named export: import { SettingsPage } from './pages'
  import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage }))
);

function AppRouter() {
  const [page, setPage] = useState<'home' | 'profile' | 'settings'>('home');

  return (
    <div>
      <nav>
        <button onClick={() => setPage('home')}>Home</button>
        <button onClick={() => setPage('profile')}>Profile</button>
        <button onClick={() => setPage('settings')}>Settings</button>
      </nav>

      {/* Suspense cần thiết khi dùng lazy — hiển thị fallback khi loading chunk */}
      <Suspense fallback={<div className="page-skeleton">Loading page…</div>}>
        {page === 'home'     && <HomePage />}
        {page === 'profile'  && <ProfilePage />}
        {page === 'settings' && <SettingsPage />}
      </Suspense>
    </div>
  );
}

// ── 2. Virtualization với react-window ────────────────────────────────────
interface RowData { id: number; name: string; email: string; score: number }

// Row component phải dùng style từ react-window để position đúng
const VirtualRow = memo(({ index, style, data }: ListChildComponentProps<RowData[]>) => {
  const item = data[index];
  return (
    <div style={style} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
      <span>{item.name}</span>
      <span>{item.email}</span>
      <span>{item.score}</span>
    </div>
  );
});
VirtualRow.displayName = 'VirtualRow';

function BigTable({ rows }: { rows: RowData[] }) {
  return (
    // Chỉ render ~10-15 rows visible — không render tất cả 10,000 rows
    <FixedSizeList
      height={500}       // chiều cao container cố định
      itemCount={rows.length}
      itemSize={50}      // chiều cao mỗi row (px)
      width="100%"
      itemData={rows}    // truyền data qua itemData, không qua closure
    >
      {VirtualRow}
    </FixedSizeList>
  );
}

// ── 3. Profiler API: đo render time trong code ─────────────────────────────
const onRenderCallback: ProfilerOnRenderCallback = (
  id,          // "id" prop của Profiler
  phase,       // "mount" hoặc "update"
  actualDuration,  // ms cho render lần này
  baseDuration,    // ms ước tính nếu không có memoization
  startTime,
  commitTime
) => {
  if (actualDuration > 16) { // >1 frame (60fps)
    console.warn(`[Profiler] ${id} ${phase}: ${actualDuration.toFixed(2)}ms (slow!)`);
  }
};

function ProfiledFeature() {
  return (
    <Profiler id="BigTable" onRender={onRenderCallback}>
      <BigTable rows={[]} />
    </Profiler>
  );
}

// ── 4. State co-location: giới hạn phạm vi re-render ─────────────────────
// ❌ Antipattern: state trong component cha → re-render cả cây
// function ParentBad() {
//   const [hover, setHover] = useState(false); // ← hover ảnh hưởng render toàn bộ
//   return <><ExpensiveChild /><button onMouseEnter={() => setHover(true)} /></>;
// }

// ✅ Co-locate state vào component nhỏ nhất cần nó
function HoverButton() {
  const [hover, setHover] = useState(false); // chỉ re-render HoverButton
  return (
    <button
      style={{ background: hover ? '#0070f3' : 'transparent' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      Hover me
    </button>
  );
}
```

## Ứng Dụng Thực Tế

Trong dự án thực, code splitting theo route là optimization đơn giản nhất với ROI cao nhất — giảm initial bundle từ vài MB xuống dưới 200KB thường xuyên. Virtualization cần thiết cho bảng dữ liệu lớn trong admin dashboard, log viewer, hay bất kỳ list nào có thể có hàng nghìn items.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Code splitting trong React hoạt động như thế nào?</strong></summary>

**A:** Code splitting chia bundle JavaScript thành nhiều chunk nhỏ, mỗi chunk load khi cần. React cung cấp `React.lazy()` nhận dynamic import — `lazy(() => import('./Component'))` — và trả về component có thể dùng trong JSX. `Suspense` bao quanh lazy component để hiển thị fallback khi chunk đang load. Bundler (Webpack, Vite) tự động tạo chunk riêng cho mỗi dynamic import. Kết quả: initial bundle nhỏ hơn → TTI nhanh hơn. Route-based splitting thường là chiến lược đầu tiên nên áp dụng.

</details>

<details>
<summary><strong>Virtualization là gì và khi nào cần dùng?</strong></summary>

**A:** Virtualization (hay windowing) là kỹ thuật chỉ render DOM node cho items đang visible trong viewport — thay vì render tất cả 10,000 rows, chỉ render ~15 rows hiện ra màn hình. Khi scroll, DOM node cũ được tái sử dụng với data mới. Cần dùng khi list >100-200 items gây chậm khi render hoặc scroll không mượt. Thư viện phổ biến: `react-window` (nhỏ, fixed-size/variable-size), `@tanstack/react-virtual` (headless, linh hoạt hơn). Không phải mọi list cần virtualization — đo trước với Profiler.

</details>

<details>
<summary><strong>React DevTools Profiler dùng để làm gì và cách phân tích?</strong></summary>

**A:** Profiler record render timeline — hiển thị từng component render trong bao lâu, render bao nhiêu lần, và "why did this render" (props/state/context thay đổi). Quy trình: (1) Mở DevTools → Profiler tab; (2) Click Record; (3) Thực hiện action cần đo; (4) Stop recording; (5) Xem "flamegraph" để tìm component render lâu (màu đỏ/cam). "Ranked chart" sắp xếp component theo render time. Commit bars ở trên hiển thị mỗi lần React render. Sau khi xác định component chậm → kiểm tra why → quyết định memo/split/virtualize.

</details>
