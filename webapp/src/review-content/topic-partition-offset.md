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

1. Kafka dùng message key cho partitioning thế nào?
1. Bạn có thể đảm bảo thứ tự message qua các partition không?
1. Điều gì xảy ra khi bạn tăng số partition cho topic hiện có?
