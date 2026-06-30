---
key: "Idempotency / Deduplication"
title: "Idempotency & Deduplication"
crumb: "6. Messaging › Common Concepts"
---

Idempotency đảm bảo xử lý cùng message nhiều lần tạo ra kết quả giống như xử lý một lần — thiết yếu cho đảm bảo at-least-once delivery.

## Điểm Chính

- At-least-once delivery nghĩa là duplicate SẼ xảy ra. Consumer của bạn phải idempotent.
- Idempotency key: message/request ID duy nhất. Kiểm tra đã xử lý chưa trước khi hành động.
- Lưu ID đã xử lý trong Redis (với TTL) hoặc unique constraint DB để phát hiện duplicate.
- Database: <code>INSERT ... ON CONFLICT DO NOTHING</code> là idempotent.
- Outbox pattern: publish event atomic với DB write, ngăn publish trùng lặp khi retry.

## Ví Dụ Code

*Redis SETNX deduplication; DB ON CONFLICT DO NOTHING; Outbox pattern cho exactly-once publish*

```java
// Idempotent consumer: Redis deduplication with SETNX
@KafkaListener(topics = "payment-events", groupId = "order-service")
@Transactional
public void processPaymentEvent(PaymentProcessedEvent event, Acknowledgment ack) {
    // Idempotency key = unique event ID (UUID assigned by publisher)
    String dedupKey = "dedup:payment:" + event.getEventId();

    // SETNX (SET if Not eXists): atomic check-and-set with 24h TTL
    Boolean isNew = redisTemplate.opsForValue()
        .setIfAbsent(dedupKey, "processed", Duration.ofHours(24));

    if (Boolean.FALSE.equals(isNew)) {
        log.info("Duplicate payment event skipped: eventId={}", event.getEventId());
        ack.acknowledge(); // ack to prevent redelivery, but skip processing
        return;
    }

    // Process only if new
    orderService.markOrderPaid(event.getOrderId(), event.getAmount());
    paymentRepo.save(PaymentRecord.from(event));
    ack.acknowledge();
}

// DB-level idempotency: ON CONFLICT DO NOTHING (PostgreSQL)
// If payment-events is replayed, the INSERT is a no-op — no duplicate payment record
// INSERT INTO payments (id, order_id, amount, status, created_at)
// VALUES (:eventId, :orderId, :amount, 'COMPLETED', NOW())
// ON CONFLICT (id) DO NOTHING;

// Outbox pattern: publish event atomically with DB write (prevents duplicate publish)
@Transactional
public void placeOrder(PlaceOrderCommand cmd) {
    Order order = orderRepo.save(new Order(cmd));
    // Save to outbox IN SAME TRANSACTION — if publish fails later, outbox retries
    outboxRepo.save(new OutboxMessage("order-events", order.getId(),
        new OrderCreatedEvent(order)));
    // Separate outbox poller reads and publishes — exactly-once publish guarantee
}

// Rule: every event MUST carry a globally unique eventId (UUID)
// Consumer uses eventId as idempotency key
// TTL must be longer than max retry window (24h > typical 30min retry window)
```

## Ứng Dụng Thực Tế

Bao gồm <code>eventId</code> duy nhất (UUID) trong mọi event bạn publish. Consumer dùng nó làm idempotency key. Cửa sổ deduplication (Redis TTL) nên dài hơn cửa sổ retry tối đa của bạn.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Idempotent consumer implement thế nào?</strong></summary>

**A:** Cần unique message ID (Kafka offset + partition, hoặc business ID trong message header). Trước khi process: check xem ID đã process chưa (Redis, DB). Nếu đã xử lý → skip và ack. Nếu chưa → process → lưu ID → ack. Store: Redis SET với TTL (SET idempotency:{messageId} 1 EX 86400 NX) — NX chỉ set nếu chưa tồn tại. DB: unique constraint trên message_id column — duplicate INSERT throw exception → catch và ack. TTL phải đủ dài để cover retry window.

</details>
