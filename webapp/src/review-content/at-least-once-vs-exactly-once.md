---
key: "At-Least-Once vs Exactly-Once"
title: "At-Least-Once vs Exactly-Once"
crumb: "6. Messaging › Common Concepts"
---

Delivery semantic xác định bao nhiêu lần message có thể được giao — at-most-once (có thể mất), at-least-once (có thể trùng), exactly-once (không cái nào) — mỗi loại có trade-off khác nhau.

## Điểm Chính

- <strong>At-most-once</strong>: commit offset trước xử lý. Message có thể mất nếu crash sau commit nhưng trước xử lý.
- <strong>At-least-once</strong>: commit offset sau xử lý. Message có thể được xử lý lại nếu crash sau xử lý nhưng trước commit. Phổ biến nhất.
- <strong>Exactly-once</strong>: khó đạt nhất. Cần idempotent producer + transactional API + consumer isolation.
- Kafka EOS: <code>enable.idempotence=true</code> + <code>transactional.id</code> + consumer <code>isolation.level=read_committed</code>.
- Thực tế: at-least-once + idempotent consumer đơn giản hơn và đủ cho hầu hết trường hợp.

## Ví Dụ Code

*At-most-once vs at-least-once vs exactly-once: config + tradeoffs + khi nào dùng EOS*

```java
// At-most-once: commit offset BEFORE processing (can lose messages)
// spring.kafka.listener.ack-mode: record  (auto-commit immediately)
// Risk: crash after commit but before processing → message lost forever

// At-least-once: commit offset AFTER processing (can re-process messages)
@KafkaListener(topics = "order-events", groupId = "order-service")
public void processAtLeastOnce(OrderCreatedEvent event, Acknowledgment ack) {
    orderService.process(event); // process first
    ack.acknowledge();           // then commit → at-least-once delivery
    // If crash between process() and ack() → message redelivered → consumer must be IDEMPOTENT
}

// Exactly-once: Kafka transactional API (read-process-publish as one atomic unit)
// Step 1: Producer config
// spring.kafka.producer.transactional-id: order-service-tx-${instance.id}
// spring.kafka.producer.enable-idempotence: true
// spring.kafka.producer.acks: all

// Step 2: Consume-Transform-Publish in one Kafka transaction
@KafkaListener(topics = "order-events", groupId = "fulfillment-service")
public void processExactlyOnce(OrderCreatedEvent event) {
    kafkaTemplate.executeInTransaction(ops -> {
        // Read "order-events", process, publish to "fulfillment-events"
        // If anything fails → entire transaction aborts → no duplicate output
        FulfillmentEvent fulfillment = fulfillmentService.prepare(event);
        ops.send("fulfillment-events", event.getOrderId(), fulfillment);
        return null;
    });
}
// Step 3: Consumer must set isolation.level=read_committed to skip aborted txn
// spring.kafka.consumer.properties.isolation.level: read_committed

// Practical recommendation:
// Use at-least-once + idempotent consumer for 99% of cases
// Exactly-once adds complexity: transactional-id must be unique per instance,
// throughput drops ~20%, and cross-system transactions (Kafka→DB) still need Outbox pattern
```

## Ứng Dụng Thực Tế

Với hầu hết ứng dụng: dùng at-least-once + idempotent consumer (đơn giản hơn, đủ dùng). Chỉ implement Kafka EOS đầy đủ khi: mất dữ liệu không chấp nhận được VÀ không thể làm consumer idempotent VÀ throughput cho phép overhead.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa at-least-once và exactly-once delivery là gì?</strong></summary>

**A:** **At-least-once**: message được deliver ít nhất một lần, có thể duplicate khi producer retry hoặc consumer crash trước khi commit offset. Hệ thống nhận phải **idempotent**. **Exactly-once**: mỗi message được xử lý đúng một lần — cần coordination nặng giữa producer, broker và consumer. Kafka hỗ trợ EOS với `enable.idempotence=true` + transactional API.

</details>

<details>
<summary><strong>Kafka đạt exactly-once semantics thế nào?</strong></summary>

**A:** Hai cơ chế: (1) **Idempotent Producer** (`enable.idempotence=true`): mỗi message có sequence number, broker dedup khi retry. (2) **Transactions**: producer dùng `beginTransaction()`/`commitTransaction()` để atomic ghi vào nhiều partition/topic. Consumer đọc với `isolation.level=read_committed` — chỉ thấy message từ committed transaction. Overhead: ~20-30% throughput giảm so với at-least-once.

</details>

<details>
<summary><strong>Tại sao at-least-once + idempotency là lựa chọn thực tế phổ biến nhất?</strong></summary>

**A:** Exactly-once đòi 2PC hoặc Kafka transactions — phức tạp, giảm throughput. At-least-once đơn giản hơn: producer retry khi timeout, consumer re-process nếu crash. Nhiều operation tự nhiên là idempotent: DB upsert với unique key, payment với idempotency key, REST PUT. Pattern: `message_id` trong message, consumer check `processed_messages` table trước khi xử lý — skip nếu đã có.

</details>
