---
key: "Cache-Aside"
title: "Cache-Aside Pattern"
crumb: "7. System Design › Caching"
---

Cache-Aside (Lazy Loading) là caching pattern phổ biến nhất — ứng dụng kiểm tra cache trước, fallback về DB khi miss, sau đó populate cache cho request tương lai.

## Điểm Chính

- Đọc: kiểm tra cache → nếu hit trả về; nếu miss → đọc DB → ghi vào cache → trả về.
- Ghi: cập nhật DB → invalidate (hoặc cập nhật) cache.
- App kiểm soát caching logic — linh hoạt, chỉ cache những gì thực sự được request.
- Nhược điểm: cache miss trên request đầu tiên (cold start). Nguy cơ stale data giữa DB write và cache eviction.
- Thundering herd khi cache miss: nhiều request đồng thời đều hit DB. Sửa: mutex/lock khi miss.

## Ví Dụ Code

*Cache-Aside: read pattern + invalidate-on-write; Thundering herd prevention với Redisson lock*

```java
// Cache-Aside (Lazy Loading): most common pattern for read-heavy workloads
@Service @RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepo;
    private final RedisTemplate<String, Order> redis;

    // Read: check cache → miss → load from DB → populate cache
    public Order getOrder(String orderId) {
        String key = "order:" + orderId;

        Order cached = redis.opsForValue().get(key);
        if (cached != null) {
            log.debug("Cache HIT: orderId={}", orderId);
            return cached; // ~1ms from Redis
        }

        log.debug("Cache MISS: orderId={}", orderId);
        Order order = orderRepo.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId)); // ~20ms from DB
        redis.opsForValue().set(key, order, Duration.ofMinutes(30));
        return order;
    }

    // Write: update DB → invalidate cache (not update — avoids race condition)
    @Transactional
    public Order updateOrder(String orderId, UpdateOrderRequest req) {
        Order order = orderRepo.findById(orderId).orElseThrow();
        order.applyUpdate(req);
        Order saved = orderRepo.save(order);
        redis.delete("order:" + orderId); // evict stale entry; next read re-populates
        return saved;
    }
}

// Thundering herd prevention: only ONE request populates cache on miss
@Service @RequiredArgsConstructor
public class ProductService {
    private final RedisTemplate<String, Product> redis;
    private final ProductRepository repo;
    private final RedissonClient redisson;

    public Product getProduct(Long productId) {
        String cacheKey = "product:" + productId;
        Product cached = redis.opsForValue().get(cacheKey);
        if (cached != null) return cached;

        // Distributed lock: only one request hits DB; others wait and get cached result
        RLock lock = redisson.getLock("lock:product:" + productId);
        lock.lock(3, TimeUnit.SECONDS);
        try {
            // Double-check: another thread may have populated cache while we waited
            cached = redis.opsForValue().get(cacheKey);
            if (cached != null) return cached;

            Product product = repo.findById(productId).orElseThrow();
            redis.opsForValue().set(cacheKey, product, Duration.ofMinutes(30));
            return product;
        } finally {
            lock.unlock();
        }
    }
}
```

## Ứng Dụng Thực Tế

Dùng <code>@Cacheable</code> (Spring) cho Cache-Aside tự động. Với thundering herd trên critical path, dùng Redis distributed lock (Redisson) để đảm bảo chỉ một request populate cache; các request khác chờ và nhận kết quả đã cache.

## Câu Hỏi Phỏng Vấn

1. Luồng đọc và ghi của Cache-Aside là gì?
1. Thundering herd problem trong caching là gì?
1. Khi nào bạn KHÔNG dùng Cache-Aside?
