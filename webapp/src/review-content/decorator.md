---
key: "Decorator"
title: "Decorator Pattern"
crumb: "10. Design Patterns › Structural"
---

Decorator thêm trách nhiệm vào object một cách động bằng cách bọc nó bằng decorator object cùng interface — cho phép stack hành vi linh hoạt không cần subclass.

## Điểm Chính

- Decorator implement cùng interface với component nó bọc.
- Có thể stack nhiều decorator: <code>new Logging(new Caching(new JdbcRepo()))</code>.
- Java I/O: <code>new BufferedReader(new FileReader("f.txt"))</code>.
- Spring: @Transactional, @Cacheable, @Async được áp dụng qua proxy decoration.

## Ví Dụ Code

*LoggingOrderService + MetricsOrderService chain wrapping OrderServiceImpl*

```java
// ── OrderService interface — shared by all decorators ────────────────────────
interface OrderService {
    Order placeOrder(OrderRequest request);
    Order cancelOrder(Long orderId);
}

// ── Core implementation ────────────────────────────────────────────────────
@Service
class OrderServiceImpl implements OrderService {
    private final OrderRepository repo;
    private final PaymentGateway  paymentGateway;
    OrderServiceImpl(OrderRepository repo, PaymentGateway pg) { this.repo = repo; this.paymentGateway = pg; }

    public Order placeOrder(OrderRequest req) {
        Order order = new Order(req);
        paymentGateway.charge(ChargeRequest.from(order));
        return repo.save(order);
    }
    public Order cancelOrder(Long orderId) {
        Order order = repo.findById(orderId).orElseThrow();
        order.cancel();
        return repo.save(order);
    }
}

// ── Decorator 1: Logging — wraps any OrderService ─────────────────────────
@Slf4j
class LoggingOrderService implements OrderService {
    private final OrderService delegate;
    LoggingOrderService(OrderService delegate) { this.delegate = delegate; }

    public Order placeOrder(OrderRequest req) {
        log.info("[ORDER] placeOrder start userId={} itemCount={}", req.getUserId(), req.getItemCount());
        long start = System.currentTimeMillis();
        try {
            Order result = delegate.placeOrder(req);
            log.info("[ORDER] placeOrder success orderId={} total={} ms={}",
                result.getId(), result.getTotal(), System.currentTimeMillis() - start);
            return result;
        } catch (Exception e) {
            log.error("[ORDER] placeOrder failed userId={} error={}", req.getUserId(), e.getMessage());
            throw e;
        }
    }
    public Order cancelOrder(Long orderId) {
        log.info("[ORDER] cancelOrder orderId={}", orderId);
        Order result = delegate.cancelOrder(orderId);
        log.info("[ORDER] cancelOrder success status={}", result.getStatus());
        return result;
    }
}

// ── Decorator 2: Metrics — wraps LoggingOrderService ──────────────────────
class MetricsOrderService implements OrderService {
    private final OrderService delegate;
    private final MeterRegistry meterRegistry;
    MetricsOrderService(OrderService delegate, MeterRegistry registry) {
        this.delegate = delegate; this.meterRegistry = registry;
    }

    public Order placeOrder(OrderRequest req) {
        return meterRegistry.timer("order.place", "userId", req.getUserId())
            .record(() -> {                                  // wraps real call with timing
                Order order = delegate.placeOrder(req);
                meterRegistry.counter("order.placed", "status", order.getStatus().name()).increment();
                return order;
            });
    }
    public Order cancelOrder(Long orderId) {
        Order result = delegate.cancelOrder(orderId);
        meterRegistry.counter("order.cancelled").increment();
        return result;
    }
}

// ── Compose the chain: Metrics → Logging → Core ───────────────────────────
// Each decorator unaware of others — only knows OrderService interface
OrderService core     = new OrderServiceImpl(repo, paymentGateway);
OrderService logged   = new LoggingOrderService(core);      // core + logging
OrderService measured = new MetricsOrderService(logged, meterRegistry); // + metrics

// Client code uses the outermost decorator
measured.placeOrder(request);
// Execution: MetricsOrderService → LoggingOrderService → OrderServiceImpl

// ── Spring alternative: @Aspect for cross-cutting concerns ────────────────
// @Around("execution(* com.example.OrderService.placeOrder(..))")
// → same effect without manual wrapping; Spring auto-generates proxy
```

## Ứng Dụng Thực Tế

Trong Spring, dùng AOP-based decoration (@Cacheable, @Transactional) thay vì manual wrapper. Manual decorator hữu ích khi AOP không khả dụng hoặc cần decorator trong context không có DI.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Decorator khác Proxy thế nào?</strong></summary>

**A:** **Decorator**: thêm behavior/responsibility mới, được compose từ bên ngoài bởi client, có thể stack nhiều decorator. Focus: enhancement. **Proxy**: control access đến subject — authentication, caching, lazy init, remote proxy. Focus: control. Decorator thường transparent (implement cùng interface, forward call); Proxy thường thay thế subject về phía client. Ranh giới mờ trong thực tế: `@Transactional` là Proxy (control), `BufferedInputStream` là Decorator (enhance).

</details>

<details>
<summary><strong>Khi nào dùng Decorator thay vì subclass?</strong></summary>

**A:** Dùng Decorator khi: (1) Muốn thêm responsibility **tại runtime** theo nhiều combination khác nhau — subclass tạo class explosion nếu có N feature × M variant. (2) Muốn compose từ bên ngoài mà không sửa original class. (3) Class bị final (không thể subclass). Ví dụ: Logger với timestamp decorator + json formatter decorator + file writer — 8 combination mà chỉ cần 3 decorator class thay vì 8 subclass.

</details>

<details>
<summary><strong>Java I/O stream dùng Decorator thế nào?</strong></summary>

**A:** `InputStream` là component interface. `FileInputStream` là concrete component. `BufferedInputStream`, `GZIPInputStream`, `DataInputStream` là concrete decorator — đều wrap một `InputStream` khác. Stack: `new DataInputStream(new BufferedInputStream(new GZIPInputStream(new FileInputStream(file))))` — đọc compressed, buffered binary file với type-aware API. Mỗi decorator thêm một layer behavior mà không sửa class kia.

</details>
