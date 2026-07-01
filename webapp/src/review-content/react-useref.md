---
key: react-useref
title: useRef, forwardRef & useImperativeHandle
crumb: 15. ReactJS > React Hooks
---

`useRef` trả về object `{ current }` bền vững qua các render — dùng để truy cập DOM node trực tiếp hoặc lưu giá trị mutable mà không trigger re-render khi thay đổi.

## Điểm Chính

- **DOM reference**: `ref={myRef}` gán DOM node vào `myRef.current` sau mount — dùng để focus, measure, scroll, tích hợp thư viện third-party DOM.
- **Mutable storage**: lưu giá trị không cần re-render khi thay đổi — previous value, timer ID, interval ID, flag `isMounted`.
- **Không trigger re-render**: thay đổi `ref.current` không gây render lại — khác `useState` hoàn toàn.
- **forwardRef**: cho phép component con expose ref của DOM internal ra ngoài — cần thiết khi parent cần ref của input bên trong custom component.
- **useImperativeHandle**: dùng kèm `forwardRef` để kiểm soát những gì parent nhìn thấy qua ref — thay vì expose toàn bộ DOM node, chỉ expose API cụ thể.
- **Khác state**: `ref.current` có thể mutate trực tiếp; không cần setter; thay đổi không synchronous với render cycle.
- **useRef vs createRef**: `createRef` tạo ref mới mỗi render → chỉ dùng trong class component. `useRef` giữ cùng object qua mọi render.
- Tránh dùng ref để bypass React data flow — ref là escape hatch, không phải pattern chính.

## Ví Dụ Code

*useRef cho DOM focus và previous value; forwardRef + useImperativeHandle cho custom input*

```tsx
import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  type ForwardedRef,
} from 'react';

// ── useRef: DOM focus + lưu previous value ─────────────────────────────────
function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const prevQueryRef = useRef<string>(''); // mutable storage, không re-render

  // Auto-focus khi mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Lưu previous value (không dùng state để tránh double render)
  useEffect(() => {
    prevQueryRef.current = query;
  }); // không deps → chạy sau mỗi render, sau khi render xong

  return (
    <div>
      <p>Previous search: {prevQueryRef.current}</p>
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search…"
      />
    </div>
  );
}

// ── forwardRef: expose ref của input bên trong custom component ────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

// forwardRef cần thiết để ref từ parent có thể trỏ tới internal <input>
const LabeledInput = forwardRef<HTMLInputElement, InputProps>(
  ({ label, ...props }, ref) => (
    <label>
      {label}
      <input ref={ref} {...props} />
    </label>
  )
);
LabeledInput.displayName = 'LabeledInput';

// ── useImperativeHandle: chỉ expose API cụ thể thay vì toàn bộ DOM ─────────
interface TextEditorHandle {
  focus: () => void;
  clear: () => void;
  getValue: () => string;
}

const TextEditor = forwardRef<TextEditorHandle, { defaultValue?: string }>(
  ({ defaultValue = '' }, ref: ForwardedRef<TextEditorHandle>) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Kiểm soát những gì parent nhìn thấy qua ref
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      clear: () => {
        if (textareaRef.current) textareaRef.current.value = '';
      },
      getValue: () => textareaRef.current?.value ?? '',
    }));

    return <textarea ref={textareaRef} defaultValue={defaultValue} />;
  }
);
TextEditor.displayName = 'TextEditor';

// Parent sử dụng TextEditor
function EditorPage() {
  const editorRef = useRef<TextEditorHandle>(null);

  const handleSubmit = () => {
    const content = editorRef.current?.getValue();
    console.log('Submitting:', content);
    editorRef.current?.clear();
  };

  return (
    <div>
      <TextEditor ref={editorRef} defaultValue="Write here…" />
      <button onClick={() => editorRef.current?.focus()}>Focus</button>
      <button onClick={handleSubmit}>Submit & Clear</button>
    </div>
  );
}
```

## Ứng Dụng Thực Tế

`forwardRef` và `useImperativeHandle` thường gặp trong design system components như Input, Modal, DatePicker — cho phép parent control (focus, reset) mà không cần expose implementation chi tiết. Lưu timer ID trong ref là pattern phổ biến để cancel debounce/throttle cleanup mà không cần re-render.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>ref và state khác nhau như thế nào, khi nào dùng ref?</strong></summary>

**A:** `state` kích hoạt re-render khi thay đổi và React quản lý update theo batch; `ref.current` có thể mutate trực tiếp và không trigger render. Dùng ref khi: (1) cần truy cập DOM trực tiếp (focus, measure); (2) lưu giá trị cần persist qua render nhưng thay đổi không cần UI update (timer ID, previous value, abort controller); (3) tích hợp third-party library non-React. Nếu thay đổi giá trị cần phản ánh ra UI → dùng state.

</details>

<details>
<summary><strong>forwardRef là gì và khi nào cần dùng?</strong></summary>

**A:** `forwardRef` là HOC cho phép component nhận ref từ parent và forward nó xuống DOM element hoặc component con bên trong. Cần dùng khi bạn build component wrapper — ví dụ `<CustomInput>` wrap `<input>` — và muốn parent có thể `ref={myRef}` để truy cập `<input>` thật sự. Không có `forwardRef`, ref sẽ trỏ đến component instance (với class) hoặc trả về null (với function component). Từ React 19, `ref` được truyền như prop thông thường, không cần `forwardRef` nữa.

</details>

<details>
<summary><strong>useImperativeHandle dùng trong trường hợp nào?</strong></summary>

**A:** Dùng khi muốn kiểm soát API được expose qua ref thay vì expose toàn bộ DOM node. Ví dụ: `TextEditor` component có `<textarea>` bên trong nhưng parent chỉ nên gọi `focus()`, `clear()`, `getValue()` — không nên truy cập `textarea.style` hay các thuộc tính DOM khác. `useImperativeHandle` định nghĩa "public API" của component, giúp encapsulation tốt hơn. Luôn dùng cùng `forwardRef`.

</details>
