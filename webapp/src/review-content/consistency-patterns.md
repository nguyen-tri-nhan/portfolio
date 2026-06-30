---
key: "Consistency Patterns"
title: "Consistency Pattern"
crumb: "7. System Design"
---

Consistency pattern xác định dữ liệu cần cập nhật đến mức nào qua các node hệ thống phân tán — từ linearizability nghiêm ngặt đến eventual consistency với các trade-off khác nhau.

## Điểm Chính

- <strong>Strong Consistency</strong>: read luôn trả về write gần nhất. Cần synchronous replication. Latency cao hơn.
- <strong>Eventual Consistency</strong>: tất cả node sẽ hội tụ về cùng giá trị khi không có update mới. Availability cao hơn.
- <strong>Read-Your-Writes</strong>: user luôn thấy write của họ, dù người khác có thể thấy stale.
- <strong>Monotonic Read</strong>: nếu bạn đọc giá trị X, bạn không bao giờ đọc giá trị cũ hơn X trong lần đọc tương lai.
- <strong>Session Consistency</strong>: trong một session, đảm bảo read-your-writes và monotonic read.

## Ví Dụ Code

*5 consistency patterns: strong, eventual, read-your-writes, monotonic reads, session consistency với code*

```java
// Consistency patterns: strong vs eventual in Spring Boot + multi-DB context

// 1. STRONG CONSISTENCY: PostgreSQL single node — default ACID behavior
@Transactional(isolation = Isolation.READ_COMMITTED)  // default
public OrderSummary getOrderSummary(String orderId) {
    // Always reads the latest committed data — no stale reads within this DB
    return orderRepo.findById(orderId).map(OrderSummary::from).orElseThrow();
}

// 2. EVENTUAL CONSISTENCY: read replica (async replication lag 10ms-1s)
@Transactional(readOnly = true) // → routed to read replica
public List<OrderSummary> getRecentOrders(String userId) {
    // May return orders placed 200ms ago but not yet replicated
    // Acceptable for: dashboard, history, analytics
    return orderRepo.findByUserIdOrderByCreatedAtDesc(userId, PAGE_LAST_10);
}

// 3. READ-YOUR-WRITES: user must see their own changes immediately
@Transactional
public Order placeOrder(PlaceOrderCommand cmd) {
    Order order = orderRepo.save(new Order(cmd)); // write to primary
    // Return immediately from SAME TRANSACTION on primary → read-your-writes guaranteed
    // Do NOT redirect to replica immediately after (replication lag would break this)
    return order;
}

// 4. MONOTONIC READS: prevent "going back in time" across multiple reads
// Problem: user reads order (version 5) from replica-A, then reads same order
// from replica-B which is lagging → sees version 4!
// Solution: session affinity to same replica, OR route user to primary for X seconds after write

// 5. SESSION CONSISTENCY: combine read-your-writes + monotonic reads
// Implementation: track last-write timestamp in user session
// If request has write within last 5 seconds → route to primary
@GetMapping("/orders/{orderId}")
public Order getOrder(@PathVariable String orderId, HttpSession session) {
    Instant lastWrite = (Instant) session.getAttribute("lastOrderWrite");
    boolean recentWrite = lastWrite != null &&
        Duration.between(lastWrite, Instant.now()).getSeconds() < 5;
    // recentWrite → query primary; otherwise → replica (via @Transactional(readOnly=true))
    return recentWrite ? orderQueryService.fromPrimary(orderId)
                       : orderQueryService.fromReplica(orderId);
}
```

## Ứng Dụng Thực Tế

Với thao tác hiển thị cho user, đảm bảo "read-your-writes" consistency — user phải thấy thay đổi của họ ngay lập tức. Với analytical dashboard query qua region, eventual consistency ổn (stale vài giây chấp nhận được).

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa eventual consistency và strong consistency là gì?
1. "Read-your-writes" consistency là gì và làm thế nào để implement?
1. CRDT là gì và giúp gì với eventual consistency?
