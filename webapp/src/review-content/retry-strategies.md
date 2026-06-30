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

1. Exponential backoff với jitter là gì và tại sao jitter quan trọng?
1. Lỗi nào bạn KHÔNG nên retry?
1. Làm thế nào để phân biệt transient vs permanent failure trong Kafka consumer?
