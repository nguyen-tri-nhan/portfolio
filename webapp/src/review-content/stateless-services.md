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

1. Điều gì làm cho service trở thành stateless?
1. Làm thế nào để xử lý file upload trong stateless service?
1. Sticky session là gì và tại sao là anti-pattern?
