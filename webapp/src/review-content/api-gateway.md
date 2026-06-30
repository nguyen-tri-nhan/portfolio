---
key: "API Gateway"
title: "API Gateway"
crumb: "5. Microservices"
---

API Gateway là điểm vào duy nhất cho tất cả client request, xử lý routing, auth, rate limiting, SSL termination và request transformation trước khi chuyển tiếp đến backend service.

## Điểm Chính

- Ẩn service topology nội bộ khỏi client.
- Tập trung: authentication, rate limiting, CORS, logging, SSL termination.
- Tùy chọn: Spring Cloud Gateway, Kong, AWS API Gateway, Nginx, Traefik.
- Pattern BFF (Backend for Frontend): gateway riêng cho từng loại client (mobile vs web).
- Có thể aggregate nhiều service call thành một response (aggregation/composition).

## Ví Dụ Code

*Spring Cloud Gateway: multi-route config, JWT GlobalFilter, rate limiter, circuit breaker, retry*

```java
// ✅ Spring Cloud Gateway: central entry point for all client traffic
// Responsibilities: routing, JWT auth, rate limiting, CORS, request/response logging

@Configuration
public class GatewayConfig {

    @Bean
    public RouteLocator routes(RouteLocatorBuilder b) {
        return b.routes()

            // ── Order Service: authenticated + rate limited ──
            .route("order-service", r -> r
                .path("/api/orders/**")
                .and().header("Authorization")          // only route if Authorization header present
                .filters(f -> f
                    .addRequestHeader("X-Gateway-Version", "1.0")   // tag requests from gateway
                    .addRequestHeader("X-Forwarded-For",             // pass client IP downstream
                        "#{T(reactor.core.publisher.Mono).just(exchange.getRequest().getRemoteAddress())}")
                    .requestRateLimiter(c -> c           // rate limit per user
                        .setRateLimiter(redisRateLimiter())
                        .setKeyResolver(userKeyResolver()))
                    .circuitBreaker(c -> c               // circuit breaker: fallback to /fallback
                        .setName("orderCB")
                        .setFallbackUri("forward:/fallback/orders"))
                    .retry(retryConfig -> retryConfig    // retry 2x on 503
                        .setRetries(2)
                        .setStatuses(HttpStatus.SERVICE_UNAVAILABLE))
                )
                .uri("lb://order-service")              // lb:// → Spring Cloud LoadBalancer
            )

            // ── User Service: public auth endpoints (no auth required) ──
            .route("user-auth", r -> r
                .path("/api/users/login", "/api/users/register")
                .filters(f -> f.stripPrefix(0))         // keep path as-is
                .uri("lb://user-service")
            )

            // ── Payment Service: strict rate limit, auth required ──
            .route("payment-service", r -> r
                .path("/api/payments/**")
                .filters(f -> f
                    .requestRateLimiter(c -> c
                        .setRateLimiter(new RedisRateLimiter(5, 10, 1))  // 5 req/sec, burst 10
                        .setKeyResolver(apiKeyResolver())))
                .uri("lb://payment-service")
            )
            .build();
    }

    // Rate limit key: resolve per authenticated user ID from JWT
    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> Mono.justOrEmpty(
            exchange.getRequest().getHeaders().getFirst("X-User-Id")
        ).defaultIfEmpty("anonymous");
    }

    // Rate limit key: resolve per API key header
    @Bean
    public KeyResolver apiKeyResolver() {
        return exchange -> Mono.justOrEmpty(
            exchange.getRequest().getHeaders().getFirst("X-API-Key")
        ).defaultIfEmpty("no-key");
    }
}

// ✅ Global JWT filter: validate token before any route is reached
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String auth = exchange.getRequest().getHeaders().getFirst("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
        // Validate JWT, extract claims, forward userId in header to downstream
        Claims claims = jwtUtil.parse(auth.substring(7));
        ServerHttpRequest mutated = exchange.getRequest().mutate()
            .header("X-User-Id", claims.getSubject())
            .build();
        return chain.filter(exchange.mutate().request(mutated).build());
    }

    @Override public int getOrder() { return -1; }  // run before other filters
}
```

## Ứng Dụng Thực Tế

Đặt JWT validation ở cấp gateway để backend service nhận request đã được xác thực. Đừng đặt business logic trong gateway — nó nên là lớp routing/filtering mỏng. Cho microservice composition phức tạp, xem xét GraphQL tại gateway.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>API Gateway pattern giải quyết những vấn đề gì?</strong></summary>

**A:** (1) **Single entry point**: client không cần biết internal service topology. (2) **Cross-cutting concerns**: authentication, rate limiting, CORS, request logging — implement một lần tại gateway thay vì mỗi service. (3) **Protocol translation**: HTTP ngoài → gRPC trong. (4) **Request aggregation**: một request client → gọi nhiều microservices, aggregate response. (5) **Backend for Frontend (BFF)**: gateway riêng cho web, mobile, partner APIs. Trade-off: gateway là single point of failure (cần HA) và thêm latency hop.

</details>
