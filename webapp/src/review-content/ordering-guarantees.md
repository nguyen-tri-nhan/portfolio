---
key: "Ordering Guarantees"
title: "Đảm Bảo Thứ Tự Kafka"
crumb: "6. Messaging › Kafka"
---

Kafka đảm bảo thứ tự message chỉ trong một partition — đạt total order cần dùng single partition, trong khi partial order (mỗi entity) dùng keyed partitioning.

## Điểm Chính

- Trong một partition: message có thứ tự nghiêm ngặt (FIFO). Offset 5 luôn sau offset 4.
- Qua các partition: KHÔNG đảm bảo thứ tự.
- Sắp xếp tất cả message cho một entity (ví dụ: một đơn hàng): dùng entity ID làm partition key.
- Total global ordering: single partition (giới hạn throughput xuống một partition).
- Exactly-once semantics (EOS): enable.idempotence=true + transactional producer + consumer isolation.level=read_committed.

## Ví Dụ Code

*Keyed ordering: entity ID làm key; EOS với transactional producer; isolation.level*

```java
// Ordering: guaranteed WITHIN a partition, NOT across partitions
// Strategy: use entity ID (orderId, userId) as message key → same key = same partition

// All lifecycle events for order-123 go to same partition → strict FIFO ordering
kafkaTemplate.send("order-events", "order-123", new OrderCreatedEvent("order-123"));
kafkaTemplate.send("order-events", "order-123", new OrderShippedEvent("order-123"));
kafkaTemplate.send("order-events", "order-123", new OrderDeliveredEvent("order-123"));
// Consumer always sees: CREATED → SHIPPED → DELIVERED for order-123

// Different orders go to different partitions — processed in parallel (no cross-order ordering)
kafkaTemplate.send("order-events", "order-456", new OrderCreatedEvent("order-456")); // partition 3
kafkaTemplate.send("order-events", "order-789", new OrderCreatedEvent("order-789")); // partition 1

// Exactly-once semantics (EOS): transactional producer
// Prevents duplicate events when producer retries after network error
@Bean
public ProducerFactory<String, Object> exactlyOnceProducerFactory() {
    Map<String, Object> props = new HashMap<>();
    props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
    props.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "order-service-tx-1"); // unique per instance
    props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
    props.put(ProducerConfig.ACKS_CONFIG, "all");
    return new DefaultKafkaProducerFactory<>(props);
}

// Consumer must set isolation.level=read_committed to skip aborted transactions
// spring.kafka.consumer.properties.isolation.level: read_committed

// When you DON'T need strict ordering (e.g., user-events dashboard):
// Use null key → round-robin across all partitions → maximum throughput
```

## Ứng Dụng Thực Tế

Dùng entity ID (orderId, userId) làm Kafka message key cho entity-level ordering. Điều này đủ cho hầu hết trường hợp. Full exactly-once qua produce + consume cần transactional producer VÀ <code>isolation.level=read_committed</code> trên consumer.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Kafka có thể đảm bảo thứ tự qua các partition không?</strong></summary>

**A:** **Không** — Kafka chỉ đảm bảo **thứ tự trong một partition**. Message trong partition P1 có thể được xử lý theo thứ tự; nhưng không có đảm bảo thứ tự *giữa* P1 và P2. Consumer group: mỗi partition được assign cho một consumer — thứ tự trong partition được giữ. Để đảm bảo thứ tự của một entity (user, order): route tất cả event của entity đó vào cùng partition bằng **message key** = entityId → same key → same partition → in-order.

</details>

<details>
<summary><strong>Làm thế nào để đảm bảo tất cả event của một user được xử lý theo thứ tự?</strong></summary>

**A:** Set **message key = userId** khi produce vào Kafka. Kafka hash(key) % num_partitions → same userId luôn vào cùng partition → consumer xử lý in-order. Trong producer: `ProducerRecord<>(topic, userId.toString(), eventData)`. Consumer: một partition chỉ có một consumer (trong consumer group) → single-threaded processing trong partition → order đảm bảo. Cẩn thận: thêm partition → hash thay đổi → event của cùng user có thể vào partition khác trong thời gian transition.

</details>

<details>
<summary><strong>Exactly-once semantics trong Kafka là gì và đạt được thế nào?</strong></summary>

**A:** **EOS** trong Kafka: mỗi message được xử lý đúng một lần end-to-end — không mất, không duplicate. Đạt được với: (1) **Idempotent producer** (`enable.idempotence=true`): dedup retry ở broker layer. (2) **Transactional API**: `producer.beginTransaction() → produce → consumer.commitSync() → producer.commitTransaction()`. Consumer với `isolation.level=read_committed`. Kafka Streams tự động EOS khi `processing.guarantee=exactly_once_v2`. Overhead: ~20% throughput reduction, latency tăng.

</details>
