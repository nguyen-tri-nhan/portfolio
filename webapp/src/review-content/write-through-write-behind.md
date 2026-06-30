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

1. Rủi ro của Write-Behind caching là gì?
1. Khi nào bạn dùng Write-Around thay vì Write-Through?
1. Làm thế nào để duy trì consistency giữa cache và DB trong Write-Through?
