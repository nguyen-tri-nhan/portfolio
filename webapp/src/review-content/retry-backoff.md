---
key: retry-backoff
title: Retry & Exponential Backoff
crumb: 13. System Design > Resilience Patterns
---

Retry với exponential backoff và jitter giúp xử lý transient failures tự động mà không làm quá tải downstream service khi nó đang phục hồi.

## Điểm Chính

- **Khi nào retry**: transient failures như network timeout, HTTP 503, rate limit 429 — KHÔNG retry 4xx client errors (400, 401, 403, 422) vì chúng sẽ luôn thất bại
- **Exponential backoff**: delay tăng lũy thừa sau mỗi lần thử — `wait = base × 2^attempt` (1s, 2s, 4s, 8s...) để cho service thời gian phục hồi
- **Thundering herd problem**: nếu tất cả client retry cùng lúc (ví dụ sau 8s), spike tải đổ vào service vừa recover có thể làm nó fail lại
- **Jitter**: thêm random delay để phân tán retry — `Full Jitter: delay = random(0, min(cap, base × 2^attempt))`; `Equal Jitter: delay = min(cap, base × 2^attempt) / 2 + random(0, .../ 2)`
- **Max attempts + max delay cap**: tránh chờ vô hạn — thường 3-5 lần retry, cap delay ở 30-60s
- **Resilience4j `@Retry`**: cấu hình `maxAttempts`, `waitDuration`, `exponentialBackoffMultiplier`, `randomizedWaitFactor`, `retryExceptions`, `ignoreExceptions`
- **Idempotency requirement**: chỉ retry an toàn cho idempotent operations — `GET`, `PUT`, `DELETE` và `POST` có idempotency key; `POST` không có idempotency key → risk duplicate processing
- **Circuit Breaker kết hợp**: Retry ở trong, Circuit Breaker ở ngoài — nếu retry exhausted nhiều lần, CB trip và dừng gọi hoàn toàn

## Ví Dụ Code

*Kotlin service dùng Resilience4j @Retry với exponential backoff, jitter, phân biệt retryable vs non-retryable exceptions*

```kotlin
// application.yml
// resilience4j:
//   retry:
//     instances:
//       inventoryService:
//         max-attempts: 4                        # 1 original + 3 retry
//         wait-duration: 500ms                   # base delay
//         enable-exponential-backoff: true
//         exponential-backoff-multiplier: 2      # 500ms → 1s → 2s → 4s
//         exponential-max-wait-duration: 30s     # cap ở 30s
//         randomized-wait-factor: 0.3            # jitter ±30%
//         retry-exceptions:
//           - java.io.IOException
//           - java.net.SocketTimeoutException
//           - feign.RetryableException
//         ignore-exceptions:
//           - com.example.ValidationException     # 400 Bad Request — đừng retry
//           - com.example.NotFoundException       # 404 — đừng retry
//           - com.example.ConflictException       # 409 — đừng retry

@Service
class InventoryServiceClient(
    private val inventoryClient: InventoryClient,
    private val inventoryCache: InventoryCache
) {

    // Retry với exponential backoff + jitter
    // Attempt 1: 500ms ± 150ms (jitter 30%)
    // Attempt 2: 1000ms ± 300ms
    // Attempt 3: 2000ms ± 600ms
    // Attempt 4 (final): 4000ms ± 1200ms
    @Retry(name = "inventoryService", fallbackMethod = "checkInventoryFallback")
    fun checkInventory(productId: String, quantity: Int): InventoryResult {
        return inventoryClient.check(productId, quantity)
        // IOException, SocketTimeoutException → retry tự động
        // ValidationException → throw ngay, không retry
    }

    fun checkInventoryFallback(productId: String, quantity: Int, ex: Exception): InventoryResult {
        log.warn("Inventory check failed after retries: product={}, error={}", productId, ex.message)

        // Stale cache fallback
        val cached = inventoryCache.get(productId)
        if (cached != null && cached.isNotExpiredBeyond(Duration.ofMinutes(5))) {
            log.info("Serving stale inventory cache for product={}", productId)
            return InventoryResult.fromCache(cached, stale = true)
        }

        // Optimistic fallback: assume in stock, validate at order confirmation
        return InventoryResult.assumeAvailable(productId, quantity)
    }

    companion object {
        private val log = LoggerFactory.getLogger(InventoryServiceClient::class.java)
    }
}

// Manual retry logic với Full Jitter (không dùng framework)
object RetryWithJitter {

    fun <T> execute(
        maxAttempts: Int = 4,
        baseDelayMs: Long = 500,
        capMs: Long = 30_000,
        block: () -> T
    ): T {
        var attempt = 0
        while (true) {
            try {
                return block()
            } catch (ex: TransientException) {
                attempt++
                if (attempt >= maxAttempts) throw ex

                // Full Jitter: delay = random(0, min(cap, base * 2^attempt))
                val exponentialDelay = minOf(capMs, baseDelayMs * (1L shl attempt))
                val jitteredDelay = (Math.random() * exponentialDelay).toLong()

                log.debug("Retry attempt {}/{} after {}ms (jitter)", attempt, maxAttempts, jitteredDelay)
                Thread.sleep(jitteredDelay)
            }
        }
    }
}

// Idempotency key pattern — safe retry cho POST
@RestController
class OrderController(private val orderService: OrderService) {

    @PostMapping("/orders")
    fun createOrder(
        @RequestHeader("Idempotency-Key") idempotencyKey: String,
        @RequestBody request: CreateOrderRequest
    ): ResponseEntity<OrderResponse> {
        // Nếu client retry cùng idempotency-key → trả result cũ, không tạo duplicate
        val result = orderService.createWithIdempotency(idempotencyKey, request)
        return ResponseEntity.ok(result)
    }
}
```

