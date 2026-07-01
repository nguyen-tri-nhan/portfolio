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

<details>
<summary><strong>Sự khác biệt giữa eventual consistency và strong consistency là gì?</strong></summary>

**A:** **Strong consistency**: sau khi write thành công, mọi read tiếp theo (từ bất kỳ node nào) đều thấy giá trị mới nhất — đòi hỏi coordination. **Eventual consistency**: sau write, system *cuối cùng* sẽ hội tụ đến giá trị mới nhất — trong thời gian đó có thể đọc được giá trị cũ (stale). Trade-off: strong consistency có latency cao hơn (phải sync); eventual consistency có availability cao hơn và latency thấp hơn.

</details>

<details>
<summary><strong>"Read-your-writes" consistency là gì và làm thế nào để implement?</strong></summary>

**A:** **Read-your-writes**: sau khi user A write, user A (cùng session) luôn thấy write đó — kể cả khi đọc từ replica. *Người khác* có thể thấy stale. Implement: (1) Sau write, route read của user đó đến primary tạm thời (dùng session flag). (2) Ghi timestamp write vào session cookie, read request gửi timestamp → replica chờ đủ replication đến timestamp đó rồi mới trả lời. (3) Luôn read from primary cho user context cụ thể.

</details>

<details>
<summary><strong>CRDT là gì và giúp gì với eventual consistency?</strong></summary>

**A:** **CRDT (Conflict-free Replicated Data Type)**: data structure được thiết kế để tự động merge conflict mà không cần central coordination. Ví dụ: Grow-only Counter (G-Counter) chỉ tăng → merge = max của mỗi node; OR-Set cho set có add/remove; LWW-Register (Last-Write-Wins). CRDTs đảm bảo: (1) Concurrent update từ nhiều node luôn merge được. (2) Kết quả cuối cùng deterministic. Dùng: Redis (HyperLogLog), Riak, Apple Notes offline sync.

</details>
