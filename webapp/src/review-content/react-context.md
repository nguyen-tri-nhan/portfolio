---
key: react-context
title: React Context API
crumb: 15. ReactJS > State Management
---

React Context giải quyết prop drilling bằng cách tạo "đường ống" truyền data qua component tree — nhưng mọi consumer re-render khi context value thay đổi, nên cần tách context hoặc kết hợp với memo khi performance là vấn đề.

## Điểm Chính

- **createContext**: tạo context object với default value — default chỉ dùng khi không có Provider bao ngoài.
- **Provider**: wrap component tree để cung cấp value; mọi consumer trong subtree có thể đọc value này.
- **useContext**: hook đọc context value trong function component — thay thế Consumer render prop.
- **Context vs Prop drilling**: prop drilling truyền data qua nhiều tầng component trung gian không dùng đến data đó — context bỏ qua các tầng này.
- **Re-render issue**: khi `value` của Provider thay đổi (kể cả object reference mới), **tất cả** consumer re-render — dù chỉ một field trong object thay đổi.
- **Tách context**: giải pháp cho performance — tách thành nhiều context nhỏ theo domain (AuthContext, ThemeContext) thay vì một context lớn.
- **Context + useReducer**: pattern mạnh — dispatch function ổn định reference (không cần useCallback), state thay đổi trigger re-render. Tách state context và dispatch context để component chỉ đọc dispatch không re-render khi state thay đổi.
- Context không phải state manager — không có selector, middleware, devtools. Với data phức tạp hoặc update nhiều, cân nhắc Zustand/Redux.

## Ví Dụ Code

*Auth context với useReducer; tách state và dispatch context để tối ưu re-render*

```tsx
import { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react';

// ── Auth context: state + dispatch tách riêng ──────────────────────────────
interface User { id: number; name: string; role: 'admin' | 'user' }

interface AuthState {
  user: User | null;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':    return { ...state, user: action.payload, isLoading: false };
    case 'LOGOUT':   return { ...state, user: null };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    default: return state;
  }
}

// Tách state và dispatch context:
// - Component chỉ cần dispatch → không re-render khi state thay đổi
// - Component cần state → re-render khi state thay đổi (đúng ý muốn)
const AuthStateContext = createContext<AuthState | null>(null);
const AuthDispatchContext = createContext<React.Dispatch<AuthAction> | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { user: null, isLoading: false });

  // dispatch reference ổn định từ useReducer → không cần useMemo/useCallback
  return (
    <AuthStateContext.Provider value={state}>
      <AuthDispatchContext.Provider value={dispatch}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthStateContext.Provider>
  );
}

// Custom hooks để đọc context với error handling
export function useAuthState(): AuthState {
  const ctx = useContext(AuthStateContext);
  if (!ctx) throw new Error('useAuthState must be used within AuthProvider');
  return ctx;
}

export function useAuthDispatch() {
  const ctx = useContext(AuthDispatchContext);
  if (!ctx) throw new Error('useAuthDispatch must be used within AuthProvider');
  return ctx;
}

// ── Tách context theo domain để giảm re-render ─────────────────────────────
interface Theme { mode: 'light' | 'dark'; primaryColor: string }
const ThemeContext = createContext<Theme>({ mode: 'light', primaryColor: '#0070f3' });

export function useTheme() { return useContext(ThemeContext); }

// ── Usage example ──────────────────────────────────────────────────────────
function NavBar() {
  // Chỉ đọc state → re-render khi auth state thay đổi
  const { user } = useAuthState();
  const dispatch = useAuthDispatch();
  const { mode } = useTheme();

  return (
    <nav style={{ background: mode === 'dark' ? '#111' : '#fff' }}>
      {user ? (
        <>
          <span>Hello, {user.name}</span>
          <button onClick={() => dispatch({ type: 'LOGOUT' })}>Logout</button>
        </>
      ) : (
        <span>Not logged in</span>
      )}
    </nav>
  );
}

// Component chỉ dispatch — không re-render khi state thay đổi
function LogoutButton() {
  const dispatch = useAuthDispatch(); // chỉ đọc dispatch context
  return (
    <button onClick={() => dispatch({ type: 'LOGOUT' })}>Logout</button>
  );
}
```

## Ứng Dụng Thực Tế

Context thích hợp cho data ít thay đổi và cần chia sẻ rộng: authentication, theme, locale/i18n, feature flags. Với data thay đổi thường xuyên (shopping cart, form state, real-time data) hoặc cần selective subscription, Zustand hoặc Redux Toolkit sẽ hiệu quả hơn.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Context giải quyết prop drilling như thế nào và khi nào nên dùng?</strong></summary>

**A:** Prop drilling xảy ra khi phải truyền prop qua nhiều tầng component trung gian chỉ để data đến đúng chỗ — component giữa không dùng nhưng phải truyền tiếp, tăng coupling và khó maintain. Context tạo "tunnel" — Provider đặt ở trên, consumer đọc trực tiếp dù ở tầng nào. Nên dùng context cho: auth user info, theme, locale, feature flags — data ít thay đổi nhưng cần ở nhiều nơi. Không nên dùng cho form state, list data, hay bất cứ thứ gì thay đổi thường xuyên.

</details>

<details>
<summary><strong>Vấn đề re-render của Context là gì và cách khắc phục?</strong></summary>

**A:** Khi `value` của Provider thay đổi, React re-render tất cả component gọi `useContext` đó — kể cả những component không dùng phần thay đổi. Object literal `value={{ user, theme }}` tạo reference mới mỗi render của Provider → luôn trigger re-render consumer. Giải pháp: (1) **Tách context** theo domain nhỏ; (2) **Memoize value** với `useMemo`; (3) **Tách state và dispatch** (dispatch reference từ `useReducer` ổn định); (4) Với phức tạp hơn, dùng Zustand/Redux có selector mechanism.

</details>

<details>
<summary><strong>Context + useReducer pattern hoạt động như thế nào và lợi ích gì?</strong></summary>

**A:** Pattern này kết hợp `useReducer` (quản lý state phức tạp) và Context (distribute state/dispatch). `dispatch` từ `useReducer` có reference ổn định qua renders — không cần `useCallback`. Tách context state và dispatch cho phép: component chỉ cần trigger action import `useAuthDispatch` không re-render khi state thay đổi; component cần đọc data import `useAuthState`. Đây là lightweight alternative cho Redux khi không cần middleware, devtools, hay selector. Scale tốt cho medium-complexity global state.

</details>
