---
key: "Builder"
title: "Builder Pattern"
crumb: "10. Design Patterns › Creational"
---

Builder xây dựng object phức tạp từng bước với fluent API, giải quyết vấn đề telescoping constructor và cho phép object bất biến với nhiều optional field.

## Điểm Chính

- Giải quyết: constructor với quá nhiều parameter (đặc biệt là optional).
- Fluent API: <code>builder().field1(v).field2(v).build()</code>.
- Lombok <code>@Builder</code>: tự động tạo builder class. <code>@Builder.Default</code> cho default value.
- Validation trong <code>build()</code>: throw nếu required field thiếu.
- JDK: <code>StringBuilder</code>, <code>HttpRequest.newBuilder()</code>, <code>Stream.Builder</code>.

## Ví Dụ Code

*Order.builder() manual với validation + Lombok @Builder showcase với custom build()*

```java
// ── 1. Manual Builder với validation trong build() ───────────────────────────
public final class Order {  // immutable
    private final String       userId;
    private final List<OrderItem> items;
    private final String       currency;
    private final BigDecimal   discountPercent;
    private final LocalDateTime deliverBy;

    private Order(Builder b) {
        this.userId          = b.userId;
        this.items           = List.copyOf(b.items);   // defensive copy
        this.currency        = b.currency;
        this.discountPercent = b.discountPercent;
        this.deliverBy       = b.deliverBy;
    }

    public static class Builder {
        // required fields
        private final String          userId;
        private final List<OrderItem> items;
        // optional fields with defaults
        private String       currency        = "USD";
        private BigDecimal   discountPercent = BigDecimal.ZERO;
        private LocalDateTime deliverBy      = LocalDateTime.now().plusDays(7);

        public Builder(String userId, List<OrderItem> items) {
            this.userId = userId;
            this.items  = items;
        }
        public Builder currency(String c)        { this.currency        = c; return this; }
        public Builder discount(BigDecimal pct)  { this.discountPercent = pct; return this; }
        public Builder deliverBy(LocalDateTime d){ this.deliverBy       = d; return this; }

        public Order build() {
            // Validation in build() — fail fast with clear messages
            if (userId == null || userId.isBlank())
                throw new IllegalStateException("userId is required");
            if (items == null || items.isEmpty())
                throw new IllegalStateException("Order must have at least one item");
            if (discountPercent.compareTo(BigDecimal.ZERO) < 0 ||
                discountPercent.compareTo(new BigDecimal("100")) > 0)
                throw new IllegalStateException("discountPercent must be 0-100");
            if (deliverBy.isBefore(LocalDateTime.now()))
                throw new IllegalStateException("deliverBy must be in the future");
            return new Order(this);
        }
    }
}

// Usage: readable, self-documenting
Order order = new Order.Builder("user-42", List.of(new OrderItem("product-1", 2, new BigDecimal("49.99"))))
    .currency("VND")
    .discount(new BigDecimal("10"))    // 10% VIP discount
    .deliverBy(LocalDateTime.now().plusDays(3))
    .build();

// ── 2. Lombok @Builder — eliminates boilerplate for DTOs/requests ─────────────
@Builder
@Value  // @Value makes all fields final + generates getters/equals/hashCode
public class OrderRequest {
    String          userId;
    List<OrderItem> items;
    @Builder.Default String currency = "USD";           // default value
    @Builder.Default boolean express = false;           // default false

    // Custom validation via @Builder.Default or custom builder method
    public static class OrderRequestBuilder {
        public OrderRequest build() {
            if (userId == null) throw new IllegalStateException("userId required");
            if (items == null || items.isEmpty()) throw new IllegalStateException("items required");
            return new OrderRequest(userId, items, currency, express);
        }
    }
}

// Usage with Lombok
OrderRequest req = OrderRequest.builder()
    .userId("u1")
    .items(List.of(new OrderItem("p1", 1, new BigDecimal("99.99"))))
    .currency("USD")
    .express(true)
    .build();
```

## Ứng Dụng Thực Tế

Dùng Lombok @Builder cho tất cả DTO, request/response class với hơn 3 field. Chỉ viết manual builder khi build() cần business validation hoặc khi quá trình xây dựng có logic riêng.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao Builder tốt hơn telescoping constructor?</strong></summary>

**A:** Telescoping constructor: `new User(name, email, phone, address, age)` — 5 tham số, dễ nhầm thứ tự, không rõ tham số nào là gì. Builder: `User.builder().name("John").email("j@e.com").age(30).build()` — explicit, readable, optional fields dễ handle. Named parameters (không phải positional). Immutable object dễ tạo. Validate trong `build()`. Lombok `@Builder` generate automatically. Tránh builder khi object đơn giản (< 4 tham số) — overkill.

</details>
