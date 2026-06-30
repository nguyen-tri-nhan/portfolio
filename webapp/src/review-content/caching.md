---
key: "Caching"
title: "Caching"
crumb: "7. System Design"
---

Caching lưu dữ liệu thường xuyên truy cập trong memory nhanh để giảm latency và tải DB, dùng chiến lược như Cache-Aside, Write-Through và eviction policy phù hợp.

## Điểm Chính

- Cache hit: dữ liệu trong cache, trả về ngay. Cache miss: fetch từ nguồn, lưu vào cache.
- TTL (Time To Live): tự động hết hạn dữ liệu cũ. Cân bằng freshness vs hit rate.
- Cache invalidation: vấn đề khó nhất. Tùy chọn: TTL, event-driven invalidation, write-through.
- <strong>L1</strong>: in-process (Caffeine). <strong>L2</strong>: distributed (Redis). <strong>L3</strong>: CDN (static asset).
- Cache warming: pre-populate khi khởi động để tránh cold-start miss storm.

## Ví Dụ Code

*Two-level cache: Caffeine L1 + Redis L2 config; @Cacheable/@CachePut/@CacheEvict; hit rate monitoring*

```java
// Two-level cache: Caffeine (L1, per-instance, nanoseconds) + Redis (L2, shared, milliseconds)
@Configuration
public class CacheConfig {
    // L1: Caffeine — in-process, ultra-fast (no network), but per-instance
    @Bean
    public CacheManager caffeineCacheManager() {
        CaffeineCacheManager mgr = new CaffeineCacheManager("products", "users");
        mgr.setCaffeine(Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .recordStats()); // enable hit rate metrics
        return mgr;
    }

    // L2: Redis — shared across all instances, survives restart
    @Bean
    public RedisCacheManager redisCacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));
        return RedisCacheManager.builder(factory).cacheDefaults(config).build();
    }
}

// Service: declarative caching with @Cacheable (uses configured CacheManager)
@Service @RequiredArgsConstructor
public class ProductService {
    private final ProductRepository repo;

    // Cache-Aside: check cache first, populate on miss
    @Cacheable(value = "products", key = "#id", unless = "#result == null")
    public Product findById(Long id) {
        return repo.findById(id).orElse(null); // only called on cache MISS
    }

    // Write-Through: update cache when DB is updated
    @CachePut(value = "products", key = "#result.id")
    public Product update(Product product) {
        return repo.save(product); // cache updated with return value
    }

    // Cache eviction on delete
    @CacheEvict(value = "products", key = "#id")
    public void delete(Long id) {
        repo.deleteById(id);
    }

    // Scheduled full eviction (safety net for stale data)
    @CacheEvict(value = "products", allEntries = true)
    @Scheduled(fixedDelay = 3_600_000) // every 1 hour
    public void evictAll() {}
}

// Monitor cache effectiveness:
// caffeineCacheManager.getCache("products").getNativeCache() → stats.hitRate()
// Target hit rate > 90%; if lower → wrong TTL, wrong key strategy, or cache too small
```

## Ứng Dụng Thực Tế

Cấu hình two-level cache: Caffeine (L1, nanosecond, per-instance) backed bởi Redis (L2, millisecond, shared). Điều này giảm Redis network overhead cho hot key trong khi vẫn nhất quán qua các instance.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Cache Stampede là gì và prevent thế nào?</strong></summary>

**A:** Cache key expire đồng thời, hàng trăm requests cùng lúc miss cache và đổ vào DB → DB quá tải. Prevent: (1) **Mutex/Lock**: chỉ một request rebuild cache, request khác chờ. Redis: `SET lock:key 1 NX EX 10` → chỉ winner proceed. (2) **Early Expiration**: background thread refresh trước khi expire (probabilistic early expiration). (3) **Stagger TTL**: `TTL = base_ttl + random(0, variance)` — các keys expire ở các thời điểm khác nhau. (4) **Promise/Future**: request đang rebuild trả về promise, request khác wait trên cùng promise.

</details>

<details>
<summary><strong>Write-through và Write-behind caching khác nhau thế nào?</strong></summary>

**A:** Write-through: write vào cache và DB synchronously — consistency tốt nhưng write latency tăng (cả hai phải succeed). Write-behind (write-back): write vào cache, ACK client ngay; async flush vào DB sau. Write latency thấp nhưng nếu cache node crash trước khi flush → data loss. Read-through: cache tự load từ DB khi miss (thay vì app load). Cache-aside (lazy loading): app tự manage cache: miss → load từ DB → populate cache. Cache-aside là pattern phổ biến nhất trong Java với Spring @Cacheable.

</details>
