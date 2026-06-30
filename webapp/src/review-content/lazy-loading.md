---
key: "Lazy Loading"
title: "Lazy Loading"
crumb: "4. Database › JPA / Hibernate"
---

Lazy loading hoãn fetch entity liên kết cho đến khi thực sự được truy cập, giảm overhead query ban đầu nhưng có nguy cơ LazyInitializationException bên ngoài transaction.

## Điểm Chính

- Mặc định: <code>@OneToMany</code> và <code>@ManyToMany</code> là LAZY; <code>@ManyToOne</code> và <code>@OneToOne</code> là EAGER.
- Hibernate tạo proxy cho lazy association; SQL chạy khi truy cập lần đầu.
- <strong>LazyInitializationException</strong>: truy cập lazy collection sau khi Session đóng.
- Sửa: dùng JOIN FETCH trong query, hoặc scope <code>@Transactional</code>, hoặc <code>@EntityGraph</code>.
- <code>Hibernate.initialize(entity.getItems())</code>: force-initialize trong session.

## Ví Dụ Code

*LazyInitializationException + 4 fixes: JOIN FETCH, @EntityGraph, DTO Projection, @Transactional scope*

```java
// ❌ Problem: LazyInitializationException
// findById() opens+closes session; items are LAZY — not loaded yet
@Service
public class OrderService {
    public OrderDto getOrder(Long id) {
        Order order = orderRepository.findById(id).orElseThrow();
        // ↓ Session is CLOSED here — Hibernate proxy has no open connection to load items
        return new OrderDto(order.getId(), order.getItems());  // throws LazyInitializationException!
    }
}

// ✅ Fix 1: JOIN FETCH in JPQL — single query that loads order + items together
// Generates: SELECT o.*, oi.* FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.id=?
public interface OrderRepository extends JpaRepository<Order, Long> {
    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.items oi LEFT JOIN FETCH oi.product WHERE o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") Long id);
}

// ✅ Fix 2: @EntityGraph — declarative, reusable, avoids JPQL for simple cases
public interface OrderRepository extends JpaRepository<Order, Long> {
    @EntityGraph(attributePaths = {"items", "items.product"})
    Optional<Order> findById(Long id);  // same method signature, Spring overrides fetch behavior
    // Best for: loading specific associations without duplicating JPQL
}

// ✅ Fix 3: DTO Projection — skip entity loading entirely, query exactly what's needed
// Spring Data generates the JOIN and maps directly to the interface — no entity in memory
public interface OrderRepository extends JpaRepository<Order, Long> {
    interface OrderSummary {
        Long   getId();
        String getStatus();
        BigDecimal getTotal();
        String getCustomerEmail();  // nested: customer.email accessible via projection
    }
    List<OrderSummary> findByCustomerIdAndStatus(Long customerId, OrderStatus status);
    // SQL: SELECT o.id, o.status, o.total, u.email FROM orders o JOIN users u ON ... WHERE ...
}

// ✅ Fix 4: @Transactional scope — keep session open for the whole service method
@Service
public class OrderService {
    @Transactional(readOnly = true)  // readOnly=true: no flush, optimized for reads
    public OrderDto getOrder(Long id) {
        Order order = orderRepository.findById(id).orElseThrow();
        // Session still OPEN inside @Transactional — lazy load works here
        order.getItems().forEach(item -> item.getProduct().getName());  // triggers lazy loads
        return OrderDto.from(order);  // map inside transaction before session closes
    }
}
```

## Ứng Dụng Thực Tế

Pattern an toàn nhất: fetch chính xác những gì bạn cần trong query (JOIN FETCH hoặc EntityGraph), map sang DTO trong transaction, trả về DTO. Đừng bao giờ dùng <code>spring.jpa.open-in-view=true</code> (anti-pattern "open session in view") trong production.

## Câu Hỏi Phỏng Vấn

1. Nguyên nhân LazyInitializationException và cách sửa là gì?
1. Open Session in View anti-pattern là gì?
1. Khi nào bạn dùng @EntityGraph thay vì JPQL JOIN FETCH?
