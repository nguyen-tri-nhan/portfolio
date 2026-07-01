---
key: "Authentication vs Authorization"
title: "Authentication vs Authorization"
crumb: "3. Spring Ecosystem › Spring Security"
---

Authentication xác minh danh tính ("bạn là ai?"); Authorization xác định quyền ("bạn được phép làm gì?") — authentication phải thành công trước authorization.

## Điểm Chính

- <strong>Authentication</strong>: xác minh credential (username/password, JWT signature, API key).
- <strong>Authorization</strong>: kiểm tra principal đã xác thực có quyền thực hiện action không.
- Spring: <code>AuthenticationManager</code> cho authn, <code>AccessDecisionManager</code> / <code>AuthorizationManager</code> cho authz.
- <code>@PreAuthorize("hasAuthority('SCOPE_read')")</code> hoặc <code>@Secured("ROLE_ADMIN")</code> cho method-level authz.
- RBAC (Role-Based) vs ABAC (Attribute-Based): ABAC chi tiết hơn (cho phép kiểm tra attribute request, resource).

## Ví Dụ Code

*Authentication vs Authorization: @PreAuthorize (role + ownership SpEL), @PostAuthorize (return-value check), programmatic SecurityContext access*

```java
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.*;
import org.springframework.security.core.context.SecurityContextHolder;

// ---- Authentication vs Authorization ----
// Authentication: "Who are you?" — verify identity via JWT signature / password
// Authorization:  "What can you do?" — check roles/permissions of the verified identity

// ---- 1. URL-level authorization (in SecurityConfig) ----
// Coarse-grained: rules applied before the request reaches the controller
// .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
// .requestMatchers("/api/v1/orders/**").hasAnyRole("CUSTOMER", "ADMIN")

// ---- 2. Method-level authorization with @PreAuthorize ----
// Fine-grained: SpEL expression evaluated at the method boundary
@Service
@Slf4j
public class OrderService {

    // Only ADMIN or the order's own customer can view the order
    // #customerId refers to the method parameter named "customerId"
    @PreAuthorize("hasRole('ADMIN') or #customerId == authentication.principal.username")
    public Order getOrder(Long orderId, String customerId) {
        return orderRepository.findById(orderId)
            .filter(o -> o.getCustomerId().equals(customerId) || isAdmin())
            .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    // Only users with "orders:write" scope/authority can place an order
    @PreAuthorize("hasAuthority('SCOPE_orders:write')")
    public Order placeOrder(CreateOrderRequest request) {
        // authentication is guaranteed non-null here — @PreAuthorize blocks unauthenticated calls
        String currentUser = getCurrentUsername();
        log.info("Placing order for user: {}", currentUser);
        return orderRepository.save(Order.from(request, currentUser));
    }

    // ADMIN only: refund any order regardless of customer ownership
    @PreAuthorize("hasRole('ADMIN')")
    public RefundResult refundOrder(Long orderId, String reason) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
        return paymentGateway.refund(order.getPaymentId(), order.totalAmount(), reason);
    }

    // @PostAuthorize: method executes, THEN Spring checks the returned object
    // Use when you need the return value in the authorization decision
    @PostAuthorize("returnObject.customerId == authentication.principal.username or hasRole('ADMIN')")
    public Order getOrderById(Long orderId) {
        // Order is fetched first, then checked: is it the caller's own order?
        return orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
    }
}

// ---- 3. Programmatic authorization — when SpEL is not expressive enough ----
@Service
public class PaymentService {

    public PaymentResult processRefund(Long orderId, BigDecimal amount) {
        // Access current authentication from SecurityContext (thread-local)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Authentication required");
        }

        String currentUser = auth.getName();  // principal username

        // Check roles programmatically
        boolean isAdmin = auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));

        // Custom business rule: customers can self-refund only within 24h
        if (!isAdmin) {
            if (!order.getCustomerId().equals(currentUser)) {
                throw new AccessDeniedException("Cannot refund another customer's order");
            }
            if (order.getCreatedAt().isBefore(Instant.now().minus(24, ChronoUnit.HOURS))) {
                throw new AccessDeniedException("Refund window (24h) has expired");
            }
        }

        return paymentGateway.refund(order.getPaymentId(), amount);
    }

    private String getCurrentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}

// ---- Enable method security in config ----
// @EnableMethodSecurity is already set in SecurityConfig above
// Without it, @PreAuthorize / @PostAuthorize annotations are silently IGNORED
```

## Ứng Dụng Thực Tế

Bật method security với <code>@EnableMethodSecurity</code> trong config. Dùng <code>@PreAuthorize</code> cho authorization khai báo gần business logic. Tránh đặt authorization logic trong controller — nên ở tầng service.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa authentication và authorization là gì?</strong></summary>

**A:** **Authentication (AuthN)** — xác minh identity: "Bạn là ai?" — verify username/password, JWT, API key. **Authorization (AuthZ)** — kiểm tra quyền: "Bạn được làm gì?" — sau khi biết identity, check permission. HTTP 401 = chưa authenticated; HTTP 403 = authenticated nhưng không authorized. Spring Security: `Authentication` object (AuthN) → `AccessDecisionManager` check authorities (AuthZ).

</details>

<details>
<summary><strong>Spring Security lưu trữ user đã xác thực giữa các request thế nào?</strong></summary>

**A:** Dùng `SecurityContextHolder` với `ThreadLocal` strategy mặc định — mỗi request thread có `SecurityContext` riêng chứa `Authentication`. Giữa request: session-based auth lưu vào HTTP Session; stateless REST + JWT không lưu session — mỗi request extract từ Authorization header. Để stateless: `SessionCreationPolicy.STATELESS`.

</details>

<details>
<summary><strong>Sự khác biệt giữa @Secured và @PreAuthorize là gì?</strong></summary>

**A:** **`@Secured({"ROLE_ADMIN"})`** — đơn giản, chỉ check role name, không support SpEL. **`@PreAuthorize("hasRole('ADMIN') && #userId == authentication.principal.id")`** — mạnh hơn, dùng SpEL, có thể truy cập method arguments, authentication object, gọi Spring bean. Cần enable `@EnableMethodSecurity` (Spring Security 6). Prefer `@PreAuthorize` cho flexibility.

</details>
