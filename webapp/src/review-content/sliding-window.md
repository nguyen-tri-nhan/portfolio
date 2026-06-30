---
key: "Sliding Window"
title: "Sliding Window Rate Limiting"
crumb: "7. System Design › Rate Limiting"
---

Sliding Window đếm request trong rolling time window từ timestamp hiện tại của mỗi request, cung cấp rate limiting mượt mà mà không có spike edge-case của fixed window.

## Điểm Chính

- Lỗi Fixed Window: giới hạn 100 req/phút. Lúc 00:59, gửi 100. Lúc 01:01, gửi 100 nữa → 200 trong 2 giây.
- Sliding Window: đếm request trong 60 giây qua từ HIỆN TẠI. Không spike ranh giới window.
- Implementation Redis: <code>ZADD</code> với timestamp score; <code>ZREMRANGEBYSCORE</code> để xóa cũ; <code>ZCARD</code> để đếm.
- Sliding Window Log: lưu mỗi timestamp request. Chính xác, memory tỷ lệ với số request.
- Sliding Window Counter: kết hợp fixed window dùng weighted average. Hiệu quả memory hơn.

## Ví Dụ Code

*Redis sorted set sliding window log; pipeline atomic ops; fixed window boundary spike problem; counter approximation*

```java
// Sliding Window Log: exact count in rolling time window using Redis sorted set
// Each request = one entry in sorted set (score = timestamp)
// Window = remove entries older than now-windowMs, then count remaining

@Service @RequiredArgsConstructor
public class SlidingWindowRateLimiter {
    private final RedisTemplate<String, String> redis;
    private static final long WINDOW_MS  = 60_000L; // 1-minute sliding window
    private static final int  LIMIT      = 100;      // max 100 requests per window

    public boolean isAllowed(String clientId) {
        long now        = System.currentTimeMillis();
        long windowStart = now - WINDOW_MS;
        String key      = "ratelimit:sw:" + clientId;

        // Pipeline: remove old → add current → count → set expiry (atomic-ish)
        List<Object> results = redis.executePipelined((RedisCallback<Object>) conn -> {
            byte[] keyBytes = key.getBytes();
            conn.zRemRangeByScore(keyBytes, 0, windowStart - 1); // remove entries before window
            conn.zAdd(keyBytes, now, (now + "-" + ThreadLocalRandom.current().nextInt()).getBytes());
            conn.zCard(keyBytes);
            conn.expire(keyBytes, 120); // expire key 2x window size (cleanup)
            return null;
        });

        Long count = (Long) results.get(2);
        boolean allowed = count != null && count <= LIMIT;
        if (!allowed) {
            log.warn("Rate limit exceeded: clientId={} count={} limit={}", clientId, count, LIMIT);
        }
        return allowed;
    }
}

// Fixed Window problem (why sliding window is better):
// Limit: 100 req/min using fixed window
// 00:59 → send 100 requests (fills window 1)
// 01:00 → window resets → send 100 more requests
// Result: 200 requests in 2 seconds! (double the rate at boundary)
// Sliding window counts in [now-60s, now] → prevents this spike

// Sliding Window Counter (memory-efficient approximation):
// Combine two fixed windows with weighted average
// current_count + previous_count * (remaining_time_in_current_window / window_size)
// Memory: O(1) per user vs O(requests) for sliding window log

// When to use which:
// Sliding Window Log: strict accuracy required (financial API, OAuth token endpoint)
// Sliding Window Counter: high-traffic APIs where ~5% error in rate is acceptable
// Fixed Window: simple counters, analytics (where boundary spike is acceptable)
```

## Ứng Dụng Thực Tế

Sliding window chính xác hơn fixed window nhưng dùng nhiều memory hơn (O(request mỗi window) mỗi user). Với hầu hết API rate limiting, fixed window với tolerance 2× là đủ và đơn giản hơn nhiều. Dùng sliding window cho yêu cầu chính xác nghiêm ngặt.

## Câu Hỏi Phỏng Vấn

1. Double-spend problem với fixed window rate limiting là gì?
1. Làm thế nào để implement sliding window trong Redis?
1. Trade-off giữa sliding window log và sliding window counter là gì?
