---
key: react-usestate-usereducer
title: useState vs useReducer
crumb: 15. ReactJS > React Hooks
---

`useState` phù hợp cho state đơn giản độc lập; `useReducer` phù hợp cho state phức tạp có nhiều sub-value hoặc logic transition rõ ràng — giúp code predictable và dễ test hơn.

## Điểm Chính

- **useState**: hook cơ bản nhất, nhận giá trị khởi tạo, trả về `[state, setState]` — lý tưởng cho string, number, boolean đơn lẻ.
- **functional update**: dùng `setState(prev => prev + 1)` thay vì `setState(count + 1)` để tránh stale closure khi state phụ thuộc vào giá trị trước đó.
- **lazy initialization**: truyền hàm vào `useState(() => expensiveCompute())` để chỉ tính một lần lúc mount, không mỗi render.
- **useReducer**: nhận `(state, action) => newState` và `initialState`, trả về `[state, dispatch]` — tốt khi nhiều action làm thay đổi cùng một state.
- **dispatch pattern**: action thường là `{ type: string, payload?: any }` — giúp logic tập trung tại reducer, dễ trace và test.
- **React 18 automatic batching**: tất cả `setState` trong event handler, setTimeout, Promise đều được batch — chỉ re-render 1 lần thay vì nhiều lần như React 17.
- **useReducer + Context**: pattern mạnh cho global state mà không cần Redux — dispatch function ổn định reference, không cần `useCallback`.
- Khi state của component A ảnh hưởng trực tiếp component B qua nhiều bước → cân nhắc lift lên `useReducer` ở cấp cha hoặc dùng state manager.

## Ví Dụ Code

*useState với functional update và lazy init; useReducer cho shopping cart*

```tsx
import { useState, useReducer } from 'react';

// ── useState: functional update & lazy initialization ──────────────────────
function Counter() {
  // lazy init: hàm chỉ chạy 1 lần lúc mount
  const [count, setCount] = useState<number>(() => {
    const saved = localStorage.getItem('count');
    return saved ? parseInt(saved, 10) : 0;
  });

  const increment = () => {
    // functional update: luôn dùng prev khi state mới phụ thuộc state cũ
    setCount(prev => prev + 1);
  };

  return <button onClick={increment}>Count: {count}</button>;
}

// ── useReducer: shopping cart với nhiều action ─────────────────────────────
type CartItem = { id: number; name: string; qty: number; price: number };

type CartState = { items: CartItem[]; total: number };

type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'qty'> }
  | { type: 'REMOVE_ITEM'; payload: { id: number } }
  | { type: 'UPDATE_QTY'; payload: { id: number; qty: number } }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.id === action.payload.id);
      const items = existing
        ? state.items.map(i =>
            i.id === action.payload.id ? { ...i, qty: i.qty + 1 } : i
          )
        : [...state.items, { ...action.payload, qty: 1 }];
      return { items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
    }
    case 'REMOVE_ITEM': {
      const items = state.items.filter(i => i.id !== action.payload.id);
      return { items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
    }
    case 'UPDATE_QTY': {
      const items = state.items.map(i =>
        i.id === action.payload.id ? { ...i, qty: action.payload.qty } : i
      );
      return { items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
    }
    case 'CLEAR':
      return { items: [], total: 0 };
    default:
      return state;
  }
}

function ShoppingCart() {
  const [cart, dispatch] = useReducer(cartReducer, { items: [], total: 0 });

  return (
    <div>
      <p>Total: ${cart.total.toFixed(2)}</p>
      <button onClick={() => dispatch({ type: 'ADD_ITEM', payload: { id: 1, name: 'Book', price: 9.99 } })}>
        Add Book
      </button>
      <button onClick={() => dispatch({ type: 'CLEAR' })}>Clear Cart</button>
    </div>
  );
}
```

## Ứng Dụng Thực Tế

Tại các dự án thực tế, `useReducer` thường được dùng cho form wizard nhiều bước, shopping cart, hoặc bất kỳ flow nào có ≥3 loại action. React 18 automatic batching giúp giảm số lần re-render trong các async handler như `fetch` callback — không cần wrap `unstable_batchedUpdates` như trước nữa.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào nên dùng useReducer thay vì useState?</strong></summary>

**A:** Dùng `useReducer` khi state có nhiều sub-value liên quan đến nhau, khi có ≥3 cách thay đổi state khác nhau, hoặc khi next state phụ thuộc vào prev state theo logic phức tạp. Ví dụ: form với nhiều field + validation, shopping cart với add/remove/update. `useReducer` tập trung logic tại reducer — dễ test (reducer là pure function) và dễ debug hơn `useState` dàn trải.

</details>

<details>
<summary><strong>Functional update trong useState là gì và tại sao cần dùng?</strong></summary>

**A:** Functional update là truyền hàm `prev => newValue` vào `setState` thay vì giá trị trực tiếp. Cần dùng khi giá trị mới phụ thuộc vào giá trị cũ — vì React có thể batch nhiều `setState` lại, nếu dùng `setState(count + 1)` hai lần liên tiếp có thể chỉ tăng 1 do closure bắt giá trị cũ. Dùng `setState(prev => prev + 1)` đảm bảo luôn dùng giá trị mới nhất tại thời điểm update.

</details>

<details>
<summary><strong>React 18 automatic batching hoạt động như thế nào?</strong></summary>

**A:** Trước React 18, batching chỉ xảy ra trong React event handler. React 18 batch tất cả `setState` bất kể nơi gọi — setTimeout, Promise.then, async/await, native event listener — chỉ trigger một lần re-render. Nếu muốn opt-out (hiếm khi cần), dùng `flushSync` từ `react-dom`. Lợi ích chính: giảm render không cần thiết trong async code mà không cần thay đổi code hiện có.

</details>
