---
key: "Scalability"
title: "Scalability"
crumb: "7. System Design"
---

Scalability là khả năng xử lý tải tăng trưởng bằng cách thêm tài nguyên — theo chiều ngang (nhiều node hơn) hoặc chiều dọc (node lớn hơn) — với thiết kế stateless là yếu tố then chốt.

## Điểm Chính

- <strong>Vertical scaling</strong>: máy lớn hơn (nhiều CPU/RAM hơn). Đơn giản, có giới hạn phần cứng, single point of failure.
- <strong>Horizontal scaling</strong>: nhiều máy hơn. Cần load balancing và stateless service.
- <strong>Stateless</strong>: không có server-side session; state trong DB/Redis. Bất kỳ instance nào xử lý bất kỳ request nào.
- Bottleneck cần xác định: DB (phổ biến nhất), network I/O, CPU-bound processing, memory.
- Load testing: JMeter, k6, Gatling — tìm nơi hệ thống sụp đổ trước production.

## Ví Dụ Code

*Scalability: cache layer → stateless session (Spring Session Redis) → HPA auto-scale*

```java
// Scalability: identify bottleneck before scaling
// Typical order: cache → read replica → app horizontal scale → write sharding

// Step 1: Add cache layer (reduces DB read load 90%+)
@Service @RequiredArgsConstructor
public class ProductService {
    private final ProductRepository repo;
    private final RedisTemplate<String, Product> redis;

    public Product getProduct(Long id) {
        String key = "product:" + id;
        Product cached = redis.opsForValue().get(key);
        if (cached != null) return cached;      // cache hit: ~1ms
        Product p = repo.findById(id).orElseThrow(); // DB: ~50ms
        redis.opsForValue().set(key, p, Duration.ofMinutes(30));
        return p;
    }
}

// Step 2: Stateless service — session in Redis (enables horizontal scaling)
// BAD: in-memory session (breaks with 2+ instances)
// HttpSession session = request.getSession();
// session.setAttribute("cart", cart); // only on this instance!

// GOOD: Spring Session Redis (transparent, zero-code change)
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800)
@Configuration
public class SessionConfig {}
// All instances share session via Redis — any instance handles any request

// Step 3: Kubernetes HPA — auto-scale based on CPU or custom metric
// apiVersion: autoscaling/v2
// spec:
//   minReplicas: 2          # always at least 2 for HA
//   maxReplicas: 20
//   metrics:
//   - type: Resource
//     resource: { name: cpu, target: { averageUtilization: 70 } }

// Load testing to find bottleneck (k6 example):
// k6 run --vus 100 --duration 30s script.js
// Watch: CPU, DB connection pool, GC pause, response P99 latency
// Bottleneck = first thing that saturates → fix that before scaling app servers
```

## Ứng Dụng Thực Tế

Trước khi scale horizontally, xác định bottleneck. Thường: thêm DB read replica, thêm caching layer, sau đó scale app server. Stateless service scale dễ dàng — chỉ cần thêm instance đằng sau load balancer.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa horizontal và vertical scaling là gì?
1. Tại sao service phải stateless để scale horizontally?
1. Làm thế nào để xác định bottleneck trong hệ thống đang chịu tải?
