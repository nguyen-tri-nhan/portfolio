---
key: react-useeffect
title: useEffect & useLayoutEffect
crumb: 15. ReactJS > React Hooks
---

`useEffect` chạy sau khi browser paint để xử lý side effects (fetch, subscription, timer); `useLayoutEffect` chạy đồng bộ sau DOM mutation nhưng trước paint — dùng khi cần đọc/ghi DOM để tránh flicker.

## Điểm Chính

- **Dependency array `[]`**: effect chỉ chạy một lần sau mount — tương đương `componentDidMount`. Không truyền gì: chạy sau mỗi render.
- **Dependency array `[deps]`**: chạy lại khi bất kỳ dep nào thay đổi (so sánh bằng `Object.is`). Object/array tạo mới mỗi render sẽ gây vòng lặp vô hạn.
- **Cleanup function**: return function trong effect — React gọi nó trước lần chạy tiếp theo và khi unmount. Dùng để unsubscribe, clearTimeout, abort fetch.
- **Stale closure**: biến bên trong effect bắt giá trị tại thời điểm render — nếu không đưa vào deps, sẽ đọc giá trị cũ. ESLint rule `exhaustive-deps` giúp phát hiện.
- **Infinite loop**: thường do object/array literal trong deps (`[{}]`) hoặc `setState` trong effect không có điều kiện dừng.
- **useLayoutEffect**: fire đồng bộ sau DOM mutation, trước khi browser paint — đảm bảo user không thấy flash. Dùng cho tooltip positioning, animation DOM-based.
- **Strict Mode (React 18)**: mount → unmount → mount lại intentionally để phát hiện side effects không được cleanup đúng.
- Prefer `AbortController` để cancel fetch trong cleanup thay vì flag `isMounted` — sạch hơn và hỗ trợ sẵn trong browser.

## Ví Dụ Code

*useEffect với fetch + AbortController cleanup; useLayoutEffect cho tooltip positioning*

```tsx
import { useState, useEffect, useLayoutEffect, useRef } from 'react';

// ── useEffect: data fetching với AbortController cleanup ───────────────────
interface User { id: number; name: string; email: string }

function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Tạo AbortController mỗi lần effect chạy
    const controller = new AbortController();

    const fetchUser = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/users/${userId}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: User = await res.json();
        setUser(data);
      } catch (err) {
        // AbortError xảy ra khi cleanup gọi abort() — bỏ qua
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Cleanup: hủy request nếu userId thay đổi hoặc component unmount
    return () => controller.abort();
  }, [userId]); // ← userId là dep: fetch lại khi userId thay đổi

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  return <p>{user?.name}</p>;
}

// ── useLayoutEffect: đo DOM để position tooltip ────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);

  // useLayoutEffect: chạy trước paint → không bị flicker khi position thay đổi
  useLayoutEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    setPos({
      top: triggerRect.top - tooltipRect.height - 8,
      left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
    });
  }, [visible]);

  return (
    <div ref={triggerRef} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div ref={tooltipRef} style={{ position: 'fixed', top: pos.top, left: pos.left }}>
          {text}
        </div>
      )}
    </div>
  );
}
```

## Ứng Dụng Thực Tế

Trong dự án thực tế, hầu hết data fetching nên được chuyển sang thư viện như React Query hoặc SWR thay vì `useEffect` thủ công — chúng xử lý caching, deduplication, retry tốt hơn. `useLayoutEffect` cần thiết cho các component như dropdown positioning, drag-and-drop, hoặc bất kỳ animation nào đọc layout DOM ngay sau update.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Giải thích các trường hợp của dependency array trong useEffect?</strong></summary>

**A:** Có ba trường hợp: (1) **Không truyền** — effect chạy sau mỗi render, thường không mong muốn; (2) **Array rỗng `[]`** — chỉ chạy sau mount và cleanup khi unmount, tương đương `componentDidMount/WillUnmount`; (3) **`[dep1, dep2]`** — chạy lại khi bất kỳ dep nào thay đổi theo `Object.is`. Lỗi phổ biến: bỏ sót dep trong array (stale closure) hoặc đưa object/function vào deps mà không memoize (infinite loop).

</details>

<details>
<summary><strong>Cleanup function trong useEffect dùng để làm gì?</strong></summary>

**A:** Cleanup function (return từ useEffect) được React gọi trước mỗi lần effect chạy lại và khi component unmount. Dùng để: hủy network request (`AbortController.abort()`), unsubscribe event listener (`removeEventListener`), clear timer (`clearTimeout/clearInterval`), đóng WebSocket. Không cleanup đúng gây memory leak và các bug như `setState` trên unmounted component (gây warning trong React 17, tự xử lý trong React 18).

</details>

<details>
<summary><strong>useLayoutEffect khác useEffect như thế nào và khi nào dùng?</strong></summary>

**A:** Cả hai đều nhận signature giống nhau nhưng timing khác: `useEffect` chạy **bất đồng bộ sau khi browser paint**, còn `useLayoutEffect` chạy **đồng bộ sau DOM mutation nhưng trước paint**. Dùng `useLayoutEffect` khi cần đọc layout (getBoundingClientRect) hoặc thay đổi DOM ngay lập tức để tránh flicker — ví dụ: tooltip positioning, scroll restoration. Mặc định dùng `useEffect`; chỉ chuyển sang `useLayoutEffect` khi thấy visual glitch.

</details>
