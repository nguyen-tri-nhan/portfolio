---
key: "Dependency Injection"
title: "Dependency Injection"
crumb: "3. Spring Ecosystem › Spring Core"
---

DI là hình thức cụ thể của IoC, nơi dependency được container cung cấp thay vì class tự tạo — cho phép loose coupling và testability.

## Điểm Chính

- <strong>Constructor injection</strong>: dependency bắt buộc; immutable; dễ test mà không cần Spring.
- <strong>Setter injection</strong>: dependency tùy chọn; có thể re-inject lúc runtime.
- <strong>Field injection</strong> (<code>@Autowired</code> trên field): tiện lợi nhưng che giấu dependency, phá vỡ immutability, khó test.
- Spring Boot: single constructor tự động autowired mà không cần annotation <code>@Autowired</code>.
- <code>@Qualifier("name")</code> hoặc <code>@Primary</code> để phân biệt khi có nhiều bean cùng type.

## Ví Dụ Code

*Constructor injection (required), setter injection (optional), @Qualifier + @Primary disambiguation*

```java
import org.springframework.beans.factory.annotation.*;
import org.springframework.stereotype.*;

// ---- 1. Constructor Injection (RECOMMENDED) ----
// Dependencies are explicit, field is final (immutable), no Spring needed for unit tests
@Service
public class OrderService {
    private final OrderRepository   orderRepository;
    private final PaymentGateway    paymentGateway;
    private final InventoryService  inventoryService;

    // Single constructor → @Autowired is implicit in Spring Boot (no annotation needed)
    public OrderService(OrderRepository orderRepository,
                        PaymentGateway paymentGateway,
                        InventoryService inventoryService) {
        this.orderRepository  = Objects.requireNonNull(orderRepository, "orderRepository must not be null");
        this.paymentGateway   = Objects.requireNonNull(paymentGateway,  "paymentGateway must not be null");
        this.inventoryService = Objects.requireNonNull(inventoryService, "inventoryService must not be null");
    }

    public Order placeOrder(CreateOrderRequest req) {
        inventoryService.reserve(req.getItems());       // check stock first
        Order order = orderRepository.save(Order.from(req));
        paymentGateway.charge(req.getPaymentMethod(), order.totalAmount());
        return order;
    }
    // Unit test: new OrderService(mockRepo, mockGateway, mockInventory) — no Spring needed!
}

// ---- 2. Setter Injection — for OPTIONAL dependencies ----
@Service
public class ProductService {
    private final ProductRepository productRepository;
    private NotificationService notificationService;  // optional — not always present

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    // Setter injection: dependency is optional; bean works without it
    @Autowired(required = false)
    public void setNotificationService(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    public void updatePrice(String productId, BigDecimal newPrice) {
        productRepository.updatePrice(productId, newPrice);
        // Guard: notification is optional
        if (notificationService != null) {
            notificationService.notifyPriceChange(productId, newPrice);
        }
    }
}

// ---- 3. @Qualifier: disambiguate multiple beans of same type ----
public interface PaymentGateway {
    PaymentResult charge(PaymentMethod method, BigDecimal amount);
}

@Component("stripeGateway")
public class StripeGateway implements PaymentGateway { /* ... */ }

@Component("paypalGateway")
public class PayPalGateway implements PaymentGateway { /* ... */ }

// Inject specific implementation by qualifier name
@Service
public class CheckoutService {
    private final PaymentGateway paymentGateway;

    // @Qualifier selects the correct bean among multiple candidates
    public CheckoutService(@Qualifier("stripeGateway") PaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }
}

// Alternative: use @Primary to mark the default implementation
@Component @Primary
public class DefaultPaymentGateway implements PaymentGateway { /* used when no @Qualifier */ }
```

## Ứng Dụng Thực Tế

Trong test, inject mock implementation qua constructor — không cần Spring test context. Điều này làm unit test nhanh (< 1ms startup). Dùng <code>@MockBean</code> trong integration test khi cần Spring context nhưng muốn thay một bean.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Constructor injection có ưu điểm gì so với field injection?</strong></summary>

**A:** (1) **Immutability**: dependencies final → thread-safe và rõ ràng về required dependencies. (2) **Testability**: instantiate class trực tiếp `new Service(repo)` mà không cần Spring container — unit test đơn giản hơn. (3) **Circular dependency detection**: Spring fail fast khi startup thay vì runtime. (4) **Explicit contract**: constructor signature rõ ràng về dependencies cần thiết. Field injection (`@Autowired` trên field) ẩn dependencies, cần Spring để instantiate, không thể mark final. Spring team recommend constructor injection.

</details>

<details>
<summary><strong>Circular dependency xảy ra thế nào và Spring xử lý thế nào?</strong></summary>

**A:** A depends on B, B depends on A → circular. Với constructor injection: Spring throw `BeanCurrentlyInCreationException` at startup — fail fast là behavior tốt. Với field/setter injection: Spring resolve bằng cách tạo bean A trước (incomplete), inject vào B, rồi inject B vào A — có thể hoạt động nhưng che giấu design problem. Best fix: refactor để loại bỏ circular dependency — extract common logic sang bean C, hoặc dùng event-based communication (`ApplicationEventPublisher`).

</details>
