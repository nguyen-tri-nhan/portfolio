---
key: circuit-breaker
title: Circuit Breaker Pattern
crumb: 13. System Design > Resilience Patterns
---

Circuit Breaker ngăn cascade failure bằng cách phát hiện downstream service hỏng và fail fast thay vì chờ timeout, giúp hệ thống phục hồi nhanh hơn.

## Điểm Chính

- **Closed state**: trạng thái bình thường — tất cả request được pass through, failure rate được đếm trong sliding window
- **Open state**: failure rate vượt ngưỡng — mọi request bị từ chối ngay lập tức (fast-fail), không gọi downstream
- **Half-Open state**: sau `waitDurationInOpenState` — cho phép số lượng request giới hạn để probe xem service đã recover chưa
- **Failure threshold**: cấu hình bằng `failureRateThreshold` (ví dụ 50%) và `slowCallRateThreshold` (slow call cũng tính là failure)
- **Sliding window**: `COUNT_BASED` (N call cuối) hoặc `TIME_BASED` (N giây cuối) để tính failure rate
- **Resilience4j**: dùng `@CircuitBreaker` annotation với `CircuitBreakerConfig` và `CircuitBreakerRegistry`
- **Fallback method**: trả về cached data, default value, hoặc throw `ServiceUnavailableException` có nghĩa khi circuit OPEN
- **Khác với Retry**: Retry xử lý transient failures; Circuit Breaker ngăn gọi khi service đang down kéo dài — dùng kết hợp cả hai

## Ví Dụ Code

*Order service gọi payment service với Circuit Breaker, Retry, TimeLimiter kết hợp và fallback trả về pending result*

```kotlin
// build.gradle.kts
// implementation("io.github.resilience4j:resilience4j-spring-boot3:2.2.0")
// implementation("org.springframework.boot:spring-boot-starter-aop")

// application.yml
// resilience4j:
//   circuitbreaker:
//     instances:
//       paymentService:
//         sliding-window-type: COUNT_BASED
//         sliding-window-size: 10           # đánh giá trên 10 call gần nhất
//         failure-rate-threshold: 50        # OPEN khi >50% fail
//         slow-call-duration-threshold: 2s  # call >2s tính là slow
//         slow-call-rate-threshold: 80      # OPEN khi >80% calls là slow
//         wait-duration-in-open-state: 30s  # giữ OPEN 30s trước khi thử HALF_OPEN
//         permitted-number-of-calls-in-half-open-state: 3
//         minimum-number-of-calls: 5        # cần tối thiểu 5 call mới tính failure rate
//   retry:
//     instances:
//       paymentService:
//         max-attempts: 2
//         wait-duration: 200ms
//         retry-exceptions:
//           - java.io.IOException
//           - feign.FeignException$ServiceUnavailable
//   timelimiter:
//     instances:
//       paymentService:
//         timeout-duration: 2s
//         cancel-running-future: true

@Service
class PaymentServiceClient(
    private val paymentClient: PaymentClient,
    private val paymentCache: PaymentCacheRepository
) {

    // Decorator order (ngoài → trong): TimeLimiter → CircuitBreaker → Retry → actual call
    // TimeLimiter cancel future nếu vượt 2s
    // CircuitBreaker trip nếu failure rate > 50% trong window 10 calls
    // Retry thử lại 2x trước khi CircuitBreaker đếm failure
    @CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
    @TimeLimiter(name = "paymentService")
    @Retry(name = "paymentService")
    fun processPayment(orderId: Long, amount: BigDecimal): CompletableFuture<PaymentResult> =
        CompletableFuture.supplyAsync {
            paymentClient.charge(ChargeRequest(orderId = orderId, amount = amount))
        }

    // Fallback: gọi khi circuit OPEN hoặc tất cả retry exhausted
    // Signature phải match + thêm Throwable parameter ở cuối
    fun paymentFallback(orderId: Long, amount: BigDecimal, ex: Throwable): CompletableFuture<PaymentResult> {
        log.warn("Payment circuit open for orderId={}, reason={}", orderId, ex.message)

        // Ưu tiên 1: trả cached result nếu có (idempotency key)
        paymentCache.findByOrderId(orderId)?.let { cached ->
            return CompletableFuture.completedFuture(cached)
        }

        // Ưu tiên 2: enqueue để retry async khi service recover
        return CompletableFuture.completedFuture(
            PaymentResult.pending(orderId, "Payment queued — will process when service recovers")
        )
    }

    companion object {
        private val log = LoggerFactory.getLogger(PaymentServiceClient::class.java)
    }
}

// Monitor circuit state
// GET /actuator/health → shows circuitBreakers state
// GET /actuator/circuitbreakerevents/paymentService → recent events
// Prometheus: resilience4j_circuitbreaker_state{name="paymentService"}
//   0=CLOSED, 1=OPEN, 2=HALF_OPEN, 3=DISABLED, 4=FORCED_OPEN

// Listen to state transition events
@Component
class CircuitBreakerEventListener(registry: CircuitBreakerRegistry) {
    init {
        registry.circuitBreaker("paymentService").eventPublisher
            .onStateTransition { event ->
                log.info(
                    "Circuit '{}' transitioned: {} → {}",
                    event.circuitBreakerName,
                    event.stateTransition.fromState,
                    event.stateTransition.toState
                )
                // Alert khi CLOSED → OPEN (service đang gặp vấn đề)
                if (event.stateTransition.toState == CircuitBreaker.State.OPEN) {
                    alertService.notifyOnCall("Payment service circuit OPEN")
                }
            }
    }
}
```

