---
key: react-virtual-dom
title: Virtual DOM & Concurrent Rendering
crumb: 15. ReactJS > React Internals
---

Virtual DOM là in-memory representation của UI thật — React diff VDOM cũ và mới rồi chỉ apply thay đổi tối thiểu lên real DOM, giúp tránh layout thrashing và tối ưu performance rendering.

## Điểm Chính

- **Virtual DOM**: plain JavaScript object tree mô tả UI — nhẹ hơn DOM thật, không có layout/paint cost khi tạo mới.
- **Diffing algorithm**: React so sánh VDOM tree cũ và mới theo chiều sâu với heuristic O(n) thay vì O(n³) brute-force — giả định component cùng type giữ cấu trúc.
- **Reconciliation**: quá trình React tìm sự khác biệt và tính toán tập hợp thay đổi tối thiểu cần apply lên real DOM.
- **Batching updates**: React nhóm nhiều state update thành một lần re-render và diff — tránh thrash DOM liên tục.
- **Real DOM cost**: truy cập/thay đổi real DOM kích hoạt layout, reflow, repaint — VDOM giúp minimize số lần này.
- **React 18 Concurrent**: rendering có thể bị interrupt, pause, resume — không block main thread cho phép browser vẫn xử lý input, animation.
- **Concurrent features**: `startTransition` đánh dấu update không urgent; `useDeferredValue` trì hoãn render heavy; `Suspense` tích hợp với concurrent để stream UI.
- React Native dùng cùng VDOM diff nhưng output là native mobile views thay vì DOM — chứng minh VDOM là abstraction layer thực sự.

## Ví Dụ Code

*startTransition để không block UI; useDeferredValue cho heavy list render*

```tsx
import {
  useState,
  useTransition,
  useDeferredValue,
  memo,
  Suspense,
  lazy,
} from 'react';

// ── startTransition: đánh dấu update không urgent ─────────────────────────
// Ví dụ: filter list lớn không được block input typing
const HeavyList = memo(({ filter }: { filter: string }) => {
  // Simulate expensive computation
  const items = Array.from({ length: 10_000 }, (_, i) => `Item ${i}`).filter(
    item => item.toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <ul>
      {items.slice(0, 50).map(item => (
        <li key={item}>{item}</li>
      ))}
      {items.length > 50 && <li>…and {items.length - 50} more</li>}
    </ul>
  );
});
HeavyList.displayName = 'HeavyList';

function SearchWithTransition() {
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Input update: urgent → update ngay lập tức
    setInputValue(e.target.value);

    // List filter: không urgent → có thể bị interrupt nếu user tiếp tục gõ
    startTransition(() => {
      setFilter(e.target.value);
    });
  };

  return (
    <div>
      <input value={inputValue} onChange={handleChange} placeholder="Filter…" />
      {isPending && <span> Updating…</span>}
      <HeavyList filter={filter} />
    </div>
  );
}

// ── useDeferredValue: trì hoãn render của giá trị heavy ───────────────────
function SearchWithDeferred() {
  const [query, setQuery] = useState('');
  // deferredQuery có thể lag sau query — React render với giá trị cũ trước
  // rồi re-render với giá trị mới khi main thread rảnh
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search…"
      />
      <div style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        <HeavyList filter={deferredQuery} />
      </div>
    </div>
  );
}

// ── Lazy loading + Suspense: code splitting tích hợp concurrent ────────────
const Dashboard = lazy(() => import('./Dashboard'));
const Analytics = lazy(() => import('./Analytics'));

function App() {
  const [tab, setTab] = useState<'dashboard' | 'analytics'>('dashboard');

  return (
    <div>
      <button onClick={() => setTab('dashboard')}>Dashboard</button>
      <button onClick={() => setTab('analytics')}>Analytics</button>
      <Suspense fallback={<div>Loading page…</div>}>
        {tab === 'dashboard' ? <Dashboard /> : <Analytics />}
      </Suspense>
    </div>
  );
}
```

## Ứng Dụng Thực Tế

React 18 concurrent features đặc biệt hữu ích cho admin dashboard với table lớn, real-time data, và search/filter phức tạp. `startTransition` giúp input luôn responsive ngay cả khi render list 10k items — cải thiện INP (Interaction to Next Paint) metric quan trọng cho Core Web Vitals.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Virtual DOM là gì và tại sao nó nhanh hơn thao tác trực tiếp với real DOM?</strong></summary>

**A:** Virtual DOM là JavaScript object tree đại diện cho UI — tạo/destroy VDOM rất rẻ vì không trigger browser layout. Thay vì update real DOM mỗi state change (mỗi lần đó browser phải recalculate layout, repaint), React tạo VDOM mới, diff với VDOM cũ để tìm thay đổi nhỏ nhất, rồi chỉ apply những thay đổi đó lên DOM thật. Kết quả: ít DOM mutation hơn, ít layout thrashing hơn. Tuy nhiên "VDOM nhanh hơn DOM" là đơn giản hóa — giá trị thực là **predictable performance** và **declarative programming model**, không phải raw speed tuyệt đối.

</details>

<details>
<summary><strong>Diffing algorithm của React hoạt động theo nguyên tắc nào?</strong></summary>

**A:** React dùng hai heuristic chính để đạt O(n) thay vì O(n³): (1) **Khác type → destroy và tạo mới** — nếu `<div>` thành `<span>`, React không cố diff children mà tạo lại toàn bộ subtree; (2) **Same type → update props** — React giữ DOM node, chỉ update attributes thay đổi. Với list, React dùng `key` để track identity qua render — không có `key`, React assume thứ tự không đổi và có thể update sai element.

</details>

<details>
<summary><strong>React 18 Concurrent rendering giải quyết vấn đề gì?</strong></summary>

**A:** Trước React 18, rendering là synchronous — React giữ main thread cho đến khi xong, khiến browser không thể xử lý input hay animation trong thời gian đó (gây jank). Concurrent mode làm render interruptible: React có thể pause render, trả control cho browser để xử lý user input, rồi resume hoặc restart render. Hai API chính: `startTransition` cho phép đánh dấu state update là "không urgent" (có thể interrupted), `useDeferredValue` giữ UI responsive bằng cách hiển thị giá trị cũ trong khi tính giá trị mới.

</details>
