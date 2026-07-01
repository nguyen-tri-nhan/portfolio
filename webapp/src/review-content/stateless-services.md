---
key: "Stateless Services"
title: "Stateless Service"
crumb: "7. System Design › Scalability"
---

Stateless service không lưu trữ dữ liệu session trong process; mỗi request mang tất cả context cần thiết, cho phép bất kỳ instance nào xử lý bất kỳ request nào và horizontal scaling dễ dàng.

## Điểm Chính

- Authentication: dùng JWT (token mang identity) hoặc Redis session store chia sẻ.
- File upload: lưu vào S3/GCS, không phải local disk.
- Background job: dùng queue (SQS, Kafka), không phải in-process scheduler trên một instance.
- Configuration: externalize ra biến môi trường, ConfigMap hoặc config server.
- Caching: dùng Redis, không phải in-process map (các instance khác nhau cache dữ liệu khác nhau).

## Ví Dụ Code

*Stateless: Redis cart vs in-memory (anti-pattern); S3 file upload; distributed lock cho scheduled job*

```java
// Stateful (BAD): in-memory cart breaks with multiple instances
@RestController
public class CartController {
    // Each instance has its OWN map — instance A doesn't know instance B's cart!
    private final Map<String, Cart> carts = new ConcurrentHashMap<>();

    @PostMapping("/cart/{userId}/add")
    void addItem(@PathVariable String userId, @RequestBody CartItem item) {
        carts.computeIfAbsent(userId, k -> new Cart()).addItem(item);
        // Instance A has user1's cart; Instance B returns empty cart for user1!
    }
}

// Stateless (GOOD): cart stored in Redis — all instances share same state
@RestController @RequiredArgsConstructor
public class CartController {
    private final RedisTemplate<String, CartItem> redis;

    @PostMapping("/cart/{userId}/add")
    void addItem(@PathVariable String userId, @RequestBody CartItem item) {
        redis.opsForList().rightPush("cart:" + userId, item); // shared across instances
        redis.expire("cart:" + userId, Duration.ofDays(7));
    }

    @GetMapping("/cart/{userId}")
    List<CartItem> getCart(@PathVariable String userId) {
        return redis.opsForList().range("cart:" + userId, 0, -1); // any instance can read
    }
}

// File upload: stateless — store in S3, not local disk
@PostMapping("/orders/{orderId}/receipt")
public String uploadReceipt(@PathVariable String orderId,
        @RequestParam MultipartFile file) throws IOException {
    String key = "receipts/" + orderId + "/" + file.getOriginalFilename();
    s3Client.putObject(PutObjectRequest.builder().bucket("order-docs").key(key).build(),
        RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
    return "s3://order-docs/" + key; // return URL, not local path
}

// Scheduled jobs: stateless with distributed lock (only one instance runs the job)
@Scheduled(fixedDelay = 60_000)
public void processExpiredOrders() {
    if (!distributedLock.tryLock("expired-orders-job")) return; // only one instance wins
    try { orderService.cancelExpiredOrders(); }
    finally { distributedLock.unlock("expired-orders-job"); }
}
```

## Ứng Dụng Thực Tế

Kiểm tra ứng dụng để tìm state trong process: in-memory cache, ThreadLocal data tồn tại sau request, static field với mutable state. Di chuyển tất cả ra Redis, DB, hoặc để rebuild mỗi request.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Stateless service là gì và tại sao dễ scale hơn?</strong></summary>

**A:** **Stateless service**: không giữ session state trong memory giữa requests — mỗi request **self-contained** với tất cả cần thiết (token, data). **Stateful**: giữ session state trong memory → cùng user phải route tới cùng instance (sticky session) hoặc state phải sync giữa instances. Scale stateless: thêm instance → load balancer route bất kỳ request đến bất kỳ instance. Scale stateful: cần sticky session (limit flexibility) hoặc distributed session (complexity). Microservices best practice: stateless by design, externalize state ra Redis/DB.

</details>

<details>
<summary><strong>Externalize session state thế nào với Spring?</strong></summary>

**A:** Spring Session: `spring-session-data-redis` — tự động store session trong Redis thay vì memory. Config: `@EnableRedisHttpSession` + Redis connection. Session ID trong cookie, state trong Redis. Mọi instance share session store → stateless instances. Alternative: JWT (không cần server-side session — token chứa claims, stateless hoàn toàn). JWT stateless: không cần lookup session → faster, nhưng không thể invalidate individual token (chỉ expire). Session + Redis: có thể invalidate bất kỳ session nào (logout force, security revoke).

</details>

<details>
<summary><strong>Stateless nghĩa là không dùng database không?</strong></summary>

**A:** **Không** — stateless nghĩa là không giữ **per-request/session state trong service memory**. Database persist state là fine — đó là **durable shared state**, không phải per-instance state. Stateless service vẫn: read/write DB, read/write cache, call other services. Distinction: nếu restart instance, không có data loss (tất cả state ở DB/cache). Nếu có in-memory Map tích lũy user sessions → restart mất data → stateful. Shopping cart: stateless = store cart trong Redis/DB (persist across instances); stateful = store trong service memory (lost on restart/failover).

</details>
