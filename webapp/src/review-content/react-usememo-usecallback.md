---
key: react-usememo-usecallback
title: useMemo & useCallback
crumb: 15. ReactJS > React Hooks
---

`useMemo` lưu kết quả của phép tính tốn kém; `useCallback` lưu reference của function — cả hai chỉ nên dùng khi đã đo được bottleneck, không nên dùng mặc định vì bản thân chúng cũng có overhead.

## Điểm Chính

- **useMemo**: nhận factory function và deps array, trả về giá trị đã cached — chỉ recompute khi deps thay đổi. Dùng cho phép tính nặng (sort/filter list lớn, complex derivation).
- **useCallback**: nhận function và deps array, trả về function reference ổn định — recompute chỉ khi deps thay đổi. Dùng khi truyền callback xuống child đã được `React.memo`.
- **Khi KHÔNG dùng**: component render nhanh, list nhỏ, callback không truyền xuống memo component — overhead của hook lớn hơn lợi ích.
- **React.memo**: HOC bao quanh component, bỏ qua re-render nếu props không thay đổi (shallow compare). Kết hợp với `useCallback` để function prop ổn định.
- **Referential stability**: object/array tạo mới mỗi render → `React.memo` vô dụng. Dùng `useMemo` để giữ ổn định reference.
- **Dependency array**: tương tự `useEffect`, phải liệt kê đúng deps — thiếu deps → stale value, thừa → memoize vô nghĩa.
- `useMemo` vs `useCallback`: `useMemo(() => fn, deps)` memoize giá trị **trả về** của fn; `useCallback(fn, deps)` memoize chính **fn** đó.
- React Compiler (React 19+) tự động memoize — giảm nhu cầu dùng thủ công trong tương lai.

## Ví Dụ Code

*useMemo cho filter/sort list lớn; useCallback + React.memo cho child component tối ưu*

```tsx
import { useState, useMemo, useCallback, memo } from 'react';

// ── useMemo: filter + sort danh sách sản phẩm lớn ─────────────────────────
interface Product { id: number; name: string; price: number; category: string }

function ProductList({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');

  // Chỉ recompute khi products, query, hoặc sortBy thay đổi
  const filtered = useMemo(() => {
    console.log('Recomputing filtered list…'); // chứng minh không chạy mỗi render
    return products
      .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) =>
        sortBy === 'price' ? a.price - b.price : a.name.localeCompare(b.name)
      );
  }, [products, query, sortBy]);

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" />
      <button onClick={() => setSortBy(s => (s === 'name' ? 'price' : 'name'))}>
        Sort by {sortBy === 'name' ? 'price' : 'name'}
      </button>
      <p>{filtered.length} results</p>
      {filtered.map(p => <div key={p.id}>{p.name} — ${p.price}</div>)}
    </div>
  );
}

// ── useCallback + React.memo: tránh re-render con không cần thiết ──────────
interface TodoItemProps {
  id: number;
  text: string;
  done: boolean;
  onToggle: (id: number) => void; // nếu unstable → TodoItem re-render mỗi lần
  onDelete: (id: number) => void;
}

// React.memo: chỉ re-render khi props thay đổi (shallow compare)
const TodoItem = memo(function TodoItem({ id, text, done, onToggle, onDelete }: TodoItemProps) {
  console.log(`Rendering TodoItem ${id}`);
  return (
    <li>
      <input type="checkbox" checked={done} onChange={() => onToggle(id)} />
      <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{text}</span>
      <button onClick={() => onDelete(id)}>Delete</button>
    </li>
  );
});

function TodoApp() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Learn React', done: false },
    { id: 2, text: 'Build portfolio', done: true },
  ]);

  // useCallback: giữ reference ổn định → React.memo hoạt động đúng
  const handleToggle = useCallback((id: number) => {
    setTodos(prev =>
      prev.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }, []); // không deps vì dùng functional update

  const handleDelete = useCallback((id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ul>
      {todos.map(t => (
        <TodoItem key={t.id} {...t} onToggle={handleToggle} onDelete={handleDelete} />
      ))}
    </ul>
  );
}
```

## Ứng Dụng Thực Tế

Trong hầu hết ứng dụng thực tế, tối ưu `useMemo/useCallback` chỉ cần thiết sau khi profile bằng React DevTools Profiler. Trường hợp quan trọng nhất là: truyền callback vào `React.memo` child render nhiều lần, và tính toán phức tạp trên tập dữ liệu lớn (>1000 phần tử). Dashboard analytics, table lớn, hoặc chart là những nơi thường cần.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>useMemo và useCallback khác nhau như thế nào?</strong></summary>

**A:** Cả hai đều memoize theo deps, nhưng memoize thứ khác nhau. `useMemo(() => compute(), deps)` memoize **giá trị trả về** của hàm tính toán — ví dụ filtered array, parsed data. `useCallback(fn, deps)` memoize **chính reference của function** — thực chất là shorthand cho `useMemo(() => fn, deps)`. Dùng `useMemo` khi muốn lưu kết quả tính toán, `useCallback` khi muốn giữ function reference ổn định để truyền xuống child.

</details>

<details>
<summary><strong>Khi nào KHÔNG nên dùng useMemo/useCallback?</strong></summary>

**A:** Không nên dùng khi: (1) phép tính đơn giản, nhanh (cộng số, access object property); (2) component không nhận function prop từ parent hoặc không bọc `React.memo`; (3) list nhỏ dưới vài chục phần tử. Bản thân `useMemo/useCallback` có overhead: tạo closure, so sánh deps mỗi render, lưu giá trị trước. Nếu không đo được lợi ích bằng Profiler, thêm memoization có thể làm chậm hơn.

</details>

<details>
<summary><strong>React.memo + useCallback hoạt động như thế nào cùng nhau?</strong></summary>

**A:** `React.memo` wrap component, skip re-render nếu props không thay đổi bằng shallow compare. Vấn đề: function trong JavaScript tạo object mới mỗi lần khai báo — `onToggle={() => ...}` trong parent sẽ là reference mới mỗi render → `React.memo` luôn thấy props thay đổi → re-render vô ích. `useCallback` giải quyết bằng cách giữ reference ổn định qua các render. Hai thứ cần đi cùng nhau mới có tác dụng: `React.memo` trên child và `useCallback` trên hàm ở parent.

</details>
