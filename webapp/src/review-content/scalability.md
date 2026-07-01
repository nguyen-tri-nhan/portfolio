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

<details>
<summary><strong>Horizontal scaling và vertical scaling khi nào dùng cái nào?</strong></summary>

**A:** **Vertical scaling** (scale up): thêm CPU/RAM vào một server — đơn giản, không cần code change, nhưng có ceiling, single point of failure, downtime khi upgrade. **Horizontal scaling** (scale out): thêm server — phức tạp hơn (load balancing, session, distributed state), không có ceiling lý thuyết, high availability. Chọn vertical: database server (stateful, sharding phức tạp), quick win trong ngắn hạn. Chọn horizontal: stateless web tier, API servers — easy với Kubernetes autoscaling. Best practice: design stateless từ đầu → horizontal scale dễ dàng.

</details>

<details>
<summary><strong>Bottleneck phổ biến nhất khi scale là gì?</strong></summary>

**A:** (1) **Database**: thường là bottleneck đầu tiên — read replicas, connection pooling, caching, sharding. (2) **Session state**: in-memory session không scale — externalize ra Redis/Memcached. (3) **Single point of failure**: load balancer, auth service không HA. (4) **Synchronous blocking calls**: chain của synchronous calls tạo cascading latency — async messaging. (5) **Shared mutable state**: global cache, counter — distributed coordination overhead. Phương pháp: profile trước khi tối ưu — dùng APM (Datadog, Jaeger) để tìm bottleneck thực sự, không đoán.

</details>

<details>
<summary><strong>Database read replica giúp scalability thế nào?</strong></summary>

**A:** Read replicas: secondary databases sync asynchronously từ primary. Read traffic (SELECT) route đến replicas — primary chỉ handle writes. Benefit: scale read throughput tuyến tính (thêm replica), giảm tải primary, replica có thể dùng cho reporting/analytics. Trade-off: **replication lag** — replica có thể lag primary vài ms-s. Không dùng replica để read ngay sau write (stale data). Pattern: read-your-own-writes — route read của user đến primary ngay sau write, fallback sang replica sau. Spring: `@Transactional(readOnly=true)` → datasource routing tới replica.

</details>
