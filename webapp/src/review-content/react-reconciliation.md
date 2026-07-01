---
key: react-reconciliation
title: Reconciliation & React Fiber
crumb: 15. ReactJS > React Internals
---

React Fiber (React 16+) là kiến trúc reconciliation mới cho phép chia nhỏ rendering thành các unit of work có thể interrupt — nền tảng cho Concurrent Mode và các features như Suspense, Transition.

## Điểm Chính

- **Fiber**: mỗi React element được đại diện bởi một Fiber node — linked list thay vì recursive call stack, cho phép pause và resume.
- **Two phases**: (1) **Render phase** (interruptible): build Fiber tree, diff, mark effects; (2) **Commit phase** (synchronous): apply mutations lên real DOM — không thể interrupt.
- **Work Loop**: React xử lý Fiber unit-by-unit, kiểm tra deadline browser sau mỗi unit — nếu hết thời gian, yield và tiếp tục sau.
- **Key prop**: identifier để React track element identity trong list — cùng key giữa render → update; khác key → unmount cũ, mount mới.
- **Key không phải index**: dùng index làm key khi list có thể reorder/add/remove → React update sai element và có thể mất uncontrolled state.
- **Reconciliation heuristics**: cùng type tại cùng vị trí → React giữ instance và update props; khác type → destroy toàn bộ subtree.
- **Priority levels**: Fiber có priority — user input (urgent) > transition > background work. Concurrent Mode schedule dựa trên priority.
- **Strict Mode double-invoke**: React 18 mount→unmount→mount trong Strict Mode để detect non-idempotent effects — chỉ trong development.

## Ví Dụ Code

*Key usage đúng vs sai; reconciliation với component type change*

```tsx
import { useState, memo } from 'react';

// ── Key sai vs đúng trong danh sách có thể thay đổi ───────────────────────
interface Todo {
  id: number;
  text: string;
  done: boolean;
}

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {/* ❌ SAI: dùng index làm key khi list có thể reorder hoặc thêm/xóa đầu */}
      {/* {todos.map((todo, index) => (
        <li key={index}>{todo.text}</li>
      ))} */}

      {/* ✅ ĐÚNG: dùng stable unique id */}
      {todos.map(todo => (
        <li key={todo.id}>
          <TodoItem todo={todo} />
        </li>
      ))}
    </ul>
  );
}

// ── Controlled input với key wrong: state bị giữ nhầm ─────────────────────
function UncontrolledInput({ label }: { label: string }) {
  // Input này là uncontrolled — value lưu trong DOM, không React state
  return <input placeholder={label} />;
}

function DemoKeyBug() {
  const [items] = useState(['Apple', 'Banana', 'Cherry']);
  const [prepend, setPrepend] = useState(false);
  const list = prepend ? ['Avocado', ...items] : items;

  return (
    <div>
      <button onClick={() => setPrepend(p => !p)}>Prepend Avocado</button>
      <ul>
        {/* ❌ Bug: thêm Avocado vào đầu → tất cả input shift nhưng React */}
        {/*    giữ DOM node cũ → giá trị đánh vào bị gán sai label */}
        {list.map((item, i) => (
          <li key={i}>
            <UncontrolledInput label={item} />
          </li>
        ))}
      </ul>
      <ul>
        {/* ✅ Fix: dùng item value làm key (hoặc stable id trong thực tế) */}
        {list.map(item => (
          <li key={item}>
            <UncontrolledInput label={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Component type change: React destroy và tạo lại hoàn toàn ─────────────
const AdminPanel = memo(function AdminPanel() {
  return <div style={{ background: 'red' }}>Admin Panel</div>;
});
AdminPanel.displayName = 'AdminPanel';

const UserPanel = memo(function UserPanel() {
  return <div style={{ background: 'blue' }}>User Panel</div>;
});
UserPanel.displayName = 'UserPanel';

function RoleBasedPanel({ isAdmin }: { isAdmin: boolean }) {
  // React destroy AdminPanel và mount UserPanel (và ngược lại)
  // vì component type thay đổi tại cùng vị trí trong tree
  return isAdmin ? <AdminPanel /> : <UserPanel />;
}

// ── Dùng key để force re-mount component khi cần reset state ──────────────
function EditForm({ userId }: { userId: number }) {
  const [name, setName] = useState('');

  return (
    <form>
      <input value={name} onChange={e => setName(e.target.value)} />
      <span>Editing user #{userId}</span>
    </form>
  );
}

function UserEditor() {
  const [selectedId, setSelectedId] = useState(1);

  return (
    <div>
      <button onClick={() => setSelectedId(1)}>Edit User 1</button>
      <button onClick={() => setSelectedId(2)}>Edit User 2</button>
      {/* key={selectedId}: khi selectedId thay đổi → unmount + mount mới */}
      {/* → state trong EditForm (tên đang gõ) bị reset hoàn toàn — đúng ý muốn */}
      <EditForm key={selectedId} userId={selectedId} />
    </div>
  );
}
```

## Ứng Dụng Thực Tế

Hiểu reconciliation giúp tránh bug khó debug trong list có filter/sort (dùng sai key), và giúp dùng đúng kỹ thuật `key` để force re-mount khi cần reset component state — ví dụ form edit chuyển giữa các record, modal với content khác nhau.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>React Fiber là gì và khác gì với stack reconciler cũ?</strong></summary>

**A:** Stack reconciler cũ (trước React 16) dùng call stack đệ quy — một khi bắt đầu render, không thể dừng giữa chừng, block main thread cho đến khi xong. Fiber thay thế bằng linked list Fiber nodes — mỗi node là một unit of work. React có thể xử lý từng node, kiểm tra xem browser cần làm việc gì không (như xử lý input), rồi yield và tiếp tục sau. Fiber là nền tảng kỹ thuật cho tất cả React 18 concurrent features: Suspense, startTransition, useDeferredValue.

</details>

<details>
<summary><strong>Tại sao key quan trọng trong list và khi nào KHÔNG dùng index làm key?</strong></summary>

**A:** React dùng `key` để track identity của element qua re-render — cùng key → update (giữ DOM, giữ state), khác key → unmount cũ + mount mới. Không dùng index khi list có thể: thêm/xóa phần tử không phải cuối, reorder, sort/filter. Ví dụ: xóa item giữa danh sách → tất cả item sau shift index → React update nhầm DOM. Hậu quả: uncontrolled input giữ value sai, animation chạy sai element, performance xấu hơn (update nhiều DOM node hơn cần thiết). Dùng stable unique id từ data (database id, uuid).

</details>

<details>
<summary><strong>Reconciliation xử lý như thế nào khi list thay đổi thứ tự?</strong></summary>

**A:** Khi list reorder mà không có key (hoặc dùng index), React so sánh vị trí — item ở vị trí 0 cũ vs vị trí 0 mới, cùng type thì update props. Kết quả: nếu move item đầu xuống cuối với index key, React update nội dung của tất cả DOM node thay vì move node — O(n) DOM update thay vì O(1) move. Với unique key, React nhận ra "key=5 đã move từ vị trí 0 xuống vị trí 3" và move DOM node đó — hiệu quả hơn nhiều và uncontrolled state trong node được giữ nguyên.

</details>
