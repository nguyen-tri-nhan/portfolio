---
key: "Consumer Group"
title: "Kafka Consumer Group"
crumb: "6. Messaging › Kafka"
---

Consumer group cho phép nhiều consumer đọc từ topic song song, với mỗi partition được gán cho đúng một consumer trong group, cho phép horizontal scaling của consumption.

## Điểm Chính

- Mỗi message được giao đến đúng MỘT consumer mỗi group (load balancing).
- Nhiều group trên cùng topic: mỗi group nhận TẤT CẢ message độc lập (fan-out).
- Phân công partition-to-consumer: Kafka coordinator quản lý qua rebalance protocol.
- Rebalance: được kích hoạt khi consumer join/rời/crash. Gây tạm dừng xử lý.
- Max parallelism = số partition. Consumer vượt quá số partition sẽ ngồi idle.
- <code>group.id</code> xác định group; offset được theo dõi mỗi group mỗi partition.

## Ví Dụ Code

*Consumer Group fan-out: 3 groups trên order-events + scaling + cooperative rebalance*

```java
// Consumer Group: fan-out pattern — multiple services consume same order-events
// Each group gets ALL messages independently (different group.id = independent offset)

// Group 1: inventory-service reserves stock
@KafkaListener(topics = "order-events", groupId = "inventory-service")
public void reserveStock(OrderCreatedEvent event, Acknowledgment ack) {
    inventoryService.reserve(event.getOrderId(), event.getItems());
    ack.acknowledge();
}

// Group 2: notification-service sends confirmation email
@KafkaListener(topics = "order-events", groupId = "notification-service")
public void sendConfirmation(OrderCreatedEvent event, Acknowledgment ack) {
    notificationService.sendOrderConfirmed(event.getCustomerEmail(), event.getOrderId());
    ack.acknowledge();
}

// Group 3: analytics-service records metrics (can lag behind, no manual ack needed)
@KafkaListener(topics = "order-events", groupId = "analytics-service")
public void recordMetrics(OrderCreatedEvent event) {
    metricsService.recordNewOrder(event.getOrderId(), event.getTotalAmount());
    // auto-commit is fine for analytics — losing a metric is acceptable
}

// Scaling: topic has 6 partitions → max 6 consumer instances per group
// Deploy 3 instances of inventory-service → each handles 2 partitions
// Add 3 more instances → each handles 1 partition (max parallelism)
// Add a 7th instance → it sits idle (no partition to assign)

// Rebalance: triggered when consumer joins/leaves/crashes
// Use CooperativeStickyAssignor to minimize partition movement during rebalance:
// spring.kafka.consumer.partition-assignment-strategy:
//   org.apache.kafka.clients.consumer.CooperativeStickyAssignor
```

## Ứng Dụng Thực Tế

Thiết kế số partition cho parallelism consumer mong đợi. Nếu cần 10 consumer song song cho topic, cần ít nhất 10 partition. Xem xét cooperative rebalancing (<code>CooperativeStickyAssignor</code>) để giảm downtime rebalance.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao số consumers trong group không vượt số partitions?</strong></summary>

**A:** Mỗi partition chỉ được assign cho một consumer trong group tại một thời điểm — để đảm bảo ordering và không duplicate processing. Nếu consumers > partitions: consumer thừa sẽ idle (không có partition nào để consume). Ví dụ: 3 partitions, 5 consumers → 3 consume, 2 idle. Scale consumer group: tăng partitions trước (không thể giảm), rồi tăng consumers. Với nhiều consumer group khác nhau (group A, group B): mỗi group nhận toàn bộ messages — Kafka multicast.

</details>

<details>
<summary><strong>Consumer lag là gì và monitor thế nào?</strong></summary>

**A:** Consumer lag = khoảng cách giữa latest offset của partition và committed offset của consumer group — số messages chưa được process. Lag tăng = consumer không theo kịp producer. Monitor: `kafka-consumer-groups.sh --describe --group myGroup`, hoặc JMX metrics `kafka.consumer:type=consumer-fetch-manager-metrics,client-id=*,records-lag-max`. Alert khi lag tăng consistently (không phải spike ngắn). Fix: tăng consumers (và partitions nếu cần), optimize consumer processing, hoặc scale producer down.

</details>
