---
key: react-zustand
title: Zustand State Management
crumb: 15. ReactJS > State Management
---

Zustand là thư viện state management nhỏ gọn (~1KB) với API đơn giản — store là hook, không cần Provider, không cần boilerplate; selector mặc định tối ưu re-render.

## Điểm Chính

- **Store là hook**: `useStore` trực tiếp trong component, không cần Provider wrap root — ít setup, ít boilerplate.
- **set và get**: `set` để update state (partial update tự động merge), `get` để đọc state hiện tại bên trong actions.
- **Selector tối ưu re-render**: `useStore(state => state.count)` — component chỉ re-render khi `count` thay đổi, không phải khi phần state khác thay đổi.
- **Slice pattern**: với store lớn, tách logic thành slices độc lập rồi combine — giữ store maintainable.
- **persist middleware**: sync state với localStorage/sessionStorage tự động — chỉ định key, partialize để lọc field nào persist.
- **devtools middleware**: tích hợp Redux DevTools — inspect state, action, time-travel debug.
- **immer middleware**: cho phép mutate state trực tiếp trong set (tương tự Redux Toolkit).
- **Zustand vs Redux**: Zustand không có strict action/reducer pattern — linh hoạt hơn nhưng ít convention hơn; phù hợp cho medium complexity.

## Ví Dụ Code

*Store với actions; slice pattern; persist + devtools middleware*

```tsx
import { create } from 'zustand';
import { persist, devtools, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ── Store cơ bản với actions ───────────────────────────────────────────────
interface CounterStore {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  incrementBy: (amount: number) => void;
}

const useCounterStore = create<CounterStore>()((set) => ({
  count: 0,
  increment: () => set(state => ({ count: state.count + 1 })),
  decrement: () => set(state => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
  incrementBy: (amount) => set(state => ({ count: state.count + amount })),
}));

function Counter() {
  // Selector: chỉ subscribe phần cần thiết → tối ưu re-render
  const count = useCounterStore(state => state.count);
  const { increment, decrement, reset } = useCounterStore();

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}

// ── Slice pattern cho store lớn ────────────────────────────────────────────
interface AuthSlice {
  user: { id: number; name: string } | null;
  isAuthenticated: boolean;
  login: (user: { id: number; name: string }) => void;
  logout: () => void;
}

interface CartSlice {
  items: Array<{ id: number; name: string; qty: number; price: number }>;
  addItem: (item: { id: number; name: string; price: number }) => void;
  removeItem: (id: number) => void;
  total: () => number;
}

type AppStore = AuthSlice & CartSlice;

const useAppStore = create<AppStore>()(
  devtools(
    immer((set, get) => ({
      // Auth slice
      user: null,
      isAuthenticated: false,
      login: (user) => set(state => {
        state.user = user;            // Immer: mutate trực tiếp
        state.isAuthenticated = true;
      }),
      logout: () => set(state => {
        state.user = null;
        state.isAuthenticated = false;
        state.items = [];             // clear cart khi logout
      }),

      // Cart slice
      items: [],
      addItem: (item) => set(state => {
        const existing = state.items.find(i => i.id === item.id);
        if (existing) {
          existing.qty += 1;
        } else {
          state.items.push({ ...item, qty: 1 });
        }
      }),
      removeItem: (id) => set(state => {
        state.items = state.items.filter(i => i.id !== id);
      }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
    })),
    { name: 'AppStore' } // tên hiển thị trong Redux DevTools
  )
);

// ── persist middleware: sync với localStorage ──────────────────────────────
interface SettingsStore {
  theme: 'light' | 'dark';
  language: 'vi' | 'en';
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'vi' | 'en') => void;
}

const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'vi',
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'user-settings',   // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Chỉ persist theme và language, không persist actions
        theme: state.theme,
        language: state.language,
      }),
    }
  )
);

// ── Usage với selector tối ưu ──────────────────────────────────────────────
function Navbar() {
  // Chỉ re-render khi isAuthenticated hoặc user.name thay đổi
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  const userName = useAppStore(state => state.user?.name);
  const logout = useAppStore(state => state.logout);
  const { theme } = useSettingsStore();

  return (
    <nav data-theme={theme}>
      {isAuthenticated ? (
        <>
          <span>Hi, {userName}</span>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <span>Guest</span>
      )}
    </nav>
  );
}
```

## Ứng Dụng Thực Tế

Zustand là lựa chọn phổ biến cho các ứng dụng mid-size không muốn overhead của Redux. Đặc biệt hữu ích cho: UI state global (modal, sidebar, theme), shopping cart, user preferences. Với dự án lớn, slice pattern giữ code có tổ chức mà không cần nhiều setup như Redux.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Zustand khác Redux như thế nào và khi nào nên chọn Zustand?</strong></summary>

**A:** Zustand đơn giản hơn nhiều — không có action type string, không có reducer, không cần Provider, không cần `connect`. State và action cùng định nghĩa trong store. Bundle size nhỏ (~1KB vs Redux Toolkit ~40KB). Chọn Zustand khi: ứng dụng medium complexity, team nhỏ, muốn ít convention, không cần middleware phức tạp. Chọn Redux/RTK khi: ứng dụng lớn nhiều team, cần strict conventions, RTK Query cho data fetching, hoặc team đã quen Redux. Zustand cũng hỗ trợ devtools và middleware, nhưng setup đơn giản hơn.

</details>

<details>
<summary><strong>Zustand tối ưu re-render như thế nào?</strong></summary>

**A:** Zustand dùng selector pattern — `useStore(state => state.count)` — component chỉ re-render khi giá trị selector thay đổi (so sánh `Object.is`). Không như Context (tất cả consumer re-render khi value thay đổi), Zustand cho phép subscribe chính xác từng field. Nếu cần multiple fields, có thể dùng `shallow` compare: `useStore(state => ({ a: state.a, b: state.b }), shallow)` để tránh re-render khi reference object mới nhưng values không đổi. Đây là cải thiện lớn về performance so với Context.

</details>

<details>
<summary><strong>persist middleware trong Zustand hoạt động như thế nào?</strong></summary>

**A:** `persist` middleware wrap store và tự động serialize state xuống storage (mặc định localStorage) sau mỗi update, rồi rehydrate khi page load. `partialize` option cho phép chọn field nào persist — quan trọng vì không nên lưu functions hay sensitive data xuống localStorage. `name` là storage key. Có thể dùng `sessionStorage` hoặc custom storage adapter. Version migration hỗ trợ qua `version` + `migrate` function khi schema thay đổi giữa các release — tránh stale data từ old format.

</details>
