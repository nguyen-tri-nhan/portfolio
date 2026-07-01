---
key: "Abstraction"
title: "Trừu Tượng Hóa (Abstraction)"
crumb: "1. Core Java › OOP"
---

Abstraction che giấu chi tiết implementation và chỉ lộ hành vi thiết yếu, giảm độ phức tạp cho người gọi và tách biệt cái gì được làm khỏi làm thế nào.

## Điểm Chính

- Abstract class cung cấp implementation một phần + hợp đồng; dùng khi chia sẻ code giữa các class liên quan.
- Interface định nghĩa hợp đồng thuần túy; dùng khi các class không liên quan chia sẻ một hành vi.
- Interface Java 8+ hỗ trợ method <code>default</code> và <code>static</code> để evolution tương thích ngược.
- Lập trình theo interface, không theo implementation — đặc trưng của abstraction tốt.
- Abstract class có thể có constructor, state, và member non-public; interface không thể có state.

## Ví Dụ Code

*Abstraction: Interface cho unrelated classes, Abstract class cho shared state*

```java
import java.util.Optional;

// --- Interface: pure contract for unrelated classes ---
// Any class (cloud provider, mock, test double) can implement this
public interface PaymentGateway {
    ChargeResult charge(String customerId, long amountCents, String currency);
    RefundResult refund(String chargeId, long refundCents);

    // Default method — safe evolution without breaking existing implementations
    default String defaultCurrency() { return "USD"; }
}

// Two unrelated classes share the same interface:
public class StripeGateway implements PaymentGateway { /* ... */ }
public class PayPalGateway  implements PaymentGateway { /* ... */ }

// --- Abstract class: shared state + template for related classes ---
// All repositories share EntityManager and save/delete boilerplate
public abstract class BaseRepository<T, ID> {
    protected final EntityManager em;     // shared state — interfaces can't have this

    protected BaseRepository(EntityManager em) {
        this.em = Objects.requireNonNull(em);
    }

    // Shared concrete methods — DRY across all subclasses
    public void save(T entity) { em.persist(entity); }

    public void delete(T entity) { em.remove(em.contains(entity) ? entity : em.merge(entity)); }

    // Abstract: each subclass defines its own query
    public abstract Optional<T> findById(ID id);

    // Template method with hook — subclass can add extra fetching logic
    public T getOrThrow(ID id) {
        return findById(id).orElseThrow(
            () -> new EntityNotFoundException("Entity not found: " + id));
    }
}

// Concrete repo: inherits save/delete/getOrThrow, provides findById
public class OrderRepository extends BaseRepository<Order, Long> {
    public OrderRepository(EntityManager em) { super(em); }

    @Override
    public Optional<Order> findById(Long id) {
        return Optional.ofNullable(em.find(Order.class, id));
    }

    // Domain-specific query — only in this subclass
    public List<Order> findByCustomerId(String customerId) {
        return em.createQuery(
            "SELECT o FROM Order o WHERE o.customerId = :cid", Order.class)
            .setParameter("cid", customerId).getResultList();
    }
}
```

## Ứng Dụng Thực Tế

Chỉ expose interface trong service layer (ví dụ: <code>UserService</code> là interface, <code>UserServiceImpl</code> là class) giúp hoán đổi implementation trong test và cho phép mock với Mockito mà không chạm vào code gọi.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào dùng abstract class thay vì interface?</strong></summary>

**A:** Dùng **abstract class** khi cần chia sẻ state (instance fields) hoặc constructor logic giữa các subclass, hoặc muốn template method pattern với protected helpers. Dùng **interface** khi chỉ định nghĩa contract/capability, muốn đa kế thừa behavior, hoặc không cần shared state. Java 8 default methods thu hẹp khoảng cách, nhưng abstract class vẫn cần khi cần protected/package-private members.

</details>

<details>
<summary><strong>Default method trong Java 8 interface thay đổi điều gì?</strong></summary>

**A:** Trước Java 8, không thể thêm method vào interface mà không phá vỡ tất cả implementation. **Default method** cho phép evolve API mà không breaking change — ví dụ `Collection.stream()`, `Map.getOrDefault()` được thêm vào Java 8 mà không cần sửa existing code. Khi class implement nhiều interface có default method cùng tên → compile error, phải override để giải quyết.

</details>

<details>
<summary><strong>Abstraction hỗ trợ khả năng test như thế nào?</strong></summary>

**A:** Abstraction tách interface khỏi implementation, cho phép inject mock/stub trong test. Ví dụ: `UserRepository` interface → unit test dùng Mockito mock, không cần real DB. Không có abstraction: service hardcode `new JpaUserRepository()` → không thể test độc lập. Đây là foundation của **Dependency Inversion Principle** và testable code.

</details>
