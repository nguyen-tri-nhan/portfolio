---
key: "Eventual Consistency"
title: "Eventual Consistency"
crumb: "7. System Design › Consistency Patterns"
---

Eventual consistency đảm bảo tất cả replica sẽ hội tụ về cùng giá trị theo thời gian mà không có write mới — chấp nhận staleness tạm thời để đổi lấy availability và latency thấp hơn.

## Điểm Chính

- Không có synchronization cost khi write — mỗi replica chấp nhận write độc lập.
- Cần conflict resolution khi concurrent write cùng key: last-write-wins (LWW), CRDT, vector clock.
- Use case: DNS, shopping cart, social media like, NoSQL replication, CDN cache.
- KHÔNG phù hợp cho: giao dịch tài chính, tồn kho (phải ngăn oversell), authentication token.
- Thường hội tụ trong mili giây đến giây, tùy thuộc vào topology replication.

## Ví Dụ Code

*Eventual consistency: CQRS event lag; optimistic UI; DynamoDB consistency level; CRDT conflict resolution*

```java
// Eventual Consistency in practice: CQRS read model sync
// Command side writes → publishes event → Query side eventually updates
// Gap between write and read model update = inconsistency window (ms to seconds)

@Service @RequiredArgsConstructor
public class OrderCommandService {

    @Transactional
    public String placeOrder(PlaceOrderCommand cmd) {
        Order order = orderRepo.save(new Order(cmd));
        // Publish event: query side (dashboard) will update eventually
        eventPublisher.publishEvent(new OrderPlacedEvent(order.getId(), order.getUserId(),
            order.getTotal(), Instant.now()));
        return order.getId();
        // At this point, getOrderDashboard() may NOT yet show this order (eventual)
    }
}

@Component @RequiredArgsConstructor
public class OrderDashboardUpdater {

    @EventListener  // or @KafkaListener for cross-service async
    @Transactional
    public void onOrderPlaced(OrderPlacedEvent event) {
        // Updates read model: usually completes in <100ms (same JVM) or <1s (via Kafka)
        orderDashboardRepo.save(OrderDashboardView.builder()
            .orderId(event.getOrderId())
            .userId(event.getUserId())
            .total(event.getTotal())
            .status(OrderStatus.PENDING)
            .placedAt(event.getPlacedAt())
            .build());
    }
}

// Designing for eventual consistency:
// 1. Include version/timestamp in entity — detect stale reads
// 2. Use idempotent operations — safe to re-apply if event replayed
// 3. UI: optimistic update (show result immediately) + confirm when sync completes
// 4. DynamoDB: per-request consistency level
//    GetItemRequest.builder().consistentRead(false).build()  // eventually consistent (cheaper)
//    GetItemRequest.builder().consistentRead(true).build()   // strongly consistent (2x read units)

// Conflict resolution when two writes race (no distributed lock):
// Last-Write-Wins (LWW): use timestamp; risk: clock skew picks wrong winner
// Vector clocks: causal ordering; Cassandra, Riak use this
// CRDTs (Conflict-free Replicated Data Types): merge automatically
//   example: shopping cart as OR-Set (add wins over remove) → safe to merge from any replica
```

## Ứng Dụng Thực Tế

Thiết kế data model cho eventual consistency nơi bạn dùng nó: dùng thao tác idempotent, bao gồm version number trong entity, và hiển thị thông báo UI phù hợp ("đơn hàng của bạn đang được xử lý") thay vì hiển thị total stale.

## Câu Hỏi Phỏng Vấn

1. Làm thế nào để giải thích eventual consistency cho stakeholder không kỹ thuật?
1. Conflict nào có thể phát sinh với eventual consistency và giải quyết thế nào?
1. Đưa ví dụ khi eventual consistency chấp nhận được vs nguy hiểm.
