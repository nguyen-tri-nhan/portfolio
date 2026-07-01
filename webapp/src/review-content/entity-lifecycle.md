---
key: "Entity Lifecycle"
title: "Vòng Đời JPA Entity"
crumb: "4. Database › JPA / Hibernate"
---

JPA entity chuyển qua các trạng thái: Transient → Persistent → Detached → Removed, với Hibernate theo dõi entity managed (persistent) để auto-flush.

## Điểm Chính

- <strong>Transient</strong>: object mới, không được persistence context biết. Không có DB row.
- <strong>Persistent</strong> (Managed): liên kết với Session/EntityManager đang hoạt động. Thay đổi được auto-flush.
- <strong>Detached</strong>: đã là persistent nhưng Session đóng. Thay đổi KHÔNG được theo dõi. Dùng <code>merge()</code> để re-attach.
- <strong>Removed</strong>: được lên lịch xóa. DELETE khi flush/commit.
- Lifecycle callback: <code>@PrePersist</code>, <code>@PostPersist</code>, <code>@PreUpdate</code>, <code>@PostLoad</code>.

## Ví Dụ Code

*4 trạng thái entity lifecycle: Transient, Persistent (dirty checking), Detached (merge), Removed + lifecycle callbacks*

```java
// ✅ State 1: TRANSIENT — new object, not known to any EntityManager
Order newOrder = new Order();
newOrder.setCustomer(customer);
newOrder.setTotal(BigDecimal.valueOf(199.99));
// At this point: no DB row, no EntityManager tracking

// ✅ State 2: PERSISTENT (Managed) — inside a transaction, tracked by EntityManager
@Transactional
public Order processOrder(Long orderId) {
    // findById: loads from DB → entity becomes PERSISTENT (tracked)
    Order order = orderRepository.findById(orderId).orElseThrow();

    // Dirty checking: Hibernate snapshots the state at load time
    order.setStatus(OrderStatus.PROCESSING);  // just a Java setter
    order.setUpdatedAt(LocalDateTime.now());

    // NO explicit save() needed — Hibernate detects the change via dirty check
    // At flush (end of transaction): issues UPDATE orders SET status='PROCESSING', updated_at=? WHERE id=?
    return order;
}  // ← Transaction commits here → flush → DB updated → session closes → entity becomes DETACHED

// ✅ State 3: DETACHED — session closed, changes NOT tracked
// This is the returned order object above — it's now detached
order.setStatus(OrderStatus.SHIPPED);  // DOES NOT update DB — no active EntityManager!

// ✅ Re-attaching: merge() copies detached state into a new managed entity
@Transactional
public Order reattachAndSave(Order detachedOrder) {
    Order managed = em.merge(detachedOrder);
    // merge() finds/loads the entity by ID and copies fields from detachedOrder into it
    // managed is the PERSISTENT version — detachedOrder remains detached
    return managed;
}

// ✅ State 4: REMOVED — scheduled for deletion
@Transactional
public void cancelOrder(Long orderId) {
    Order order = orderRepository.findById(orderId).orElseThrow();
    // State: PERSISTENT → REMOVED
    em.remove(order);  // or: orderRepository.delete(order);
    // On flush: DELETE FROM orders WHERE id = ?
    // (CascadeType.ALL on items → also deletes order_items)
}

// ✅ Lifecycle callbacks for audit timestamps
@Entity
public class Order {
    @PrePersist
    void onPrePersist() { this.createdAt = LocalDateTime.now(); }

    @PreUpdate
    void onPreUpdate() { this.updatedAt = LocalDateTime.now(); }

    @PostLoad
    void onPostLoad() { /* e.g., decrypt sensitive fields after load */ }
}
```

## Ứng Dụng Thực Tế

Đừng bao giờ trả về managed entity từ service layer sang controller — chúng có thể trigger lazy loading sau khi session đóng (LazyInitializationException). Map sang DTO bên trong transaction.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa managed và detached entity là gì?</strong></summary>

**A:** **Managed**: entity đang được Persistence Context (EntityManager) theo dõi — mọi thay đổi tự động persist khi flush/commit (dirty checking). **Detached**: entity không còn được EntityManager theo dõi — thay đổi sẽ không tự persist, phải gọi `merge()` để reattach. Entity trở thành detached khi: EntityManager close, gọi `detach()`, transaction end (với TRANSACTION scope). DTO pattern tránh detached entity vấn đề.

</details>

<details>
<summary><strong>Khi nào Hibernate issue UPDATE SQL cho field đã thay đổi?</strong></summary>

**A:** Hibernate issue UPDATE khi: (1) Transaction commit (hoặc `flush()` được gọi) với managed entity đã bị modify. (2) Default: Hibernate flush **tất cả changed entities trong persistence context** trước khi execute query để đảm bảo query thấy data mới nhất. Hibernate default UPDATE tất cả columns (không chỉ changed column) — dùng `@DynamicUpdate` để chỉ update changed columns (giảm lock contention, tốt cho wide table).

</details>

<details>
<summary><strong>Mục đích của merge() vs persist() là gì?</strong></summary>

**A:** **`persist()`**: thêm **new (transient) entity** vào persistence context — entity chưa có ID, sau commit sẽ INSERT. Throw exception nếu entity đã có ID. **`merge()`**: copy state của **detached entity** vào managed entity — load managed entity từ DB (hoặc tạo mới nếu không có), copy state, return managed entity. Dùng persist() cho create mới; merge() khi nhận detached entity từ bên ngoài (REST API, Session deserialization).

</details>
