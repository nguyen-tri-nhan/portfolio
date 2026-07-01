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

<details>
<summary><strong>Nguyên nhân LazyInitializationException và cách sửa là gì?</strong></summary>

**A:** Xảy ra khi truy cập LAZY association **ngoài persistence context** (sau transaction đã close). Ví dụ: `user.getOrders().size()` trong REST controller khi transaction đã kết thúc. Cách sửa: (1) **JOIN FETCH** trong query: `SELECT u FROM User u JOIN FETCH u.orders WHERE u.id=:id`. (2) **@EntityGraph**: `@EntityGraph(attributePaths={"orders"})` trên repository method. (3) Đổi sang EAGER (không khuyên — ảnh hưởng tất cả query). (4) DTO projection thay vì entity cho REST response.

</details>

<details>
<summary><strong>Open Session in View anti-pattern là gì?</strong></summary>

**A:** **OSIV**: giữ Hibernate session/EntityManager mở **suốt request** (kể cả rendering view/controller) — giải quyết LazyInitializationException bằng cách session vẫn active khi render. Anti-pattern vì: (1) DB connection bị giữ từ đầu đến cuối request — pool exhaustion. (2) N+1 queries xảy ra âm thầm trong view. (3) Logic DB leak sang tầng presentation. Spring Boot enable OSIV mặc định — tắt bằng `spring.jpa.open-in-view=false`, dùng DTO/projection thay thế.

</details>

<details>
<summary><strong>Khi nào bạn dùng @EntityGraph thay vì JPQL JOIN FETCH?</strong></summary>

**A:** `@EntityGraph` khi: (1) Muốn reuse đặc tả fetch plan mà không viết lại JPQL: đặt `@EntityGraph` trên nhiều repository method. (2) Muốn fetch theo attribute path phức tạp (nested): `attributePaths={"orders.items"}`. (3) Spring Data JPA method query không thể viết JOIN FETCH. **JOIN FETCH** khi: (1) Query có WHERE condition phức tạp cần tùy chỉnh. (2) Cần `DISTINCT` để tránh row duplication trong 1-to-many. (3) Kiểm soát fetch type per query một cách explicit.

</details>
