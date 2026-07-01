---
key: "Write-Through / Write-Behind"
title: "Write-Through & Write-Behind"
crumb: "7. System Design › Caching"
---

Write-Through cập nhật cache và DB đồng bộ trên mỗi lần ghi (strong consistency); Write-Behind (Write-Back) cập nhật cache ngay lập tức, DB bất đồng bộ (throughput cao hơn, nguy cơ mất dữ liệu).

## Điểm Chính

- <strong>Write-Through</strong>: ghi vào cache và DB atomic. Cache luôn nhất quán với DB. Write latency cao hơn.
- <strong>Write-Behind</strong>: ghi vào cache, queue DB write bất đồng bộ. Write latency thấp, throughput cao. Rủi ro: mất dữ liệu nếu cache chết trước khi ghi DB.
- <strong>Write-Around</strong>: ghi trực tiếp vào DB, bypass cache. Cache được cập nhật trên lần đọc tiếp theo. Tốt cho dữ liệu write-once.
- Write-Through tốt nhất cho: dữ liệu tài chính, consistency quan trọng. Write-Behind: analytics ghi cao, counter.

## Ví Dụ Code

*Write-Through: DB+cache atomic update; @CachePut; Write-Behind: view counter async flush với risk*

```java
// Write-Through: update DB and cache in same operation → strong consistency
@Service @RequiredArgsConstructor
public class UserProfileService {
    private final UserRepository userRepo;
    private final RedisTemplate<String, UserProfile> redis;

    @Transactional
    public UserProfile updateProfile(String userId, UpdateProfileRequest req) {
        UserProfile profile = userRepo.findById(userId).orElseThrow();
        profile.applyUpdate(req);
        UserProfile saved = userRepo.save(profile);         // 1. write to DB
        redis.opsForValue().set("user:" + userId, saved,    // 2. write to cache (same call)
            Duration.ofHours(1));
        return saved; // cache is always consistent with DB
    }
}

// Spring @CachePut = Write-Through declaratively
@CachePut(value = "products", key = "#result.id")  // updates cache on every write
public Product updateProduct(Product product) {
    return productRepo.save(product); // DB write; return value goes into cache
}

// Write-Behind (Write-Back): update cache immediately, persist to DB asynchronously
// Use case: view counters, like counts, real-time analytics — high-frequency writes
@Service @RequiredArgsConstructor
public class ViewCounterService {
    private final RedisTemplate<String, Long> redis;
    private final AsyncProductRepository asyncRepo;

    public long incrementViews(Long productId) {
        String key = "views:product:" + productId;
        Long count = redis.opsForValue().increment(key); // immediate, ~1ms
        // Flush to DB asynchronously every 60 seconds via scheduled job
        return count;
    }

    @Scheduled(fixedDelay = 60_000)
    public void flushViewCounts() {
        // Read all view counts from Redis, batch update to DB
        Set<String> keys = redis.keys("views:product:*");
        if (keys == null) return;
        keys.forEach(key -> {
            Long count = redis.opsForValue().get(key);
            Long productId = Long.parseLong(key.replace("views:product:", ""));
            asyncRepo.updateViewCount(productId, count);   // batch DB update
            redis.delete(key);
        });
    }
}
// Write-Behind risk: if Redis crashes before flush → view count data lost
// Mitigation: Redis AOF persistence + regular flush intervals
```

## Ứng Dụng Thực Tế

Mặc định Write-Through cho hầu hết Spring app dùng <code>@CachePut</code>. Dùng Write-Behind cho counter hoặc tổng hợp metric throughput cao nơi vài giây delay chấp nhận được và mất dữ liệu đôi khi chấp nhận được.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Write-through và write-behind (write-back) cache khác nhau thế nào?</strong></summary>

**A:** **Write-through**: write đến **cả cache và database đồng thời** — data luôn consistent giữa cache và DB. Mỗi write có latency của DB. **Write-behind (write-back)**: write chỉ đến **cache trước**, database được update **async sau** (batched) — faster writes, nhưng data loss nếu cache fail trước khi flush. Use case: write-through cho financial/critical data (consistency quan trọng). Write-behind cho high-write-throughput, loss-tolerant (analytics events, logs, leaderboard). Redis hỗ trợ cả hai qua custom logic — native write-behind qua Lua scripts hoặc Redis keyspace notifications.

</details>

<details>
<summary><strong>Write-around cache là gì?</strong></summary>

**A:** Write-around: write trực tiếp vào **database**, bỏ qua cache hoàn toàn. Data được load vào cache khi có read request (read-through/cache-aside). Dùng khi: write-once, read-never (or rarely) data — ví dụ log events, historical records. Tránh "cache pollution" — không cache data hiếm khi được read. Benefit: giảm cache space cho data không cần thiết. Trade-off: read sau write không thấy trong cache → cache miss → read từ DB. Pattern: combine write-around với TTL-based eviction — eventual ly unused data expire khỏi cache.

</details>

<details>
<summary><strong>Cache thundering herd trong write scenario là gì?</strong></summary>

**A:** Khi cache entry expire và nhiều request cùng lúc miss → tất cả race đến DB để load — **thundering herd** hay **cache stampede**. Với write-through: giảm thundering herd vì cache luôn warm sau write. Fix cho cache-aside: (1) **Mutex/lock**: chỉ một request fetch từ DB, other wait và reuse result. (2) **Probabilistic refresh**: refresh cache một khoảng thời gian trước expiry (random, theo XFetch algorithm). (3) **Stale-while-revalidate**: return stale data cho request đến trong khi refresh async. Redis solution: `SET key value PX ttl NX` để check-and-set atomically.

</details>
