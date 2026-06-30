---
key: "Token Bucket"
title: "Thuật Toán Token Bucket"
crumb: "7. System Design › Rate Limiting"
---

Token Bucket thêm token vào bucket với tốc độ cố định; mỗi request tiêu thụ một token — khi bucket trống, request bị từ chối. Cho phép bursting có kiểm soát.

## Điểm Chính

- Bucket có capacity N (max burst). Token được thêm với tốc độ R mỗi giây.
- Request: tiêu thụ 1 token nếu có sẵn; nếu không từ chối (hoặc chờ).
- Cho phép bursting đến N request ngay lập tức nếu token đã tích lũy.
- Ví dụ: rate=100/phút, capacity=200. Client có thể burst 200 request, sau đó chậm xuống 100/phút.
- Vs Leaky Bucket: leaky bucket làm mượt output về tốc độ cố định bất kể input. Token bucket cho phép bursting.

## Ví Dụ Code

*Redis token bucket: Lua atomic refill+consume; Bucket4j Redis distributed; vs Leaky Bucket*

```java
// Token Bucket: allows burst then throttles to steady rate
// Bucket capacity=100: can burst 100 requests instantly (tokens accumulated)
// Refill rate=10/sec: after burst, sustained rate is 10 req/sec

// Implementation with Redis (distributed, works across all instances)
@Service @RequiredArgsConstructor
public class RedisTokenBucketLimiter {
    private final RedisTemplate<String, String> redis;
    private static final int CAPACITY    = 100;  // max burst
    private static final int REFILL_RATE = 10;   // tokens per second

    // Atomic Lua script: refill + consume in one Redis round-trip
    private static final String TOKEN_BUCKET_SCRIPT =
        "local key = KEYS[1] " +
        "local capacity = tonumber(ARGV[1]) " +
        "local refillRate = tonumber(ARGV[2]) " +
        "local now = tonumber(ARGV[3]) " +
        "local data = redis.call('HMGET', key, 'tokens', 'lastRefill') " +
        "local tokens = tonumber(data[1]) or capacity " +
        "local lastRefill = tonumber(data[2]) or now " +
        "local elapsed = (now - lastRefill) / 1000.0 " +
        "tokens = math.min(capacity, tokens + elapsed * refillRate) " +
        "if tokens >= 1 then " +
        "  tokens = tokens - 1 " +
        "  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now) " +
        "  redis.call('EXPIRE', key, 3600) " +
        "  return 1 " +
        "else " +
        "  return 0 " +
        "end";

    public boolean tryAcquire(String clientId) {
        long now = System.currentTimeMillis();
        Long result = redis.execute(
            new DefaultRedisScript<>(TOKEN_BUCKET_SCRIPT, Long.class),
            List.of("rate:bucket:" + clientId),
            String.valueOf(CAPACITY),
            String.valueOf(REFILL_RATE),
            String.valueOf(now)
        );
        return Long.valueOf(1L).equals(result);
    }
}

// Simpler alternative: Bucket4j with Redis backend (production-ready)
// @Bean Bucket createDistributedBucket(String userId) {
//     BucketConfiguration config = BucketConfiguration.builder()
//         .addLimit(Bandwidth.builder()
//             .capacity(100).refillGreedy(10, Duration.ofSeconds(1)).build())
//         .build();
//     ProxyManager<String> proxyManager = Bucket4jRedis.casBasedBuilder(redis).build();
//     return proxyManager.builder().build(userId, config);
// }

// Token Bucket vs Leaky Bucket:
// Token Bucket: burst allowed (up to capacity tokens), then steady rate → user-friendly
// Leaky Bucket: output is always exactly rate/sec, no burst → smoothing, predictable output
```

## Ứng Dụng Thực Tế

Token bucket là chuẩn cho user-facing rate limiting vì nó cho phép request burst tự nhiên (người dùng hiếm khi gửi request với khoảng cách đều nhau). Dùng thư viện Bucket4j — nó implement điều này với Redis cho môi trường distributed.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa token bucket và leaky bucket là gì?
1. Khi nào token bucket tốt hơn fixed window?
1. Token bucket xử lý burst request thế nào?
