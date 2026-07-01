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

<details>
<summary><strong>Sliding window rate limiting so sánh với fixed window thế nào?</strong></summary>

**A:** **Fixed window**: count requests trong window cố định (ví dụ 1 minute). Vấn đề: burst tại ranh giới — 100 request cuối window + 100 request đầu window tiếp = 200 request trong 2s (burst 2x). **Sliding window log**: track timestamp của mỗi request, đếm trong cửa sổ trượt [now-60s, now]. Chính xác nhưng O(n) memory. **Sliding window counter**: chia window thành sub-windows, weighted average — balance accuracy vs memory. Resilience4j CircuitBreaker: `COUNT_BASED` (N calls) và `TIME_BASED` (N seconds) sliding windows để tính failure rate.

</details>

<details>
<summary><strong>Implement sliding window counter với Redis thế nào?</strong></summary>

**A:** Dùng Redis sorted set: key = `rate:{userId}`, score = timestamp (unix ms), value = request UUID. Pipeline: `MULTI → ZADD key timestamp uuid → ZREMRANGEBYSCORE key 0 (now-window_ms) → ZCARD key → EXPIRE key window_secs → EXEC`. Sau transaction: so sánh count với limit. Atomic bằng Lua script:
```lua
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < tonumber(ARGV[3]) then
    redis.call('ZADD', key, now, now)
    return 1
end
return 0
```

</details>

<details>
<summary><strong>Sliding window trong Kafka Streams dùng để làm gì?</strong></summary>

**A:** Kafka Streams sliding window: aggregate events trong rolling time window. `TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5))` cho hopping window (non-overlapping). **Sliding window**: window move với mỗi event — mỗi event tạo window kết thúc tại event đó. Dùng cho: fraud detection (count transactions của user trong 5 phút trước mỗi transaction), anomaly detection. `KStream.windowedBy(SlidingWindows.ofTimeDifferenceWithNoGrace(Duration.ofMinutes(5)))`. Khác hopping window: sliding tạo many overlapping windows; hopping tạo discrete non-overlapping windows.

</details>
