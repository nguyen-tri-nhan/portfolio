---
key: "Bulkhead & Isolation"
title: "Bulkhead Pattern"
crumb: "7. System Design › High Concurrency"
---

Bulkhead cô lập component với resource pool riêng để bão hòa hoặc failure ở một component không cascade sang component khác — đặt tên theo vách ngăn tàu thủy ngăn một khoang bị ngập không làm chìm cả tàu.

## Điểm Chính

- <strong>Thread pool bulkhead</strong>: executor riêng cho mỗi downstream service. Service chậm làm đầy pool của nó, không chiếm tài nguyên chung.
- <strong>Semaphore bulkhead</strong>: giới hạn max concurrent call không cần thread pool riêng. Overhead thấp hơn, cô lập kém hơn.
- Resilience4j: <code>@Bulkhead(name="paymentService")</code> — annotation-based bulkhead với fallback method.
- Kết hợp Circuit Breaker: Bulkhead giới hạn concurrency; Circuit Breaker dừng gọi khi failure rate vượt ngưỡng.
- Không có Bulkhead: một downstream service chậm chiếm hết HTTP thread pool chung → mọi endpoint khác bị degraded.

## Ví Dụ Code

*Resilience4j Bulkhead + Circuit Breaker*

```yaml
# application.yml — Resilience4j Bulkhead
resilience4j:
  bulkhead:
    instances:
      paymentService:
        maxConcurrentCalls: 10    # tối đa 10 call đồng thời đến payment
        maxWaitDuration: 100ms    # chờ tối đa 100ms trước BulkheadFullException

  thread-pool-bulkhead:
    instances:
      inventoryService:
        maxThreadPoolSize: 5
        coreThreadPoolSize: 3
        queueCapacity: 20

@Service public class OrderService {
    @Bulkhead(name = "paymentService", fallbackMethod = "paymentFallback")
    @CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
    public PaymentResult charge(PaymentRequest req) {
        return paymentClient.charge(req);   // external call chậm
    }

    // Gọi khi bulkhead đầy HOẶC circuit mở
    public PaymentResult paymentFallback(PaymentRequest req, Exception e) {
        log.warn("Payment service không available: {}", e.getClass().getSimpleName());
        // Degrade gracefully: đưa vào queue để retry async
        paymentQueue.enqueue(req);
        return PaymentResult.pending(req.getOrderId());
    }
}
```

## Ứng Dụng Thực Tế

Luôn định nghĩa fallback method — Bulkhead không có fallback chỉ throw exception dưới load. Kết hợp Bulkhead (giới hạn concurrency) với CircuitBreaker (dừng gọi khi failure rate cao) và Retry (với exponential backoff). Bộ ba này là core của resilient service-to-service communication trong microservices.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Bulkhead giải quyết vấn đề gì mà shared thread pool không làm được?</strong></summary>

**A:** Với **shared thread pool**: service A chậm chiếm toàn bộ thread pool → request đến service B (bình thường) cũng bị queue/timeout → cascade failure. **Bulkhead** cô lập: mỗi downstream service có thread pool/semaphore riêng → service A saturate chỉ ảnh hưởng pool của A, service B không bị ảnh hưởng. Tên từ "bulkhead" trong tàu thủy — vách ngăn ngăn chìm toàn tàu.

</details>

<details>
<summary><strong>Thread pool bulkhead và semaphore bulkhead khác nhau thế nào?</strong></summary>

**A:** **Thread pool bulkhead**: dedicated thread pool cho mỗi service call; caller thread submit task, pool thread execute — cho phép timeout đang-executing call. Overhead: thread creation, context switch. **Semaphore bulkhead**: giới hạn concurrent call bằng Semaphore; caller thread tự execute — overhead thấp hơn nhiều nhưng không timeout đang-executing call. Resilience4j default: semaphore. Hystrix (deprecated): thread pool.

</details>

<details>
<summary><strong>Bulkhead bổ sung cho Circuit Breaker thế nào?</strong></summary>

**A:** Circuit Breaker theo dõi failure rate theo thời gian, mở khi vượt threshold — chờ service đang down recover. Bulkhead giới hạn concurrent requests — ngăn service slow (chưa fail) chiếm quá nhiều resource. Scenario: service A slow (5s thay vì 50ms) → CB chưa trigger nhưng thread pool đang fill up → Bulkhead kích hoạt. Kết hợp: Bulkhead ngăn resource exhaustion trong khi CB chờ failure rate đủ để trip.

</details>
