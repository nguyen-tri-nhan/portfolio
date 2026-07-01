---
key: "Retry Strategies"
title: "Chiến Lược Retry"
crumb: "6. Messaging › Common Concepts"
---

Chiến lược retry tự động thử lại xử lý message thất bại với backoff có thể cấu hình, ngăn transient failure gây mất message vĩnh viễn.

## Điểm Chính

- <strong>Fixed delay</strong>: retry sau interval cố định. Đơn giản, có thể làm quá tải service đang phục hồi.
- <strong>Exponential backoff</strong>: delay tăng gấp đôi mỗi lần thử (1s, 2s, 4s, 8s). Cho thời gian phục hồi.
- <strong>Jitter</strong>: thêm ngẫu nhiên vào backoff để ngăn thundering herd (tất cả instance retry đồng thời).
- Max retry: sau N lỗi, gửi vào DLQ.
- Resilience4j <code>@Retry</code>: retry tự động với exception và backoff có thể cấu hình.

## Ví Dụ Code

*Kafka ExponentialBackOff + non-retryable exceptions; Resilience4j @Retry với jitter + fallback*

```java
// Spring Kafka: retry with exponential backoff + jitter + DLQ
@Bean
public DefaultErrorHandler errorHandler(KafkaTemplate<?, ?> kafkaTemplate) {
    // After 5 retries → send to DLT (Dead Letter Topic)
    DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(kafkaTemplate,
        (record, ex) -> new TopicPartition(record.topic() + ".DLT", record.partition()));

    // Exponential backoff: 1s → 2s → 4s → 8s → 16s (capped at 30s)
    ExponentialBackOffWithMaxRetries backoff = new ExponentialBackOffWithMaxRetries(5);
    backoff.setInitialInterval(1_000L);
    backoff.setMultiplier(2.0);
    backoff.setMaxInterval(30_000L); // cap prevents 1-hour waits

    DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backoff);

    // Non-retryable: fix required, retrying won't help
    handler.addNotRetryableExceptions(
        DeserializationException.class,   // bad message format
        ValidationException.class,         // business rule violation
        DataIntegrityViolationException.class // DB constraint (duplicate key)
    );
    // Retryable (default): DB timeout, external service 503, connection refused
    return handler;
}

// Resilience4j @Retry for REST calls with exponential backoff + jitter
// application.yml:
// resilience4j.retry.instances.payment-service:
//   max-attempts: 3
//   wait-duration: 500ms
//   exponential-backoff-multiplier: 2
//   enable-exponential-backoff: true
//   randomized-wait-factor: 0.3   # jitter: ±30% → prevents thundering herd

@Service
@RequiredArgsConstructor
public class PaymentServiceClient {

    @Retry(name = "payment-service", fallbackMethod = "fallback")
    public PaymentResult charge(String orderId, BigDecimal amount) {
        return paymentClient.charge(orderId, amount); // retried on transient failure
    }

    // Fallback: called after all retries exhausted
    public PaymentResult fallback(String orderId, BigDecimal amount, Exception ex) {
        log.error("Payment failed after retries: orderId={}", orderId, ex);
        outboxRepo.save(new PendingPaymentOutbox(orderId, amount)); // async retry later
        return PaymentResult.pending(orderId); // return graceful degraded response
    }
}
```

## Ứng Dụng Thực Tế

Chỉ retry trên transient error (network timeout, service unavailable). Đừng retry lỗi validation hoặc vi phạm business rule — chúng sẽ luôn thất bại. Thêm <code>maxInterval</code> để giới hạn backoff và ngăn delay cực dài.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Exponential backoff với jitter là gì?</strong></summary>

**A:** **Exponential backoff**: delay tăng theo lũy thừa sau mỗi retry — 1s, 2s, 4s, 8s, 16s... **Vấn đề**: nếu nhiều client đều retry sau 8s → thundering herd, spike tải vào server lúc recover. **Jitter**: thêm random delay — `delay = min(cap, base * 2^attempt) + random(0, delay)`. Kết quả: client retry ở thời điểm khác nhau → smooth tải. AWS SDK dùng exponential backoff + jitter mặc định. Spring Retry: `@Retryable(backoff=@Backoff(delay=1000, multiplier=2, maxDelay=30000))`. Công thức: `delay = rand(0, min(cap, initial_delay * 2^attempt))`.

</details>

<details>
<summary><strong>Khi nào KHÔNG nên retry?</strong></summary>

**A:** Không retry khi: (1) **4xx errors** (400, 401, 403, 422): lỗi từ request của client — retry sẽ cùng fail. Chỉ 429 (rate limit) và 408 (timeout) nên retry. (2) **Non-idempotent operations**: `POST /payment` retry tạo duplicate charge — cần idempotency key trước. (3) **Circuit open**: đang open → fail fast, không retry. (4) **Business logic exception**: data validation fail. (5) **Deadline exceeded**: tổng thời gian đã vượt timeout cho caller. Retry đúng: chỉ với transient errors (503, 502, network timeout, connection refused) và idempotent operations.

</details>

<details>
<summary><strong>Dead letter queue liên quan đến retry thế nào?</strong></summary>

**A:** Sau N retry thất bại, message không nên discard — route đến **Dead Letter Queue (DLQ)** để: (1) Analyze lý do fail, (2) Retry thủ công sau khi fix bug, (3) Alert/monitoring. RabbitMQ: `x-dead-letter-exchange` trên queue — nếu message reject hoặc expire → automatic route đến DLX. Kafka: DLQ là separate topic — consumer code catch exception sau max retry → produce đến `topic.DLT`. Spring Kafka `@RetryableTopic`: tự động create retry topics + DLT, handle backoff. DLQ pattern: không mất message, cho phép nhìn lại để debug.

</details>
