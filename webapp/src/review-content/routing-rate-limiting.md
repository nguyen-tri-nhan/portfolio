---
key: "Routing & Rate Limiting"
title: "Routing & Rate Limiting"
crumb: "5. Microservices › API Gateway"
---

Routing hướng request đến backend service đúng; rate limiting bảo vệ service khỏi quá tải bằng cách giới hạn tần suất request mỗi client hoặc toàn cầu.

## Điểm Chính

- Routing rule: theo path prefix, hostname, header, query param hoặc method.
- Thuật toán rate limiting: Token Bucket (thân thiện burst), Sliding Window (mượt), Fixed Window (đơn giản).
- Rate limit key: theo IP, user ID, API key hoặc per-route.
- Spring Cloud Gateway: dùng <code>RedisRateLimiter</code> backed bởi Redis cho distributed rate limiting.
- HTTP 429 Too Many Requests khi vượt rate limit; bao gồm header <code>Retry-After</code>.

## Ví Dụ Code

*Token bucket với tiered limits (free/premium) + routing rules + 429 response headers + sliding window*

```java
// ✅ Token Bucket algorithm (used by Spring Cloud Gateway RedisRateLimiter)
// - replenishRate: tokens added per second (sustained rate)
// - burstCapacity: max tokens bucket can hold (burst allowance)
// - Each request consumes 1 token; if bucket empty → 429 Too Many Requests

// ── Tiered rate limits per user role ──
@Configuration
public class RateLimitConfig {

    // Free users: 10 req/sec, burst up to 20
    @Bean("freeRateLimiter")
    public RedisRateLimiter freeRateLimiter() {
        return new RedisRateLimiter(10, 20, 1);
    }

    // Premium users: 100 req/sec, burst up to 200
    @Bean("premiumRateLimiter")
    public RedisRateLimiter premiumRateLimiter() {
        return new RedisRateLimiter(100, 200, 1);
    }

    // Key resolver: rate limit per authenticated user (from JWT claim header)
    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> Mono.justOrEmpty(
            exchange.getRequest().getHeaders().getFirst("X-User-Id")
        ).switchIfEmpty(Mono.just("anonymous"));  // unauthenticated share one bucket
    }

    // Key resolver: rate limit per API key (for third-party integrations)
    @Bean
    public KeyResolver apiKeyResolver() {
        return exchange -> Mono.justOrEmpty(
            exchange.getRequest().getHeaders().getFirst("X-API-Key")
        ).defaultIfEmpty("no-api-key");
    }
}

// ── Route with routing + rate limiting ──
.route("product-search", r -> r
    .path("/api/products/search/**")             // routing: path-based
    .and().method(HttpMethod.GET)                // method-based routing
    .filters(f -> f
        .requestRateLimiter(c -> c
            .setRateLimiter(freeRateLimiter())   // 10 req/sec per user
            .setKeyResolver(userKeyResolver())
            .setDenyEmptyKey(false))             // allow anonymous (share bucket)
        .addResponseHeader("X-RateLimit-Policy", "10req/s")
    )
    .uri("lb://product-service")
)

// ── What the client sees on rate limit exceeded ──
// HTTP 429 Too Many Requests
// Headers:
//   X-RateLimit-Remaining: 0
//   X-RateLimit-Replenish-Rate: 10
//   X-RateLimit-Burst-Capacity: 20
//   Retry-After: 1              ← client should wait 1 second before retrying

// ✅ Sliding Window counter (manual, no external dependency) — for simpler cases
@Component
public class SlidingWindowRateLimiter {
    private final Map<String, Deque<Long>> requestTimes = new ConcurrentHashMap<>();

    public boolean isAllowed(String userId, int maxRequests, long windowMs) {
        long now = System.currentTimeMillis();
        Deque<Long> times = requestTimes.computeIfAbsent(userId, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && times.peekFirst() < now - windowMs) times.pollFirst();
            if (times.size() >= maxRequests) return false;  // exceeded
            times.addLast(now);
            return true;
        }
    }
}
```

## Ứng Dụng Thực Tế

Áp dụng rate limit tại gateway cho client bên ngoài và tùy chọn per-service cho bảo vệ nội bộ. Dùng limit khác nhau mỗi tier (miễn phí vs trả phí). Expose quota còn lại trong response header để client có thể back off dần.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>API Gateway rate limiting dùng thuật toán nào?</strong></summary>

**A:** (1) **Token bucket**: bucket chứa N tokens, mỗi request consume 1 token, token refill theo tốc độ cố định — cho phép burst ngắn. (2) **Leaky bucket**: request vào queue, xử lý theo tốc độ cố định — smooth output, không cho burst. (3) **Fixed window**: đếm request trong window cố định (1 minute) — có edge case burst tại boundary. (4) **Sliding window log**: track timestamp của mỗi request — exact nhưng memory intensive. (5) **Sliding window counter**: kết hợp fixed window + weighted — balance accuracy vs memory. AWS API Gateway, Nginx dùng leaky bucket; Kong, Redis rate-limiting plugin dùng token bucket.

</details>

<details>
<summary><strong>Làm thế nào để implement distributed rate limiting?</strong></summary>

**A:** Single instance: in-memory counter đơn giản. Distributed (nhiều API gateway instance): dùng **Redis** làm shared counter. Pattern với Redis:
```lua
-- Lua script atomic trong Redis
local count = redis.call('INCR', key)
if count == 1 then redis.call('EXPIRE', key, 60) end
return count
```
Tradeoff: Redis là single point (dùng Redis Cluster để HA). Alternative: sticky routing — same client → same gateway instance (đơn giản hơn nhưng không perfect). Redis sorted set cho sliding window log. Thư viện: Bucket4j (Java), Resilience4j RateLimiter.

</details>

<details>
<summary><strong>Rate limit response trả về gì theo best practice?</strong></summary>

**A:** HTTP **429 Too Many Requests** với headers: `Retry-After: 60` (seconds until reset), `X-RateLimit-Limit: 100` (requests allowed per window), `X-RateLimit-Remaining: 0` (remaining in current window), `X-RateLimit-Reset: 1735689600` (Unix timestamp khi reset). Body: `{"error": "rate_limit_exceeded", "message": "Too many requests. Retry after 60 seconds."}`. Client behavior: đọc `Retry-After` header, wait, rồi retry với exponential backoff nếu vẫn rate limited. Không return 503 (Service Unavailable) cho rate limiting — đó là server error, không phải client error.

</details>
