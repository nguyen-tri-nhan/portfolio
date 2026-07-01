---
key: react-component-patterns
title: Component Design Patterns
crumb: 15. ReactJS > Patterns & Performance
---

Các pattern tổ chức component giúp tái sử dụng logic và UI linh hoạt — Compound Component cho API tự nhiên, HOC cho cross-cutting concern, Render Props và Custom Hook cho logic sharing.

## Điểm Chính

- **Compound Component**: nhóm component con hoạt động cùng nhau với shared state qua Context — `<Select>`, `<Select.Option>` pattern; API tự nhiên như HTML.
- **HOC (Higher Order Component)**: function nhận component, trả về component mới với behavior thêm vào — `withAuth`, `withLogging`. Bị thay thế dần bởi hooks trong modern React.
- **Render Props**: component nhận function làm prop để kiểm soát render — `<DataFetcher render={data => <View data={data} />}`. Hooks cũng thay thế hầu hết use case này.
- **Provider Pattern**: kết hợp Context + component — encapsulate state phức tạp và cung cấp API qua hook.
- **Container/Presentational**: tách logic (container) khỏi UI (presentational) — container fetch data, presentational chỉ render. Ít dùng hơn từ khi có hooks.
- **Compound Component vs Props**: `<Select value={v} options={opts} onChange={fn}>` vs `<Select><Option>A</Option></Select>` — compound linh hoạt hơn nhưng phức tạp hơn.
- Modern React ưa hooks + composition hơn HOC — ít wrapper hell, type-safe hơn, dễ debug hơn.
- HOC vẫn hữu ích khi cần wrap class component hoặc third-party component không thể modify.

## Ví Dụ Code

*Compound Component (Accordion); HOC withAuth; so sánh Render Props vs Custom Hook*

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

// ── Compound Component: Accordion ──────────────────────────────────────────
interface AccordionContextValue {
  openItems: Set<string>;
  toggle: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('Must be used within Accordion');
  return ctx;
}

// Root component quản lý shared state
function Accordion({ children, allowMultiple = false }: {
  children: ReactNode;
  allowMultiple?: boolean;
}) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) next.clear(); // chỉ mở một item
        next.add(id);
      }
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className="accordion">{children}</div>
    </AccordionContext.Provider>
  );
}

// Sub-components đọc shared state qua context
function AccordionItem({ id, children }: { id: string; children: ReactNode }) {
  return <div className="accordion-item" data-id={id}>{children}</div>;
}

function AccordionTrigger({ itemId, children }: { itemId: string; children: ReactNode }) {
  const { openItems, toggle } = useAccordion();
  const isOpen = openItems.has(itemId);

  return (
    <button
      onClick={() => toggle(itemId)}
      aria-expanded={isOpen}
      style={{ fontWeight: isOpen ? 'bold' : 'normal' }}
    >
      {children} {isOpen ? '▲' : '▼'}
    </button>
  );
}

function AccordionContent({ itemId, children }: { itemId: string; children: ReactNode }) {
  const { openItems } = useAccordion();
  if (!openItems.has(itemId)) return null;
  return <div className="accordion-content">{children}</div>;
}

// Attach sub-components (namespace pattern)
Accordion.Item = AccordionItem;
Accordion.Trigger = AccordionTrigger;
Accordion.Content = AccordionContent;

// Usage — API tự nhiên, flexible
function FAQPage() {
  return (
    <Accordion allowMultiple>
      <Accordion.Item id="q1">
        <Accordion.Trigger itemId="q1">Câu hỏi 1?</Accordion.Trigger>
        <Accordion.Content itemId="q1">Trả lời 1</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item id="q2">
        <Accordion.Trigger itemId="q2">Câu hỏi 2?</Accordion.Trigger>
        <Accordion.Content itemId="q2">Trả lời 2</Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

// ── HOC: withAuth ──────────────────────────────────────────────────────────
interface WithAuthProps { currentUser: { name: string; role: string } }

function withAuth<P extends WithAuthProps>(
  WrappedComponent: React.ComponentType<P>,
  requiredRole?: string
) {
  return function AuthenticatedComponent(props: Omit<P, keyof WithAuthProps>) {
    const user = { name: 'Nhan', role: 'admin' }; // normally from context/store

    if (!user) return <div>Please login</div>;
    if (requiredRole && user.role !== requiredRole) return <div>Access denied</div>;

    return <WrappedComponent {...(props as P)} currentUser={user} />;
  };
}

function AdminDashboard({ currentUser }: WithAuthProps) {
  return <div>Welcome, {currentUser.name} (Admin)</div>;
}

const ProtectedDashboard = withAuth(AdminDashboard, 'admin');
// Usage: <ProtectedDashboard />  — currentUser được inject tự động
```

## Ứng Dụng Thực Tế

Compound Component pattern là nền tảng của các design system lớn như Radix UI, Headless UI — cho phép user customize từng phần mà không cần fork component. HOC vẫn thấy trong codebase legacy và khi wrapping third-party components; trong code mới, custom hook + composition là preferred approach.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Compound Component pattern là gì và ưu điểm so với props thông thường?</strong></summary>

**A:** Compound Component là nhóm component con làm việc cùng nhau qua shared Context — ví dụ `<Select>`, `<Option>`, `<Menu>`, `<MenuItem>`. Ưu điểm so với props API: (1) **Flexible composition** — user quyết định cấu trúc, không phải component author; (2) **Tự nhiên hơn** — giống HTML native elements; (3) **Tránh prop explosion** — không cần `renderHeader`, `renderFooter`, `headerProps`, `footerStyle`... Props API dễ implement nhưng rigid; compound component linh hoạt hơn cho complex, customizable UI.

</details>

<details>
<summary><strong>HOC khác Custom Hook như thế nào và khi nào còn dùng HOC?</strong></summary>

**A:** HOC wrap component và trả về component mới — có thể inject props, add behavior, conditional render. Custom hook extract logic nhưng không wrap component. Vấn đề HOC: wrapper hell (nhiều lớp HOC lồng nhau), props collision (HOC và component dùng cùng prop name), khó debug (component tree sâu hơn). Custom hook không có những vấn đề này và type-safe hơn. Vẫn dùng HOC khi: cần wrap class component (không dùng hook được), wrap third-party component không thể modify source, hoặc cần conditional rendering ở component level (như route protection).

</details>

<details>
<summary><strong>Render Props pattern là gì và tại sao bị thay thế bởi Hooks?</strong></summary>

**A:** Render Props là pattern truyền function làm prop — component gọi function đó để render, cho phép chia sẻ logic mà consumer kiểm soát output. Ví dụ: `<MouseTracker render={pos => <Cursor x={pos.x} y={pos.y} />} />`. Vấn đề: callback hell khi lồng nhiều Render Props, khó đọc, performance issue nếu function tạo mới mỗi render. Custom hook giải quyết cùng use case: `const pos = useMouseTracker()` — rõ ràng hơn, composable hơn, không tạo extra DOM node. Render Props vẫn hữu ích khi cần inject phần UI vào vị trí cụ thể trong component.

</details>
