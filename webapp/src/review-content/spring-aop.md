---
key: "Spring AOP"
title: "Spring AOP"
crumb: "3. Spring Ecosystem"
---

Spring AOP cho phép cross-cutting concern (logging, transaction, security) được áp dụng khai báo qua aspect chặn method call trên Spring bean.

## Điểm Chính

- Khái niệm AOP: <strong>Aspect</strong> (module), <strong>Advice</strong> (code), <strong>Pointcut</strong> (nơi áp dụng), <strong>Join Point</strong> (method call thực tế).
- Spring AOP dựa trên proxy — không phải bytecode weaving. Chỉ hoạt động trên Spring-managed bean và public method.
- <code>@Before</code>, <code>@After</code>, <code>@AfterReturning</code>, <code>@AfterThrowing</code>, <code>@Around</code>.
- Giới hạn self-invocation: gọi method trên <code>this</code> bỏ qua proxy!
- <code>@Transactional</code>, <code>@Cacheable</code>, <code>@Async</code> đều được implement qua AOP.

## Ví Dụ Code

*Spring AOP: @TrackExecutionTime custom annotation + @Around advice with Micrometer metrics + slow-call warning + self-invocation pitfall*

```java
import org.aspectj.lang.annotation.*;
import org.aspectj.lang.*;
import org.springframework.stereotype.*;
import java.lang.annotation.*;

// ---- Custom annotation to trigger the aspect ----
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface TrackExecutionTime {
    String operation() default "";  // optional description for metrics label
}

// ---- Aspect: @Around intercepts method, measures time, logs slow calls ----
@Aspect
@Component
@Slf4j
public class PerformanceMonitoringAspect {

    private final MeterRegistry meterRegistry;

    public PerformanceMonitoringAspect(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    // Pointcut: any method annotated with @TrackExecutionTime
    // "trackExecutionTime" is the annotation object bound to the advice parameter
    @Around("@annotation(trackExecutionTime)")
    public Object measureExecutionTime(ProceedingJoinPoint joinPoint,
                                       TrackExecutionTime trackExecutionTime) throws Throwable {
        String className  = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String operation  = trackExecutionTime.operation().isBlank()
                            ? className + "." + methodName
                            : trackExecutionTime.operation();

        long startNanos = System.nanoTime();
        boolean success = true;

        try {
            // Proceed: actually invoke the original method with its original arguments
            Object result = joinPoint.proceed();
            return result;
        } catch (Throwable ex) {
            success = false;
            throw ex;  // rethrow — don't swallow exceptions in @Around
        } finally {
            long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000;

            // Record to Micrometer (exposed via /actuator/prometheus for Grafana)
            meterRegistry.timer("method.execution.time",
                "operation", operation,
                "success",   String.valueOf(success))
                .record(elapsedMs, TimeUnit.MILLISECONDS);

            if (elapsedMs > 500) {
                log.warn("[SLOW] {} took {}ms (threshold: 500ms)", operation, elapsedMs);
            } else {
                log.debug("[PERF] {} took {}ms", operation, elapsedMs);
            }
        }
    }
}

// ---- Using the aspect ----
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentGateway  paymentGateway;

    public OrderService(OrderRepository orderRepository, PaymentGateway paymentGateway) {
        this.orderRepository = orderRepository;
        this.paymentGateway  = paymentGateway;
    }

    // Aspect intercepts this call — no timing code in business logic
    @TrackExecutionTime(operation = "order.place")
    public Order placeOrder(CreateOrderRequest request) {
        Order order = Order.from(request);
        orderRepository.save(order);
        paymentGateway.charge(request.paymentMethod(), order.totalAmount());
        return order;
    }

    @TrackExecutionTime(operation = "order.search")
    public List<Order> searchOrders(OrderSearchCriteria criteria) {
        return orderRepository.search(criteria);
    }

    // ---- IMPORTANT: self-invocation BYPASSES the AOP proxy ----
    public void processBatch(List<CreateOrderRequest> requests) {
        for (CreateOrderRequest req : requests) {
            this.placeOrder(req);   // 'this' refers to real object, NOT the proxy
            // @TrackExecutionTime will NOT fire here!
            // Fix: inject the bean itself via @Autowired self-injection (Spring workaround)
            // OR refactor placeOrder to a different bean
        }
    }
}
```

## Ứng Dụng Thực Tế

Dùng AOP cho logging, metrics và auditing — những concern này không nên làm ô nhiễm business code. Nhớ self-invocation bypass: nếu <code>service.methodA()</code> gọi <code>this.methodB()</code>, không có AOP áp dụng cho methodB. Inject chính bean đó qua <code>ApplicationContext</code> để làm việc quanh vấn đề này.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa @Before và @Around advice là gì?
1. Tại sao Spring AOP không hoạt động với self-invocation?
1. @Transactional được implement nội bộ thế nào?
