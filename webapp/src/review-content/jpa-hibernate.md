---
key: "JPA / Hibernate"
title: "JPA / Hibernate"
crumb: "4. Database"
---

JPA là đặc tả Java persistence API; Hibernate là implementation phổ biến nhất — map Java object sang relational table với các tính năng ORM như lazy loading, caching và lifecycle management.

## Điểm Chính

- <code>@Entity</code>, <code>@Table</code>, <code>@Id</code>, <code>@Column</code>, <code>@GeneratedValue</code>.
- Relationship: <code>@OneToMany</code>, <code>@ManyToOne</code>, <code>@ManyToMany</code>, <code>@OneToOne</code>.
- JPQL: ngôn ngữ query hướng đối tượng. Native SQL cho query phức tạp.
- First-level cache (Session): trong transaction, cùng ID trả về cùng object. Second-level cache: qua nhiều session (Ehcache, Redis).
- Dirty checking: Hibernate theo dõi thay đổi state của managed entity và tự tạo UPDATE khi flush.

## Ví Dụ Code

*JPA entity: @ManyToOne LAZY, @OneToMany cascade+orphanRemoval, @Version, @CreatedDate + Repository với JOIN FETCH và native query*

```java
// ✅ JPA Entity: Order with all common annotations
@Entity
@Table(name = "orders",
       indexes = { @Index(name = "idx_orders_customer", columnList = "customer_id"),
                   @Index(name = "idx_orders_status",   columnList = "status, created_at") })
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // LAZY: don't load User unless explicitly accessed — avoids unexpected query
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @Enumerated(EnumType.STRING)  // store "PENDING" not "0" — survives enum reordering
    @Column(nullable = false)
    private OrderStatus status;

    @Column(name = "total", precision = 10, scale = 2, nullable = false)
    private BigDecimal total;

    // Cascade: save/delete Order also saves/deletes its items
    // orphanRemoval: removing item from list triggers DELETE (not just detach)
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<OrderItem> items = new ArrayList<>();

    @Version                      // optimistic locking: prevents lost updates
    private Long version;

    @CreatedDate                  // Spring Data: auto-set on persist
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate             // Spring Data: auto-set on every update
    private LocalDateTime updatedAt;
}

// ✅ Repository with custom JPQL queries
public interface OrderRepository extends JpaRepository<Order, Long> {

    // JOIN FETCH: load order + items in ONE query (prevents N+1)
    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product " +
           "WHERE o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") Long id);

    // Derived query: Spring generates SQL from method name
    List<Order> findByCustomerIdAndStatusOrderByCreatedAtDesc(Long customerId, OrderStatus status);

    // Native SQL: complex aggregation not expressible in JPQL
    @Query(value = "SELECT DATE_TRUNC('month', created_at), SUM(total), COUNT(*) " +
                   "FROM orders WHERE customer_id = :cid GROUP BY 1 ORDER BY 1",
           nativeQuery = true)
    List<Object[]> getMonthlyStatsByCustomer(@Param("cid") Long customerId);
}
```

## Ứng Dụng Thực Tế

Luôn định nghĩa <code>FetchType.LAZY</code> trên collection và association <code>@ManyToOne</code>. Chỉ tải eager khi cần qua JOIN FETCH trong query cụ thể. Bật <code>spring.jpa.show-sql=true</code> trong dev để bắt query bất ngờ.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa EAGER và LAZY fetching là gì?</strong></summary>

**A:** **EAGER**: quan hệ được load **cùng lúc** khi load entity — luôn có data, nhưng có thể load data không cần thiết (N+1 problem, unnecessary JOIN). **LAZY**: quan hệ chỉ được load **khi truy cập** — proxy được inject, SQL issue khi access. Vấn đề LAZY: nếu truy cập ngoài transaction (LazyInitializationException). JPA default: `@ManyToOne`, `@OneToOne` = EAGER; `@OneToMany`, `@ManyToMany` = LAZY. Best practice: tất cả LAZY, fetch explicitly khi cần bằng JOIN FETCH hoặc EntityGraph.

</details>

<details>
<summary><strong>Dirty checking trong Hibernate là gì?</strong></summary>

**A:** Khi entity được load trong persistence context (managed state), Hibernate giữ **snapshot** của trạng thái ban đầu. Khi flush (commit hoặc explicit flush), Hibernate so sánh current state với snapshot — nếu khác → tự động generate UPDATE SQL. Không cần gọi `save()` hay `update()` cho managed entity. Overhead: so sánh tất cả field của tất cả managed entity trước flush. Tối ưu: `@DynamicUpdate` chỉ UPDATE changed column; hạn chế số managed entity trong session.

</details>

<details>
<summary><strong>JPA first-level cache hoạt động thế nào?</strong></summary>

**A:** **First-level cache** (L1) là **persistence context** — map từ entity ID đến entity instance. Trong cùng transaction, `em.find(User.class, 1L)` lần đầu → hit DB; lần hai → return từ cache, không query DB. Cache scope: một transaction/EntityManager — không share giữa transaction. Hệ quả: trong cùng transaction, modify entity → close entity manager → next transaction thấy DB state (không thấy modification nếu không commit). L2 cache (optional, EHCache/Caffeine) share giữa transaction.

</details>
