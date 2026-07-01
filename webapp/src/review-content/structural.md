---
key: "Structural"
title: "Structural Patterns"
crumb: "10. Design Patterns"
---

Structural pattern kết hợp object thành cấu trúc lớn hơn — Adapter (chuyển đổi interface), Decorator (thêm hành vi), Facade (đơn giản hóa), Proxy (kiểm soát truy cập).

## Điểm Chính

- <strong>Adapter</strong>: interface không tương thích → tương thích. "Wrapper cho interface mismatch".
- <strong>Decorator</strong>: thêm hành vi động, cùng interface. Stack nhiều decorator.
- <strong>Facade</strong>: interface đơn giản cho subsystem phức tạp. Ẩn độ phức tạp.
- <strong>Proxy</strong>: surrogate object kiểm soát truy cập. Dùng bởi Spring AOP.
- Cả bốn đều bọc object — intent khác nhau: Adapter chuyển đổi, Decorator thêm, Facade đơn giản hóa, Proxy kiểm soát.

## Ví Dụ Code

*4 Structural Patterns: Adapter / Decorator / Facade / Proxy — đặt cạnh nhau*

```java
// ── ADAPTER: convert incompatible interface ──────────────────────────────────
// Old payment API we cannot modify
interface LegacyPaymentGateway { void pay(String cardNum, double amount, String cur); }
// Our modern interface
interface PaymentGateway { ChargeResult charge(ChargeRequest req); }
// Adapter bridges the gap
class LegacyPaymentAdapter implements PaymentGateway {
    private final LegacyPaymentGateway legacy;
    public ChargeResult charge(ChargeRequest req) {
        legacy.pay(req.getCardNumber(), req.getAmountAsDouble(), req.getCurrency());
        return new ChargeResult("OK-" + System.currentTimeMillis());
    }
}
// Client code uses modern interface — unaware of legacy underneath
PaymentGateway gw = new LegacyPaymentAdapter(new OldBankGateway());
gw.charge(new ChargeRequest("4111...", 9999, "USD"));

// ── DECORATOR: add behavior dynamically without subclassing ──────────────────
interface OrderService { Order placeOrder(OrderRequest req); }
class OrderServiceImpl implements OrderService { /* core logic */ }

class LoggingOrderService implements OrderService {
    private final OrderService delegate;
    LoggingOrderService(OrderService d) { this.delegate = d; }
    public Order placeOrder(OrderRequest req) {
        log.info("Placing order userId={} items={}", req.getUserId(), req.getItemCount());
        Order result = delegate.placeOrder(req);
        log.info("Order placed orderId={} total={}", result.getId(), result.getTotal());
        return result;
    }
}
// Chain: Metrics → Logging → Core
OrderService service = new MetricsOrderService(new LoggingOrderService(new OrderServiceImpl()));

// ── FACADE: simple interface hiding complex subsystem ─────────────────────────
@Service class CheckoutFacade {   // hides inventory + payment + email coordination
    public OrderResult checkout(CartRequest cart) {
        inventoryService.reserve(cart.getItems());       // subsystem 1
        PaymentResult pay = paymentService.charge(cart); // subsystem 2
        emailService.sendConfirmation(cart.getUserId()); // subsystem 3
        return new OrderResult(pay.getTransactionId());
    }
}

// ── PROXY: control access to object ──────────────────────────────────────────
// Spring AOP proxy (conceptual — applied via @Transactional)
// @Transactional on placeOrder() causes Spring to create a CGLIB proxy:
// proxy.placeOrder() → begin tx → target.placeOrder() → commit/rollback tx
// That's why self-invocation (this.placeOrder()) bypasses @Transactional
```

## Ứng Dụng Thực Tế

Spring AOP implement Proxy và Decorator một cách trong suốt — @Transactional, @Cacheable, @Async đều là decorator được áp dụng qua proxy. Hiểu điều này giải thích vấn đề self-invocation bypass.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Adapter và Facade pattern khác nhau thế nào?</strong></summary>

**A:** **Adapter**: chuyển đổi interface **không tương thích** thành interface client expect — wrap existing class để "fit in". Ví dụ: `OldPaymentProcessor` có method `processPayment(amount)`, nhưng hệ thống mới cần `pay(Money)` → Adapter implement `pay()` gọi `processPayment()`. **Facade**: tạo interface **đơn giản hóa** cho subsystem phức tạp — hide complexity, không nhất thiết phải convert interface. Ví dụ: `OrderFacade.placeOrder()` internally gọi `InventoryService`, `PaymentService`, `NotificationService`. Adapter: incompatible interface → compatible. Facade: complex subsystem → simple interface.

</details>

<details>
<summary><strong>Decorator pattern dùng thế nào trong Java?</strong></summary>

**A:** Decorator wrap object để add behavior tại runtime mà không modify class. Java I/O streams là ví dụ điển hình: `new BufferedInputStream(new FileInputStream("file"))` — Buffered decorate FileInputStream, thêm buffering. Implement:
```java
interface Coffee { double cost(); }
class SimpleCoffee implements Coffee { public double cost() { return 1.0; } }
class MilkDecorator implements Coffee {
    Coffee wrapped;
    public double cost() { return wrapped.cost() + 0.5; }
}
```
Stack decorators: `new MilkDecorator(new SugarDecorator(new SimpleCoffee()))`. Khác inheritance: multiple independent decorators có thể combine, không class explosion.

</details>

<details>
<summary><strong>Composite pattern dùng khi nào?</strong></summary>

**A:** Composite pattern khi cần treat **individual objects và groups of objects uniformly** — tree structure. Interface chung cho cả leaf và composite: `Component { void render() }`. `Leaf implements Component` (no children). `Composite implements Component` (has List<Component> children) — `render()` delegate to all children. Ví dụ: File system (File và Directory đều có `size()`, `delete()`), UI components (Button và Panel đều có `draw()`), Menu system (MenuItem và Menu đều có `click()`). Client code không cần biết đang deal với leaf hay composite.

</details>
