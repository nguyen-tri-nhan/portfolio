---
key: "Eviction Policies"
title: "Chính Sách Eviction Cache"
crumb: "7. System Design › Caching"
---

Eviction policy xác định entry cache nào bị xóa khi cache đầy — LRU (Least Recently Used) phổ biến nhất; LFU và TTL-based phục vụ access pattern khác nhau.

## Điểm Chính

- <strong>LRU</strong> (Least Recently Used): evict entry ít được truy cập gần đây nhất. Tốt cho temporal locality.
- <strong>LFU</strong> (Least Frequently Used): evict entry với số lần truy cập thấp nhất. Tốt hơn cho access lệch (hot item).
- <strong>TTL</strong>: hết hạn sau thời gian cố định, bất kể truy cập. Đơn giản, ngăn stale data.
- <strong>FIFO</strong>: evict entry được chèn lâu nhất. Đơn giản nhưng bỏ qua access pattern.
- <strong>Random</strong>: evict entry ngẫu nhiên. Hiệu quả đáng ngạc nhiên ở quy mô lớn.
- Redis: <code>allkeys-lru</code>, <code>allkeys-lfu</code>, <code>volatile-lru</code>, <code>volatile-ttl</code>.

## Ví Dụ Code

*Caffeine: LRU+TTL+stats monitoring; Redis: allkeys-lfu vs lru vs volatile-ttl; per-domain policy guide*

```java
// Caffeine (L1 cache): configure eviction policy + stats
@Bean
public Cache<String, Product> productCache() {
    return Caffeine.newBuilder()
        .maximumSize(10_000)                     // LRU eviction when size exceeded
        .expireAfterWrite(30, TimeUnit.MINUTES)  // TTL: absolute expiry after write
        .expireAfterAccess(10, TimeUnit.MINUTES) // TTL: reset on each access (LRU-like)
        .recordStats()                           // enable hit/miss/eviction metrics
        .removalListener((key, value, cause) ->
            log.debug("Evicted from cache: key={} reason={}", key, cause))
        .build();
}

// Monitor in production (expose via Actuator or Micrometer)
@Scheduled(fixedDelay = 60_000)
public void logCacheStats() {
    CacheStats stats = productCache.stats();
    log.info("Cache: hitRate={:.2f}% missRate={:.2f}% evictions={}",
        stats.hitRate() * 100, stats.missRate() * 100, stats.evictionCount());
    // Alert if hitRate < 80% (cache too small or wrong TTL)
}

// Redis eviction policy (redis.conf or AWS ElastiCache parameter group)
// maxmemory 512mb
// maxmemory-policy allkeys-lfu   # LFU: evict least-frequently-used keys
//                                # Best for hot-key workloads (product catalog, popular users)

// Policy comparison:
// allkeys-lru:    evict least-recently-used → good for temporal access patterns
// allkeys-lfu:    evict least-frequently-used → good for hot-key (Pareto distribution)
// volatile-lru:   only evict keys WITH TTL, by LRU → protect keys without TTL
// volatile-ttl:   evict key with shortest TTL first → expire sooner anyway
// allkeys-random: random eviction → not recommended (wastes hot entries)
// noeviction:     reject writes when full (returns error) → use only if OOM is unacceptable

// For order-events domain:
// product catalog → allkeys-lfu (few hot products get 80% traffic)
// user sessions   → volatile-lru (sessions have TTL; evict least-recently-used sessions)
// order cache     → volatile-ttl (short-lived; evict soon-to-expire first)
```

## Ứng Dụng Thực Tế

Monitor cache hit rate (mục tiêu >90% cho cache thiết kế tốt). Hit rate thấp = eviction policy sai, TTL sai hoặc dữ liệu sai được cache. Dùng <code>recordStats()</code> của Caffeine trong dev để tune kích thước và TTL trước khi deploy.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa LRU và LFU eviction là gì?</strong></summary>

**A:** **LRU (Least Recently Used)**: evict item không được access **gần nhất** — phù hợp khi recent usage là predictor tốt của future access (temporal locality). **LFU (Least Frequently Used)**: evict item được access **ít lần nhất** theo lịch sử — phù hợp khi frequency là predictor tốt hơn. LFU tốt hơn cho data với stable popularity (hot vs cold content); LRU tốt hơn cho access pattern thay đổi theo thời gian. LRU implement đơn giản hơn (LinkedHashMap); LFU cần counter per item.

</details>

<details>
<summary><strong>Redis quyết định evict gì khi memory đầy thế nào?</strong></summary>

**A:** Phụ thuộc `maxmemory-policy` config: **allkeys-lru** — evict any key theo LRU (phổ biến nhất cho cache). **volatile-lru** — chỉ evict key có TTL, theo LRU. **allkeys-lfu** (Redis 4+) — evict any key theo LFU. **noeviction** — throw error khi memory đầy (default, phù hợp cho data store không phải cache). **allkeys-random** — evict random. Redis dùng **approximate LRU** (sample 5-10 key, evict LRU trong sample) thay vì exact LRU để tránh overhead.

</details>

<details>
<summary><strong>Metric nào cho biết eviction policy cần điều chỉnh?</strong></summary>

**A:** (1) **Eviction rate cao** (`evicted_keys` tăng liên tục trong `INFO stats`): cache quá nhỏ hoặc TTL quá ngắn — tăng memory hoặc điều chỉnh eviction policy. (2) **Hit rate thấp** (`keyspace_hits/(keyspace_hits+keyspace_misses) < 80%`): data bị evict trước khi được hit — tăng memory. (3) **Memory usage tăng liên tục đến maxmemory**: normal nếu policy là allkeys-lru; problematic nếu noeviction vì sẽ throw error sớm.

</details>
