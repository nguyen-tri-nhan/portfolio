---
key: "Resilience4j"
title: "Resilience4j"
crumb: "5. Microservices › Circuit Breaker"
---

Resilience4j là thư viện fault tolerance nhẹ cho Java cung cấp Circuit Breaker, Retry, Rate Limiter, Bulkhead và TimeLimiter dưới dạng decorator có thể kết hợp.

## Điểm Chính

- <code>@CircuitBreaker</code>: mở circuit sau ngưỡng failure rate, đóng sau khi chờ.
- <code>@Retry</code>: retry khi exception với số lần thử và backoff có thể cấu hình.
- <code>@TimeLimiter</code>: timeout cho async call (bọc <code>CompletableFuture</code>).
- <code>@Bulkhead</code>: giới hạn concurrent call (semaphore-based hoặc thread-pool-based).
- <code>@RateLimiter</code>: giới hạn call mỗi khoảng thời gian trong chính service.
- Metric tích hợp với Micrometer — tự động expose lên Prometheus/Grafana.

## Ví Dụ Code

*Resilience4j full YAML: Retry (exponential backoff), CircuitBreaker, TimeLimiter, Bulkhead (semaphore + thread-pool), RateLimiter + Java annotations*

```bash
# ✅ Resilience4j: full configuration for order-service calling inventory-service
# Decorator execution order (outermost → innermost):
# Bulkhead → TimeLimiter → CircuitBreaker → Retry → RateLimiter → actual call

resilience4j:
  # ── Retry: try again on transient errors ──
  retry:
    instances:
      inventoryService:
        max-attempts: 3                 # 1 original + 2 retries
        wait-duration: 500ms            # wait 500ms between attempts
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2   # 500ms → 1000ms → 2000ms
        retry-exceptions:
          - java.io.IOException
          - feign.FeignException$ServiceUnavailable
        ignore-exceptions:
          - com.example.exception.OutOfStockException  # don't retry business errors

  # ── Circuit Breaker: protect against cascading failure ──
  circuitbreaker:
    instances:
      inventoryService:
        sliding-window-type: COUNT_BASED     # evaluate last N calls
        sliding-window-size: 20              # last 20 calls
        failure-rate-threshold: 50           # OPEN if >50% fail
        slow-call-duration-threshold: 2s     # calls >2s counted as failure
        slow-call-rate-threshold: 80         # OPEN if >80% calls are slow
        wait-duration-in-open-state: 60s     # stay OPEN for 60s
        permitted-number-of-calls-in-half-open-state: 5  # probe with 5 test calls
        minimum-number-of-calls: 10          # need at least 10 calls before tripping

  # ── TimeLimiter: cancel calls that take too long ──
  timelimiter:
    instances:
      inventoryService:
        timeout-duration: 3s                 # cancel if >3 seconds
        cancel-running-future: true

  # ── Bulkhead: limit concurrent calls (semaphore-based) ──
  # Prevents inventory-service from consuming all order-service threads
  bulkhead:
    instances:
      inventoryService:
        max-concurrent-calls: 15            # max 15 simultaneous calls allowed
        max-wait-duration: 500ms            # queue for 500ms; BulkheadFullException if still full

  # ── Thread-pool Bulkhead (alternative): isolates calls in dedicated thread pool ──
  thread-pool-bulkhead:
    instances:
      inventoryService:
        core-thread-pool-size: 5
        max-thread-pool-size: 10
        queue-capacity: 20                  # tasks queue up here before rejection

  # ── RateLimiter: limit calls TO inventory-service (protect downstream) ──
  ratelimiter:
    instances:
      inventoryService:
        limit-for-period: 100               # max 100 calls per period
        limit-refresh-period: 1s            # reset every second
        timeout-duration: 200ms             # wait 200ms for permission

// ✅ Java annotation usage (apply all decorators)
@CircuitBreaker(name = "inventoryService", fallbackMethod = "inventoryFallback")
@TimeLimiter(name = "inventoryService")
@Bulkhead(name = "inventoryService", type = Bulkhead.Type.SEMAPHORE)
@Retry(name = "inventoryService")
public CompletableFuture<ReserveResult> reserveStock(Long orderId, List<OrderItem> items) {
    return CompletableFuture.supplyAsync(() -> inventoryClient.reserve(orderId, items));
}

public CompletableFuture<ReserveResult> inventoryFallback(Long orderId, List<OrderItem> items, Throwable t) {
    log.error("Inventory service unavailable for orderId={}", orderId, t);
    // Degrade gracefully: put reservation in pending queue for async retry
    reservationQueue.enqueue(new PendingReservation(orderId, items));
    return CompletableFuture.completedFuture(ReserveResult.queued(orderId));
}
```

## Ứng Dụng Thực Tế

Dùng Resilience4j với Spring Cloud OpenFeign cho inter-service call. Áp dụng decorator theo thứ tự: TimeLimiter → CircuitBreaker → Retry → Bulkhead (hoặc dùng @annotation theo thứ tự đó). Điều chỉnh ngưỡng dựa trên SLO quan sát được, không phải giá trị mặc định.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa Resilience4j Bulkhead và Circuit Breaker là gì?
1. @TimeLimiter hoạt động với CompletableFuture thế nào?
1. slow-call-rate-threshold trong cấu hình circuit breaker là gì?
