---
key: "Cross-Cutting Concerns"
title: "Cross-Cutting Concern"
crumb: "3. Spring Ecosystem › Spring AOP"
---

Cross-cutting concern là hành vi ảnh hưởng nhiều layer/class (logging, security, transaction, caching) — AOP trích xuất chúng vào aspect để tránh rải rác và rối rắm.

## Điểm Chính

- Không có AOP: mỗi service method có logging, try-catch cho metrics, auth check → rối rắm, khó thay đổi.
- Với AOP: một aspect xử lý toàn bộ logging, một cho transaction, một cho security — mỗi concern ở một chỗ.
- Cross-cutting concern phổ biến trong Spring: <code>@Transactional</code>, <code>@Cacheable</code>, <code>@Async</code>, <code>@PreAuthorize</code>.
- AOP cải thiện maintainability — thay đổi concern ở một nơi, áp dụng khắp nơi.

## Ví Dụ Code

*Cross-cutting concerns: before AOP (tangled 40-line method) vs after AOP (@PreAuthorize + @Transactional + @Timed + @Cacheable + @Auditable = 4-line business method)*

```java
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import io.micrometer.core.annotation.Timed;
import org.springframework.cache.annotation.*;

// ============================================================
// BEFORE AOP: cross-cutting concerns tangled into business code
// ============================================================
@Service
public class OrderServiceTangled {

    public Order placeOrder(CreateOrderRequest request) {
        // ---- security check — not business logic ----
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated())
            throw new AccessDeniedException("Must be authenticated");
        if (!auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_CUSTOMER")))
            throw new AccessDeniedException("Must have CUSTOMER role");

        // ---- logging — not business logic ----
        log.info("[START] placeOrder: userId={}, items={}", request.getUserId(), request.getItems().size());
        long startTime = System.nanoTime();

        // ---- transaction management — not business logic ----
        txManager.begin();
        try {
            // actual business logic — only 3 lines in 40 lines of method!
            Order order = Order.from(request);
            orderRepository.save(order);
            paymentGateway.charge(request.getPaymentMethod(), order.totalAmount());

            txManager.commit();

            // ---- metrics — not business logic ----
            meterRegistry.counter("orders.placed").increment();
            long elapsedMs = (System.nanoTime() - startTime) / 1_000_000;
            log.info("[END] placeOrder succeeded: orderId={}, took={}ms", order.getId(), elapsedMs);
            return order;

        } catch (Exception ex) {
            txManager.rollback();
            // ---- error metrics — not business logic ----
            meterRegistry.counter("orders.failed",
                "reason", ex.getClass().getSimpleName()).increment();
            log.error("[FAIL] placeOrder failed after {}ms",
                (System.nanoTime() - startTime) / 1_000_000, ex);
            throw ex;
        }
    }
}

// ============================================================
// AFTER AOP: each concern extracted to its own aspect/annotation
// ============================================================
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentGateway  paymentGateway;

    public OrderService(OrderRepository orderRepository, PaymentGateway paymentGateway) {
        this.orderRepository = orderRepository;
        this.paymentGateway  = paymentGateway;
    }

    // Security enforced by Spring Security AOP — no security code here
    @PreAuthorize("hasRole('CUSTOMER')")

    // Transaction managed by Spring @Transactional AOP — no txManager calls here
    @Transactional

    // Metrics recorded by Micrometer AOP — no meterRegistry code here
    @Timed(value = "orders.placed", description = "Time to place an order", percentiles = {0.5, 0.95, 0.99})

    // Auditing handled by our custom AuditAspect — no audit code here
    @Auditable(action = "order.place")

    // Result cached by Spring Cache AOP — no cache code here
    // (Not applicable for writes, but shown for get operations)
    public Order placeOrder(CreateOrderRequest request) {
        // ---- Pure business logic — nothing else ----
        Order order = Order.from(request);
        orderRepository.save(order);
        paymentGateway.charge(request.getPaymentMethod(), order.totalAmount());
        return order;
        // 4 lines vs 40 lines above. All cross-cutting concerns handled by annotations/aspects.
    }

    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    @Transactional(readOnly = true)   // readOnly=true: Hibernate uses READ COMMITTED, skips flush
    @Cacheable(value = "orders", key = "#orderId")  // Spring Cache AOP caches the result
    public Order getOrder(Long orderId) {
        return orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    @CacheEvict(value = "orders", key = "#orderId")  // evicts stale cache entry on update
    public Order cancelOrder(Long orderId, String reason) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
        order.cancel(reason);
        return orderRepository.save(order);
    }
}
```

## Ứng Dụng Thực Tế

Xác định những gì KHÔNG thuộc về business method và chuyển sang aspect. Business code nên diễn đạt <em>cần làm gì</em>; aspect xử lý <em>làm thế nào</em> để làm điều đó an toàn và có thể quan sát.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Cross-cutting concern là gì? Đặt tên ba ví dụ trong Spring app điển hình.</strong></summary>

**A:** Cross-cutting concern là functionality cắt ngang nhiều module/layer, không thuộc business logic của bất kỳ module cụ thể nào. Ba ví dụ phổ biến trong Spring: (1) **Logging**: log method call, parameter, thời gian thực thi. (2) **Security/Authorization**: check quyền trước khi thực thi method. (3) **Transaction management**: bắt đầu/commit/rollback transaction xung quanh service method. Thêm: caching, audit trail, performance monitoring, retry.

</details>

<details>
<summary><strong>Aspect cải thiện maintainability code thế nào?</strong></summary>

**A:** Không có AOP: code logging/security/transaction rải rác khắp mọi class → khi cần thay đổi (đổi log format, thêm security check) phải sửa hàng chục file. Với Aspect: tập trung một nơi, thêm/sửa behavior mà không sửa business code. Ví dụ: thêm execution time logging cho tất cả service method chỉ cần thêm một `@Around` aspect — business code không thay đổi. Separation of concerns → dễ test business logic độc lập.

</details>

<details>
<summary><strong>Nhược điểm của việc lạm dụng AOP là gì?</strong></summary>

**A:** (1) **Debug khó**: behavior xảy ra "ẩn" — stack trace qua proxy layers phức tạp. (2) **Performance overhead**: proxy invocation cho mỗi method call. (3) **Self-invocation không hoạt động**: `this.method()` bypass proxy → `@Transactional` self-invocation bug phổ biến. (4) **Khó predict behavior**: developer mới không biết có aspect nào đang chạy. Rule: chỉ dùng AOP cho cross-cutting concern thực sự, không dùng cho business logic.

</details>
