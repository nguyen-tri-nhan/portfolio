---
key: "Algorithms"
title: "Thuật Toán Load Balancing"
crumb: "7. System Design › Load Balancing"
---

Thuật toán load balancing xác định cách phân phối request đến — từ round-robin đơn giản đến least-connections tiên tiến và consistent hashing.

## Điểm Chính

- <strong>Round Robin</strong>: request luân phiên qua server theo thứ tự. Hoạt động tốt khi tất cả server bằng nhau.
- <strong>Weighted Round Robin</strong>: server weight cao hơn nhận nhiều request hơn. Tốt cho phần cứng không đồng nhất.
- <strong>Least Connections</strong>: route đến server có ít active connection nhất. Tốt nhất cho request duration biến đổi.
- <strong>IP Hash</strong>: cùng client IP luôn → cùng server (sticky). Hữu ích cho session state (tránh nếu có thể).
- <strong>Random</strong>: chọn server ngẫu nhiên. Hiệu quả đáng ngạc nhiên ở quy mô lớn (biến thể power-of-two-choices).
- <strong>Resource-based</strong>: route dựa trên CPU/memory của server (agent báo cáo metric).

## Ví Dụ Code

*6 algorithms: round-robin, least-conn, weighted, IP hash, P2C, consistent hashing + health check*

```java
// Load balancing algorithm comparison — picking the right one for your workload

// 1. Round Robin: simple, works when requests are uniform in cost
// order-service: each API call takes ~50ms → round robin is fine
// nginx: round_robin (default)

// 2. Least Connections: better when request duration varies significantly
// report-service: some queries take 200ms, some take 5s → least_conn routes to least busy
// nginx: least_conn;

// 3. Weighted Round Robin: different instance capacities
// payment-service: 2 high-spec instances (weight=5), 1 low-spec (weight=1)
// nginx: server payment-1:8080 weight=5; server payment-2:8080 weight=5; server payment-3:8080 weight=1;

// 4. IP Hash / User-ID Hash: session stickiness (avoid if possible — breaks HA)
// Legacy app with in-memory session (can't go stateless immediately):
// nginx: ip_hash;  → same client IP always routes to same server
// Downside: if server crashes, all that client's sessions are lost

// 5. Power-of-Two-Choices (P2C): best general algorithm for distributed LBs
// Pick 2 random backends, route to the one with fewer active requests
// Used by: Envoy, HAProxy, Linkerd, AWS ALB
// Achieves O(log log N) max load — near-optimal distribution without coordination

// 6. Consistent Hashing: cache-aware routing (minimize cache misses)
// product-service with local Caffeine cache: route product-123 always to same instance
// Hash("product-123") % ring → same server → cache hit rate improves dramatically
// Used when: server-local cache that's expensive to rebuild (ML model, large dataset)

// Health check strategy (remove unhealthy, restore when healthy):
// Active: LB pings /actuator/health every 5s (Nginx Plus, AWS ALB)
// Passive: track error rate; remove after 3 consecutive 5xx (nginx: max_fails=3 fail_timeout=30s)
// server order-service-1:8080 max_fails=3 fail_timeout=30s;
```

## Ứng Dụng Thực Tế

Với hầu hết trường hợp, round-robin hoặc least-connections đủ tốt. Dùng consistent hashing khi có server-local cache (giảm cache miss). Dùng least-response-time khi request có latency biến đổi (image processing, ML inference).

## Câu Hỏi Phỏng Vấn

1. Tại sao Least Connections tốt hơn Round Robin cho long-lived connection?
1. Thuật toán power-of-two-choices là gì?
1. Khi nào bạn dùng IP Hash cho load balancing?