## Ứng Dụng Thực Tế

Circuit Breaker đặc biệt quan trọng trong kiến trúc microservices, nơi một service chậm có thể exhaust thread pool của caller và gây cascade failure trên toàn hệ thống. Trong production, kết hợp Circuit Breaker với Bulkhead (giới hạn concurrent calls) và Retry (xử lý transient failures) tạo thành resilience stack hoàn chỉnh. Monitor `circuitbreaker_state` metrics qua Prometheus và alert ngay khi circuit chuyển sang OPEN để team phát hiện vấn đề downstream kịp thời.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>3 states của Circuit Breaker là gì và transition xảy ra khi nào?</strong></summary>

**A:** **CLOSED** là trạng thái bình thường — mọi request được pass through, failure rate được theo dõi trong sliding window. Khi failure rate vượt `failureRateThreshold` (ví dụ 50%), circuit chuyển sang **OPEN** — mọi request bị từ chối ngay lập tức không cần gọi downstream. Sau `waitDurationInOpenState` (ví dụ 30s), circuit chuyển sang **HALF_OPEN** — cho phép một số probe requests để kiểm tra service đã recover chưa. Nếu probe thành công → về CLOSED; nếu thất bại → về OPEN tiếp.

</details>

<details>
<summary><strong>Circuit Breaker vs Retry — khác nhau thế nào và kết hợp ra sao?</strong></summary>

**A:** **Retry** xử lý transient failures — service occasionally fail, retry sau vài giây thường thành công. **Circuit Breaker** xử lý sustained failures — service đang down kéo dài, tiếp tục retry chỉ làm tắc nghẽn thread pool. Khi kết hợp, thứ tự decorator quan trọng: `@TimeLimiter → @CircuitBreaker → @Retry`. Retry ở trong cùng — thử lại trước khi CircuitBreaker đếm là failure. CircuitBreaker bên ngoài — sau khi Retry exhausted mà vẫn fail mới đếm vào failure rate. Nếu failure rate > threshold, CircuitBreaker OPEN và Retry không được invoke nữa.

</details>

<details>
<summary><strong>Cấu hình Circuit Breaker thế nào trong production?</strong></summary>

**A:** Bắt đầu với `sliding-window-size=10`, `failure-rate-threshold=50`, `wait-duration-in-open-state=30s`. Tăng `minimum-number-of-calls=5` để tránh trip quá sớm khi mới start. Thêm `slow-call-duration-threshold` phù hợp SLA của service đó (ví dụ 2s cho payment). Set `permitted-number-of-calls-in-half-open-state=3` để có đủ signal khi probe. Quan trọng: monitor qua Prometheus metrics và alert khi OPEN — circuit state là health signal quan trọng của dependent services.

</details>
