---
key: "N+1 Problem"
title: "Vấn Đề N+1 Query"
crumb: "4. Database › JPA / Hibernate"
---

N+1 xảy ra khi fetch N entity cha trigger N query bổ sung (một mỗi entity) để tải lazy association — tránh được với JOIN FETCH hoặc batch fetching.

## Điểm Chính

- Ví dụ: fetch 100 order, sau đó truy cập <code>order.getCustomer()</code> → 100 SELECT query bổ sung.
- Tổng cộng: 1 (order) + N (customer) = N+1 query.
- Phát hiện: <code>spring.jpa.show-sql=true</code> + Hibernate statistics, hoặc thư viện <code>datasource-proxy</code>.
- Sửa 1: <code>JOIN FETCH</code> trong JPQL.
- Sửa 2: <code>@BatchSize(size=30)</code> trên association — tải 30 mỗi lần.
- Sửa 3: Dùng DTO projection và một join query duy nhất.

## Ví Dụ Code

*N+1: problem illustration + 4 fixes: JOIN FETCH, @EntityGraph, @BatchSize, DTO Projection*

```java
// ❌ N+1 Problem: 1 query to load orders + N queries for each order's items
List<Order> orders = orderRepository.findAll();  // 1 query: SELECT * FROM orders
for (Order order : orders) {
    // Each access fires a new SELECT — N queries!
    order.getItems().size();     // LAZY fetch triggered: SELECT * FROM order_items WHERE order_id=?
    // For 100 orders → 100 extra queries → 101 queries total!
}

// ✅ Fix 1: JOIN FETCH in JPQL — single query loads orders + items together
@Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items WHERE o.status = :status")
List<Order> findWithItemsByStatus(@Param("status") OrderStatus status);
// SQL: SELECT o.*, oi.* FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
//      WHERE o.status = ?
// → 1 query instead of N+1; DISTINCT prevents duplicate Order objects from join

// ✅ Fix 2: @EntityGraph — declarative version of JOIN FETCH, cleaner for complex graphs
@EntityGraph(attributePaths = {"items", "items.product"})
List<Order> findByCustomerId(Long customerId);
// Loads: order + order_items + product for each item — all in 1 query
// Best when: multiple associations needed; avoids writing JPQL

// ✅ Fix 3: Batch fetch size — replaces N individual queries with ceil(N/50) IN queries
// In application.yml:
// spring.jpa.properties.hibernate.default_batch_fetch_size=50
// Or per-association:
@OneToMany(mappedBy = "order", fetch = FetchType.LAZY)
@BatchSize(size = 50)  // instead of N queries: SELECT * FROM order_items WHERE order_id IN (?, ?, ..., ?)
private List<OrderItem> items;
// For 100 orders: 2 IN queries instead of 100 individual queries

// ✅ Fix 4: DTO Projection — skip entity loading entirely, query only needed columns
@Query("SELECT new com.example.dto.OrderSummary(o.id, o.total, o.status, SIZE(o.items)) " +
       "FROM Order o WHERE o.customer.id = :customerId")
List<OrderSummary> findOrderSummaries(@Param("customerId") Long customerId);
// Single optimized query; no entity graph loaded; no lazy proxies

// ✅ Detecting N+1 in tests with datasource-proxy
// @ExtendWith(MockitoExtension.class)
// @QuickPerfTest
// @ExpectSelect(1)  // fails test if more than 1 SELECT is issued
// public void testFindOrders() { ... }
```

## Ứng Dụng Thực Tế

Bật Hibernate statistics trong dev (<code>spring.jpa.properties.hibernate.generate_statistics=true</code>) và fail-fast nếu số query vượt ngưỡng. Dùng <code>datasource-proxy</code> + <code>QuickPerfExtension</code> trong test để bắt N+1 trước khi đến production.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>N+1 problem xảy ra thế nào? Ví dụ code cụ thể.</strong></summary>

**A:** Load 1 query lấy N Order objects, sau đó với mỗi Order, Hibernate lazy-load `order.getItems()` → thêm 1 query = tổng N+1 queries. Ví dụ: `List<Order> orders = orderRepo.findAll();` (1 query) rồi `orders.forEach(o -> o.getItems().size())` → 100 additional queries. Detect bằng Hibernate `hibernate.show_sql=true` hoặc p6spy. Ảnh hưởng: 100 orders → 101 queries thay vì 1.

</details>

<details>
<summary><strong>Fix N+1 trong JPA/Hibernate bằng những cách nào?</strong></summary>

**A:** (1) **JOIN FETCH**: `SELECT o FROM Order o JOIN FETCH o.items WHERE o.userId=:id` — một query lấy tất cả. (2) **@EntityGraph**: `@EntityGraph(attributePaths={"items"})` trên repository method. (3) **Batch fetching**: `@BatchSize(size=50)` trên collection — Hibernate group N lazy loads thành batches của 50, không hoàn hảo nhưng giảm queries. (4) **DTO projection**: chỉ SELECT fields cần thiết, không load entity với lazy collection. (5) **MyBatis**: dùng ResultMap với JOIN — một query, không N+1 risk.

</details>
