---
key: "Topic / Partition / Offset"
title: "Topic, Partition, Offset"
crumb: "6. Messaging › Kafka"
---

Topic là luồng logic được chia thành Partition (đơn vị parallelism + thứ tự); Offset xác định vị trí của mỗi message trong partition — nền tảng của delivery model Kafka.

## Điểm Chính

- <strong>Topic</strong>: luồng có tên. Producer ghi vào; Consumer đọc từ đó.
- <strong>Partition</strong>: chuỗi có thứ tự, bất biến. Nhiều partition hơn = parallelism hơn. Message trong một partition có thứ tự nghiêm ngặt.
- <strong>Offset</strong>: ID tuần tự duy nhất của message trong partition. Consumer commit offset để theo dõi tiến trình.
- Message key: xác định phân công partition (cùng key → cùng partition → có thứ tự). Key null → round-robin.
- Replication factor: mỗi partition được replicate lên N broker. Leader xử lý đọc/ghi; replica là follower.

## Ví Dụ Code

*Topic/Partition/Offset: keyed partitioning + offset management + replay*

```java
// Topic, Partition, Offset: key concepts with order-events
// Topic "order-events" has 6 partitions → 6 consumers can process in parallel

// Producer: use orderId as key → consistent partition assignment
// All events for order-123 always go to partition 2 (hash("order-123") % 6 = 2)
ProducerRecord<String, OrderEvent> record =
    new ProducerRecord<>("order-events", "order-123", orderCreatedEvent);
kafkaTemplate.send(record);

// Consumer: read partition metadata from each record
@KafkaListener(topics = "order-events", groupId = "order-processor")
public void consume(ConsumerRecord<String, OrderCreatedEvent> record) {
    String  orderId   = record.key();       // "order-123"
    int     partition = record.partition(); // 2
    long    offset    = record.offset();    // 4501 (unique within partition)
    OrderCreatedEvent event = record.value();

    log.info("Processing orderId={} from partition={} offset={}", orderId, partition, offset);
    orderService.process(event);
}

// Offset management: consumer commits offset to track progress
// If consumer crashes at offset 4501, it resumes from 4501 (at-least-once)
// spring.kafka.consumer.auto-offset-reset: earliest  → replay from beginning
// spring.kafka.consumer.auto-offset-reset: latest    → only new messages

// Manual partition assignment (for admin/replay scenarios only):
TopicPartition partition0 = new TopicPartition("order-events", 0);
consumer.assign(List.of(partition0));
consumer.seek(partition0, 1000L); // replay from offset 1000
```

## Ứng Dụng Thực Tế

Kích thước partition dựa trên throughput: mỗi partition xử lý ~10-50 MB/s. Bạn có thể tăng số partition (có thể thêm) nhưng không thể giảm mà không có rủi ro dữ liệu. Luôn dùng key có ý nghĩa (orderId, userId) cho đảm bảo thứ tự.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Topic, partition, và offset trong Kafka là gì?</strong></summary>

**A:** **Topic**: logical category/stream — ví dụ "orders", "payments". **Partition**: topic được chia thành N partitions — mỗi partition là append-only ordered log. Nhiều partitions cho phép parallel consumption. **Offset**: vị trí (sequential number) của message trong partition — bắt đầu từ 0, tăng dần. Consumer track offset đã đọc. Consumer group: mỗi partition được consume bởi **một consumer** (trong group) — offset per partition per consumer group được commit vào Kafka. Reread: set offset về trước (`--reset-offsets`) → reprocess messages. Retention: message giữ trong N ngày/hours dù đã consumed.

</details>

<details>
<summary><strong>Tại sao nhiều partition trong Kafka quan trọng?</strong></summary>

**A:** (1) **Parallelism**: consumer group consume parallel — N partitions cho phép N consumers xử lý song song. 1 partition = 1 consumer max (bottleneck). (2) **Throughput**: producer write parallel vào nhiều partitions. (3) **Distribution**: partitions spread across brokers — no single broker bottleneck. Cân nhắc: nhiều partition quá → overhead (Zookeeper/KRaft, file handles, replication). Rule of thumb: target_throughput / single_partition_throughput. Rebalancing: thêm partition sau → cùng key có thể vào partition khác → break ordering per-key.

</details>

<details>
<summary><strong>Consumer group offset commit thế nào?</strong></summary>

**A:** Consumer commit offset để mark "đã xử lý đến đây". `enable.auto.commit=true` (default): auto commit định kỳ (`auto.commit.interval.ms=5000`) — risk: commit trước khi xử lý xong → tắt process giữa chừng → message bị mất (committed nhưng chưa process). **Manual commit**: `enable.auto.commit=false` → sau khi xử lý thành công gọi `consumer.commitSync()` hoặc `commitAsync()`. At-least-once: commit sau xử lý. Exactly-once: transactional API. Spring Kafka `@KafkaListener` với `AckMode=MANUAL`: gọi `acknowledgment.acknowledge()` sau process.

</details>
