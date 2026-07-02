---
key: bulkhead
title: Bulkhead Pattern
crumb: 13. System Design > Resilience Patterns
---

Bulkhead cô lập resource pool cho từng dependency để failure hoặc bão hòa ở một component không lan sang các component khác — lấy cảm hứng từ vách ngăn tàu thủy ngăn một khoang bị ngập không làm chìm cả tàu.

## Điểm Chính

- **Vấn đề không có Bulkhead**: shared thread pool — service A chậm chiếm hết thread → request đến service B (bình thường) cũng bị queue/timeout → cascade failure toàn hệ thống
- **Thread Pool Isolation**: executor riêng cho mỗi downstream service; caller thread submit task vào pool đó; service chậm chỉ exhaust pool của nó, không ảnh hưởng pool khác
- **Semaphore Isolation**: giới hạn max concurrent calls bằng `Semaphore` — caller thread tự execute; overhead thấp hơn thread pool nhưng không thể timeout đang-executing call
- **Resilience4j `@Bulkhead`**: semaphore-based, `maxConcurrentCalls` + `maxWaitDuration` trước khi throw `BulkheadFullException`
- **Resilience4j `ThreadPoolBulkhead`**: thread-pool-based, `maxThreadPoolSize`, `coreThreadPoolSize`, `queueCapacity`
- **Fallback method**: bắt buộc khi dùng Bulkhead — không có fallback thì Bulkhead chỉ throw exception dưới load cao
- **Kết hợp Circuit Breaker**: Bulkhead giới hạn concurrency (ngăn resource exhaustion); Circuit Breaker dừng gọi khi failure rate cao (ngăn cascade failure) — hai cơ chế bổ sung cho nhau
- **Sizing**: `maxConcurrentCalls` nên dựa trên throughput expected × response time (Little's Law: L = λW)

## Ví Dụ Code

*Kotlin service với @Bulkhead annotation giới hạn concurrent calls đến external service chậm, kết hợp Circuit Breaker*

```kotlin
// application.yml
// resilience4j:
//   bulkhead:
//     instances:
//       paymentService:
//         max-concurrent-calls: 10      # tối đa 10 call đồng thời đến payment
//         max-wait-duration: 100ms      # chờ slot tối đa 100ms, sau đó BulkheadFullException
//       reportingService:
//         max-concurrent-calls: 3       # reporting chậm, giới hạn chặt hơn
//         max-wait-duration: 0ms        # fail fast ngay nếu đầy
//   thread-pool-bulkhead:
//     instances:
//       inventoryService:
//         max-thread-pool-size: 5
//         core-thread-pool-size: 3
//         queue-capacity: 20
//         keep-alive-duration: 20ms
//   circuitbreaker:
//     instances:
//       paymentService:
//         failure-rate-threshold: 50
//         sliding-window-size: 10
//         wait-duration-in-open-state: 30s

@Service
class OrderProcessingService(
    private val paymentClient: PaymentClient,
    private val reportingClient: ReportingClient,
    private val pendingPaymentQueue: PendingPaymentQueue
) {

    // Bulkhead: tối đa 10 concurrent calls đến payment
    // CircuitBreaker: dừng gọi khi failure rate > 50%
    // Thứ tự annotation: CircuitBreaker bên ngoài, Bulkhead bên trong
    @Bulkhead(name = "paymentService", fallbackMethod = "paymentBulkheadFallback")
    @CircuitBreaker(name = "paymentService", fallbackMethod = "paymentBulkheadFallback")
    fun chargePayment(orderId: Long, amount: BigDecimal): PaymentResult {
        return paymentClient.charge(ChargeRequest(orderId, amount))
    }

    // Gọi khi: bulkhead đầy (BulkheadFullException) HOẶC circuit OPEN (CallNotPermittedException)
    fun paymentBulkheadFallback(orderId: Long, amount: BigDecimal, ex: Exception): PaymentResult {
        return when (ex) {
            is BulkheadFullException -> {
                // Bulkhead đầy: quá nhiều concurrent payment đang xử lý
                log.warn("Payment bulkhead full, queuing order={}", orderId)
                pendingPaymentQueue.enqueue(orderId, amount, priority = Priority.HIGH)
                PaymentResult.queued(orderId, "Payment queued due to high load")
            }
            is CallNotPermittedException -> {
                // Circuit OPEN: payment service đang gặp sự cố
                log.warn("Payment circuit open, queuing order={}", orderId)
                pendingPaymentQueue.enqueue(orderId, amount, priority = Priority.NORMAL)
                PaymentResult.queued(orderId, "Payment queued — service recovering")
            }
            else -> throw ex
        }
    }

    // Reporting service: giới hạn chặt hơn vì nó không critical
    @Bulkhead(name = "reportingService", fallbackMethod = "reportingFallback")
    fun generateReport(orderId: Long): ReportResult {
        return reportingClient.generate(orderId)
    }

    // Fallback: skip reporting, không block order flow
    fun reportingFallback(orderId: Long, ex: Exception): ReportResult {
        log.warn("Reporting service at capacity, skipping report for order={}", orderId)
        // Fire-and-forget: schedule async retry sau
        reportingRetryScheduler.scheduleRetry(orderId, delaySeconds = 60)
        return ReportResult.skipped(orderId)
    }

    companion object {
        private val log = LoggerFactory.getLogger(OrderProcessingService::class.java)
    }
}

// Metrics để monitor bulkhead
// resilience4j_bulkhead_available_concurrent_calls{name="paymentService"} → slots còn lại
// resilience4j_bulkhead_max_allowed_concurrent_calls{name="paymentService"} → max
// Alert khi available_concurrent_calls tiến gần 0 → bulkhead sắp đầy
```

## Ứng Dụng Thực Tế

Trong microservices e-commerce, payment service và inventory service có SLA khác nhau — payment critical (timeout 2s), inventory non-critical (timeout 10s). Không có bulkhead, inventory service chậm có thể exhaust shared HTTP connection pool và làm payment requests bị delay. Dùng separate bulkhead cho từng downstream service với `maxConcurrentCalls` sizing dựa trên expected throughput và response time (Little's Law: concurrent calls = RPS × latency).

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Thread Pool Isolation vs Semaphore Isolation — trade-offs là gì?</strong></summary>

**A:** **Thread Pool Isolation**: dedicated thread pool, caller thread submit task và return ngay — có thể timeout đang-executing call, overhead cao hơn (thread creation, context switch), cô lập tốt nhất. **Semaphore Isolation**: `Semaphore.tryAcquire()` trên caller thread — caller thread tự execute, không thể timeout đang-executing call (chỉ timeout chờ acquire semaphore), overhead thấp hơn nhiều. Resilience4j default là semaphore. Hystrix (deprecated) mặc định thread pool. Chọn thread pool khi cần timeout call đang chạy; chọn semaphore khi throughput quan trọng và calls thường nhanh.

</details>

<details>
<summary><strong>Bulkhead vs Circuit Breaker — khác nhau thế nào?</strong></summary>

**A:** **Bulkhead** giới hạn số lượng concurrent requests đến một dependency tại mọi thời điểm — ngăn resource exhaustion ngay cả khi service chỉ chậm (chưa fail). **Circuit Breaker** theo dõi failure rate theo thời gian và trip khi vượt threshold — ngăn cascade failure khi service đang down. Scenario bổ sung: service A bắt đầu slow (5s thay vì 50ms) → Circuit Breaker chưa trip vì failure rate còn thấp → nhưng Bulkhead kích hoạt vì concurrent calls tăng cao do calls không trả về nhanh. Kết hợp cả hai: Bulkhead ngăn resource exhaustion trong khi CB chờ đủ failure signal.

</details>

<details>
<summary><strong>Sizing bulkhead pool thế nào trong thực tế?</strong></summary>

**A:** Dùng **Little's Law**: `L = λ × W` — số concurrent calls = throughput (RPS) × average latency. Ví dụ: payment service xử lý 20 RPS với latency trung bình 500ms → cần `20 × 0.5 = 10` concurrent slots. Thêm buffer 20-30%: `maxConcurrentCalls = 12-13`. Nếu service đang degrade và latency tăng lên 2s: `20 × 2 = 40` calls → bulkhead của bạn sẽ từ chối bớt. Quan trọng: không set quá lớn (mất tác dụng cô lập) và không quá nhỏ (legitimate traffic bị từ chối). Monitor `available_concurrent_calls` metric và điều chỉnh dựa trên traffic thực tế.

</details>
