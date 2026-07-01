---
key: "Proxy"
title: "Proxy Pattern"
crumb: "10. Design Patterns › Structural"
---

Proxy cung cấp surrogate hoặc placeholder cho object khác để kiểm soát truy cập — dùng cho lazy initialization, access control, remote invocation và logging.

## Điểm Chính

- <strong>Virtual Proxy</strong>: trì hoãn tạo object tốn kém đến khi dùng lần đầu.
- <strong>Protection Proxy</strong>: enforce access control trước khi delegate.
- <strong>Remote Proxy</strong>: represent object trong JVM/process khác (gRPC stub, Feign client).
- Spring AOP: tạo CGLIB hoặc JDK dynamic proxy để áp dụng @Transactional, @Cacheable, @Async.
- Self-invocation bypass proxy — lời gọi đi thẳng đến target, bỏ qua AOP advice.

## Ví Dụ Code

*Spring AOP proxy + JDK dynamic proxy + Virtual proxy lazy init + Protection proxy*

```java
// ── 1. Spring AOP Proxy (most common in production) ──────────────────────────
// When @Service OrderService has @Transactional method,
// Spring creates a CGLIB proxy — you interact with the proxy, not the real object
@Service
public class OrderService {
    @Transactional   // Spring wraps this in a proxy
    public Order placeOrder(OrderRequest req) { /* real logic */ return null; }

    public void processBatch(List<OrderRequest> requests) {
        requests.forEach(req -> {
            // ❌ WRONG: "this.placeOrder()" calls real method, bypasses proxy → NO transaction!
            this.placeOrder(req);
            // ✅ CORRECT: go through proxy
            ((OrderService) AopContext.currentProxy()).placeOrder(req);
        });
    }
    // Or better: extract placeOrder to a separate @Service bean
}

// ── 2. JDK Dynamic Proxy — interface-based (lightweight) ─────────────────────
interface OrderRepository {
    Order findById(Long id);
    Order save(Order order);
}
// Manual dynamic proxy: add logging to any OrderRepository
OrderRepository loggingProxy = (OrderRepository) Proxy.newProxyInstance(
    OrderRepository.class.getClassLoader(),
    new Class[]{ OrderRepository.class },
    (proxy, method, args) -> {
        log.info(">> {}.{}({})", "OrderRepository", method.getName(), Arrays.toString(args));
        long start = System.currentTimeMillis();
        Object result = method.invoke(realRepository, args);   // delegate to real object
        log.info("<< {} returned in {} ms", method.getName(), System.currentTimeMillis() - start);
        return result;
    }
);

// ── 3. Virtual Proxy — lazy initialization of expensive resource ──────────────
interface ReportGenerator { byte[] generateSalesReport(LocalDate from, LocalDate to); }

class LazyReportGeneratorProxy implements ReportGenerator {
    private ReportGenerator real;          // null until first use
    private final DataSource dataSource;
    private final S3Client   s3Client;

    LazyReportGeneratorProxy(DataSource ds, S3Client s3) {
        this.dataSource = ds; this.s3Client = s3;
        // real ReportGenerator NOT created yet — skips expensive init
    }

    @Override
    public synchronized byte[] generateSalesReport(LocalDate from, LocalDate to) {
        if (real == null) {
            // Only create when actually needed — first call triggers initialization
            real = new RealSalesReportGenerator(dataSource, s3Client);
        }
        return real.generateSalesReport(from, to);
    }
}

// ── 4. Protection Proxy — access control before delegating ───────────────────
class SecuredOrderService implements OrderService {
    private final OrderService    delegate;
    private final SecurityContext securityCtx;

    public Order cancelOrder(Long orderId) {
        Order order = delegate.findById(orderId);
        // Only the order owner or admin can cancel
        if (!securityCtx.currentUserId().equals(order.getUserId()) &&
            !securityCtx.hasRole("ADMIN")) {
            throw new AccessDeniedException("Cannot cancel order " + orderId);
        }
        return delegate.cancelOrder(orderId);
    }
}
// Spring equivalent: @PreAuthorize("hasRole('ADMIN') or #orderId == authentication.name")
```

## Ứng Dụng Thực Tế

Hiểu cơ chế proxy Spring là chìa khóa debug @Transactional/@Cacheable không hoạt động: (1) self-invocation, (2) class không được Spring quản lý, (3) method private/final. Cả ba đều bypass proxy.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>JDK dynamic proxy và CGLIB proxy khác nhau thế nào trong Spring AOP?</strong></summary>

**A:** **JDK dynamic proxy**: tạo proxy implement cùng **interface** — target class phải implement interface. Proxy intercept tất cả method call qua interface. **CGLIB**: tạo subclass của **target class** — không cần interface. Spring dùng CGLIB khi class không có interface. Cả hai dùng cho `@Transactional`, `@Cacheable`, `@Async`. Chú ý: final class/method không thể proxy bằng CGLIB (không subclass được). Spring Boot 2.x default CGLIB cho `@Configuration`, JDK proxy cho interface-based bean. `spring.aop.proxy-target-class=true` force CGLIB.

</details>

<details>
<summary><strong>Self-invocation vấn đề gì với Spring AOP?</strong></summary>

**A:** Spring AOP proxy wrap bean từ bên ngoài — khi `this.method()` được gọi trong cùng class, bypass proxy → AOP advice không được apply. Ví dụ: `@Transactional` method A gọi `this.methodB()` (cũng `@Transactional`) → methodB không có transaction mới vì bypass proxy. Fix: (1) Inject bean vào chính nó (`@Autowired MyService self`) — gọi qua proxy. (2) Dùng `AopContext.currentProxy()`. (3) Refactor: extract methodB vào service khác. Đây là limitation của proxy-based AOP.

</details>

<details>
<summary><strong>Proxy pattern dùng để làm gì ngoài Spring AOP?</strong></summary>

**A:** Proxy pattern có nhiều use case: (1) **Lazy initialization**: tạo object thực sự khi cần (expensive resource — DB connection, large object). (2) **Access control**: check permission trước khi delegate (protection proxy). (3) **Caching**: cache kết quả, không gọi real object nếu cached. (4) **Remote proxy**: đại diện cho object ở remote system (RPC stub). (5) **Logging/monitoring**: log mọi method call không cần modify original. (6) **Smart reference**: GC tracking, ref counting. Spring AOP, Hibernate lazy loading, Java RMI đều dùng proxy pattern.

</details>
