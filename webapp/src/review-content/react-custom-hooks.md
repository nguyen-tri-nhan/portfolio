---
key: react-custom-hooks
title: Custom Hooks
crumb: 15. ReactJS > React Hooks
---

Custom hook là function bắt đầu bằng `use` chứa logic stateful tái sử dụng — tách business logic ra khỏi UI component, giúp code testable và composable hơn.

## Điểm Chính

- **Rules of Hooks**: chỉ gọi hook ở top-level (không trong if/loop/nested function); chỉ gọi trong React function component hoặc custom hook — không trong class hay plain function.
- **Naming convention**: tên phải bắt đầu bằng `use` — React linter (eslint-plugin-react-hooks) dựa vào quy ước này để enforce rules.
- **Mỗi component có state riêng**: custom hook không share state giữa các component — mỗi lần gọi tạo ra instance state độc lập.
- **useFetch**: encapsulate fetch logic + loading/error state — reuse ở nhiều component mà không duplicate code.
- **useLocalStorage**: sync state với localStorage — persist qua page reload, serialize/deserialize JSON tự động.
- **useDebounce**: trì hoãn update value — tránh gọi API sau mỗi keystroke, giảm request không cần thiết.
- **Composition**: custom hook có thể dùng custom hook khác — `useAutoSave` dùng `useDebounce` + `useFetch` bên trong.
- Test custom hook với `@testing-library/react` `renderHook` — không cần mount component thật.

## Ví Dụ Code

*useFetch, useLocalStorage, useDebounce — và composition trong useAutoSave*

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';

// ── useFetch: data fetching với loading/error state ────────────────────────
interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useFetch<T>(url: string): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(url, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<T>;
      })
      .then(setData)
      .catch(err => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [url, trigger]);

  const refetch = useCallback(() => setTrigger(t => t + 1), []);
  return { data, loading, error, refetch };
}

// ── useLocalStorage: persist state xuống localStorage ─────────────────────
function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStored = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue(prev => {
        const next = typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(prev)
          : newValue;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch { /* quota exceeded */ }
        return next;
      });
    },
    [key]
  );

  return [value, setStored] as const;
}

// ── useDebounce: trì hoãn value update ────────────────────────────────────
function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // reset timer khi value thay đổi
  }, [value, delay]);

  return debounced;
}

// ── Composition: useAutoSave dùng useDebounce + fetch ─────────────────────
function useAutoSave(content: string, endpoint: string) {
  const debouncedContent = useDebounce(content, 1000); // chờ 1s sau khi user ngừng gõ
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!debouncedContent) return;
    setSaved(false);
    fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: debouncedContent }),
    }).then(() => setSaved(true));
  }, [debouncedContent, endpoint]);

  return { saved };
}

// ── Usage example ──────────────────────────────────────────────────────────
function SearchPage() {
  const [query, setQuery] = useLocalStorage('search-query', '');
  const debouncedQuery = useDebounce(query, 400);
  const { data, loading, error } = useFetch<{ results: string[] }>(
    `/api/search?q=${encodeURIComponent(debouncedQuery)}`
  );

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      {loading && <p>Searching…</p>}
      {error && <p>Error: {error}</p>}
      {data?.results.map(r => <div key={r}>{r}</div>)}
    </div>
  );
}
```

## Ứng Dụng Thực Tế

Custom hook là cách tổ chức logic quan trọng nhất trong React — thay thế HOC và render props trong hầu hết trường hợp. Trong dự án thực, các hook như `usePermissions`, `useFeatureFlag`, `useIntersectionObserver` giúp chia sẻ behavior phức tạp mà không coupling vào component hierarchy.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Rules of Hooks là gì và tại sao React enforce chúng?</strong></summary>

**A:** Hai rules: (1) **Chỉ gọi hook ở top-level** — không trong if, loop, hay nested function; (2) **Chỉ gọi trong React function hoặc custom hook** — không trong class component hay plain JS function. React dựa vào thứ tự gọi hook để map state giữa các render — nếu gọi hook trong điều kiện, thứ tự có thể thay đổi giữa các render gây bug không thể đoán trước. ESLint plugin `eslint-plugin-react-hooks` enforce tự động với rule `rules-of-hooks`.

</details>

<details>
<summary><strong>Custom hook khác utility function như thế nào?</strong></summary>

**A:** Custom hook có thể gọi các React hook bên trong (useState, useEffect, useRef...) và có state/lifecycle riêng; utility function là plain JS, không có state và không liên quan đến React lifecycle. Ví dụ `formatDate(date)` là utility (không cần hook), nhưng `useDatePicker()` là hook vì quản lý state (selected date, open/close dropdown). Quy tắc đặt tên `use` không chỉ là convention — ESLint dựa vào đó để kiểm tra rules of hooks trong function đó.

</details>

<details>
<summary><strong>Composition của custom hooks hoạt động như thế nào?</strong></summary>

**A:** Custom hook có thể gọi custom hook khác — state từ mỗi hook là độc lập và compose tự nhiên. Ví dụ `useAutoSave` gọi `useDebounce` để lấy debounced value, rồi gọi fetch khi value thay đổi. Điều này giúp chia nhỏ logic phức tạp thành các hook nhỏ single-responsibility và tái sử dụng ở nhiều chỗ. Quan trọng: mỗi component gọi hook có state riêng — hai component gọi `useFetch` sẽ có loading/data/error độc lập nhau.

</details>