## Ứng Dụng Thực Tế

Trong hệ thống e-commerce, inventory check và payment call là candidates tốt cho retry với exponential backoff vì chúng có thể bị ảnh hưởng bởi transient network issues. Tuy nhiên, payment POST cần idempotency key để tránh double charge khi retry. Kết hợp `@Retry` bên trong `@CircuitBreaker` trong Resilience4j để xử lý cả transient failures (Retry) lẫn sustained outages (Circuit Breaker).

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao cần jitter trong exponential backoff retry?</strong></summary>

**A:** Không có jitter, tất cả client bị fail cùng lúc (ví dụ khi service restart) sẽ retry đồng loạt sau cùng delay — 500ms, rồi 1s, rồi 2s... Khi service vừa recover, nhận spike traffic từ hàng ngàn client retry đồng thời có thể làm nó fail lại ngay, tạo vòng lặp. **Jitter** thêm random delay phân tán thời điểm retry ra nhiều khoảng thời gian khác nhau, smoothing tải khi service recover. **Full Jitter** (`random(0, cap)`) phân tán tốt nhất. AWS SDK và Google Cloud client library đều dùng exponential backoff + full jitter mặc định.

</details>

<details>
<summary><strong>Retry và idempotency liên quan thế nào?</strong></summary>

**A:** Retry an toàn chỉ khi operation là **idempotent** — gọi nhiều lần cho cùng kết quả. `GET`, `PUT`, `DELETE` thường idempotent. `POST /payments` không idempotent mặc định — retry tạo duplicate charge. Giải pháp: **Idempotency Key** — client gửi unique key trong header (`Idempotency-Key: uuid`); server lưu key + result; nếu nhận lại cùng key → trả cached result, không xử lý lại. Stripe, PayPal đều implement pattern này. Bắt buộc implement idempotency key cho bất kỳ non-idempotent operation nào có retry.

</details>

<details>
<summary><strong>Khi nào KHÔNG nên retry?</strong></summary>

**A:** Không retry khi: (1) **4xx client errors** — 400 Bad Request, 401 Unauthorized, 403 Forbidden, 422 Unprocessable Entity: lỗi từ request, retry cùng request sẽ fail lại ngay. Ngoại lệ: 429 Too Many Requests và 408 Request Timeout nên retry. (2) **Non-idempotent POST** không có idempotency key — risk duplicate side effects. (3) **Circuit đang OPEN** — fail fast, không retry. (4) **Deadline exceeded** — tổng thời gian đã vượt timeout caller mong đợi, retry thêm chỉ làm request càng trễ hơn. (5) **Business validation errors** — ValidationException, ConflictException sẽ luôn fail với cùng input.

</details>
