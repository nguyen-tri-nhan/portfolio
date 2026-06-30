---
key: "Aspect / Pointcut / Advice"
title: "Aspect / Pointcut / Advice"
crumb: "3. Spring Ecosystem › Spring AOP"
---

Aspect chứa Advice (cần làm gì) được áp dụng tại Pointcut (áp dụng ở đâu) — cùng nhau chúng định nghĩa hành vi cross-cutting khai báo.

## Điểm Chính

- <strong>Aspect</strong>: class <code>@Aspect</code> — module chứa pointcut và advice.
- <strong>Pointcut</strong>: biểu thức khớp join point. Cú pháp: <code>execution(* com.example.service.*.*(..))</code>.
- <strong>Kiểu advice</strong>: <code>@Before</code>, <code>@After</code>, <code>@AfterReturning(returning="result")</code>, <code>@AfterThrowing(throwing="ex")</code>, <code>@Around</code>.
- Biểu thức pointcut: <code>execution</code>, <code>@annotation</code>, <code>within</code>, <code>args</code>, <code>bean</code>.
- <code>@Around</code> mạnh nhất — có thể chỉnh sửa argument, return value và suppress exception.

## Ví Dụ Code

*Aspect/Pointcut/Advice: named @Pointcut expressions, @Before/@AfterReturning/@AfterThrowing/@After/@Around, audit trail to DB, @Auditable annotation*

```java
import org.aspectj.lang.annotation.*;
import org.aspectj.lang.*;
import org.springframework.stereotype.*;

// ---- AOP vocabulary ----
// Aspect:    the class — groups related cross-cutting behavior (e.g. audit logging)
// Pointcut:  an expression selecting which methods to intercept
// Advice:    the code that runs at the join point (@Before, @After, @Around, etc.)
// Join Point: the specific method call where advice fires at runtime

@Aspect
@Component
@Slf4j
public class OrderAuditAspect {

    private final AuditLogRepository auditLogRepository;

    public OrderAuditAspect(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    // ---- Pointcut definitions — reusable expressions ----

    // Matches any public method in any class under the service package
    @Pointcut("execution(public * com.example.order.service.*.*(..))")
    public void serviceLayer() {}

    // Matches methods on OrderService specifically
    @Pointcut("execution(* com.example.order.service.OrderService.*(..))")
    public void orderServiceMethods() {}

    // Matches methods annotated with @Auditable (custom annotation)
    @Pointcut("@annotation(com.example.order.annotation.Auditable)")
    public void auditableMethods() {}

    // Combine pointcuts: all service methods AND annotated methods
    @Pointcut("serviceLayer() || auditableMethods()")
    public void auditTarget() {}

    // ---- @Before: runs BEFORE the method; cannot modify return value ----
    @Before("orderServiceMethods()")
    public void logBeforeOrder(JoinPoint joinPoint) {
        String method = joinPoint.getSignature().toShortString();
        Object[] args = joinPoint.getArgs();
        log.debug("[PRE]  {} called with args: {}", method, Arrays.toString(args));
    }

    // ---- @AfterReturning: runs after SUCCESSFUL completion; can inspect return value ----
    @AfterReturning(pointcut = "orderServiceMethods()", returning = "result")
    public void auditSuccessfulOrder(JoinPoint joinPoint, Object result) {
        String method = joinPoint.getSignature().getName();
        log.info("[POST] {} succeeded, result: {}", method, result);

        // Persist audit trail for compliance
        if (result instanceof Order order) {
            auditLogRepository.save(AuditLog.builder()
                .action(method)
                .entityId(String.valueOf(order.getId()))
                .userId(SecurityContextHolder.getContext().getAuthentication().getName())
                .timestamp(Instant.now())
                .outcome("SUCCESS")
                .build());
        }
    }

    // ---- @AfterThrowing: runs when method throws; can log/re-throw ----
    @AfterThrowing(pointcut = "orderServiceMethods()", throwing = "exception")
    public void auditFailedOrder(JoinPoint joinPoint, Exception exception) {
        String method = joinPoint.getSignature().getName();
        log.error("[FAIL] {} threw {}: {}", method, exception.getClass().getSimpleName(), exception.getMessage());

        auditLogRepository.save(AuditLog.builder()
            .action(method)
            .userId(getCurrentUser())
            .timestamp(Instant.now())
            .outcome("FAILURE")
            .errorMessage(exception.getMessage())
            .build());
        // @AfterThrowing does NOT suppress exceptions — they still propagate to the caller
    }

    // ---- @After: runs always (success OR exception) — like finally block ----
    @After("auditableMethods()")
    public void releaseResources(JoinPoint joinPoint) {
        // Always runs — cleanup MDC, release thread-local state, etc.
        log.trace("[ALWAYS] {} completed (success or failure)", joinPoint.getSignature().getName());
    }

    // ---- @Around: most powerful — wraps entire method, can change args/return/exception ----
    @Around("@annotation(auditable)")  // "auditable" parameter bound from annotation
    public Object aroundAuditable(ProceedingJoinPoint joinPoint, Auditable auditable) throws Throwable {
        String action = auditable.action().isBlank()
                        ? joinPoint.getSignature().getName()
                        : auditable.action();
        log.info("[AUDIT] Starting: {}", action);
        try {
            Object result = joinPoint.proceed();  // call the real method
            log.info("[AUDIT] Completed: {}", action);
            return result;
        } catch (Throwable ex) {
            log.error("[AUDIT] Failed: {} — {}", action, ex.getMessage());
            throw ex;
        }
    }

    private String getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "anonymous";
    }
}

// ---- Custom annotation used as pointcut ----
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    String action() default "";   // describes what the action does
}

// ---- Annotated service methods ----
@Service
public class PaymentService {
    @Auditable(action = "payment.refund")
    public RefundResult refundOrder(Long orderId, String reason) {
        // @Around auditableMethods() intercepts this
        return paymentGateway.refund(orderId, reason);
    }
}
```

## Ứng Dụng Thực Tế

Kết hợp pointcut <code>@annotation</code> với annotation tùy chỉnh cho kiểm soát chi tiết — chỉ aspect method bạn đánh dấu tường minh. Dùng pointcut <code>execution</code> cho chặn cấp package rộng (ví dụ: tất cả service).

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa joinpoint và pointcut là gì?
1. Khi nào dùng @Around thay vì @Before + @AfterReturning?
1. Làm thế nào để truyền argument từ pointcut sang advice method?
