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

1. Sự khác biệt giữa token bucket và leaky bucket rate limiting là gì?
1. Làm thế nào để implement distributed rate limiting qua nhiều gateway instance?
1. Một response bị rate-limited nên trả về HTTP status code và header nào?
