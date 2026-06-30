---
key: "Feign Client"
title: "Feign Client"
crumb: "5. Microservices › Service Communication"
---

Feign là HTTP client declarative tạo implementation từ interface có annotation, đơn giản hóa REST inter-service call với annotation kiểu Spring MVC.

## Điểm Chính

- Định nghĩa interface với <code>@FeignClient(name="service-name")</code> + annotation Spring MVC.
- Tích hợp với Spring Cloud LoadBalancer cho client-side load balancing.
- Tích hợp với Resilience4j cho circuit breaking và retry.
- Fallback: implement interface cho hành vi fallback khi service không khả dụng.
- Truyền header (Authorization, correlation ID) qua <code>RequestInterceptor</code>.

## Ví Dụ Code

*Feign Client: interface definition, custom config (timeout + ErrorDecoder), FallbackFactory per method, global RequestInterceptor (JWT + tracing)*

```java
// ✅ Feign Client: declarative HTTP client for inter-service REST calls

// Step 1: Define the interface — Feign generates the implementation at startup
@FeignClient(
    name    = "payment-service",             // service name in registry (Eureka/Consul)
    url     = "${services.payment.url}",    // override for local dev / external services
    configuration    = FeignPaymentConfig.class,
    fallbackFactory  = PaymentClientFallbackFactory.class
)
public interface PaymentClient {

    @PostMapping("/api/payments/charge")
    PaymentResponse charge(@RequestBody ChargeRequest request);

    @GetMapping("/api/payments/{paymentId}")
    PaymentResponse getPayment(@PathVariable("paymentId") String paymentId);

    @PostMapping("/api/payments/{paymentId}/refund")
    RefundResponse refund(@PathVariable("paymentId") String paymentId,
                          @RequestBody RefundRequest request);
}

// Step 2: Custom Feign configuration — timeout, error decoder, logging
@Configuration
public class FeignPaymentConfig {

    // Timeout: connect 2s, read 5s — CRITICAL: no timeout = threads held indefinitely
    @Bean
    public Request.Options options() {
        return new Request.Options(2, TimeUnit.SECONDS, 5, TimeUnit.SECONDS, true);
    }

    // Custom error decoder: convert Feign HTTP errors to domain exceptions
    @Bean
    public ErrorDecoder errorDecoder() {
        return (methodKey, response) -> switch (response.status()) {
            case 400 -> new InvalidPaymentRequestException("Bad payment request");
            case 404 -> new PaymentNotFoundException("Payment not found");
            case 503 -> new RetryableException(503, "Payment service unavailable",
                             Request.HttpMethod.POST, null, null);
            default  -> new FeignException.InternalServerError(methodKey, null, null, null);
        };
    }

    // Log request/response in dev for debugging (FULL: headers + body)
    @Bean
    public feign.Logger.Level feignLogLevel() {
        return feign.Logger.Level.FULL;  // change to NONE in production
    }
}

// Step 3: Fallback factory — per-method fallback, aware of the cause
@Component
public class PaymentClientFallbackFactory implements FallbackFactory<PaymentClient> {
    @Override
    public PaymentClient create(Throwable cause) {
        return new PaymentClient() {
            @Override
            public PaymentResponse charge(ChargeRequest request) {
                log.error("Payment charge failed: {}", cause.getMessage());
                return PaymentResponse.queued(request.getOrderId());  // degrade: queue for retry
            }
            @Override
            public PaymentResponse getPayment(String paymentId) {
                return PaymentResponse.unknown(paymentId);            // return placeholder
            }
            @Override
            public RefundResponse refund(String paymentId, RefundRequest request) {
                throw new PaymentServiceUnavailableException("Refund service unavailable");
            }
        };
    }
}

// Step 4: Global RequestInterceptor — propagate JWT and correlation ID to all Feign calls
@Bean
public RequestInterceptor authAndTracingInterceptor() {
    return template -> {
        // Propagate JWT from current security context
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getCredentials() != null) {
            template.header("Authorization", "Bearer " + auth.getCredentials().toString());
        }
        // Propagate distributed trace ID (from MDC set by incoming request)
        String traceId = MDC.get("traceId");
        if (traceId != null) template.header("X-Trace-Id", traceId);
        template.header("X-Source-Service", "order-service");
    };
}
```

## Ứng Dụng Thực Tế

Luôn định nghĩa cấu hình timeout cho Feign client (<code>connectTimeout</code>, <code>readTimeout</code>) — mặc định không có timeout nghĩa là downstream chậm có thể giữ thread vô thời hạn. Kết hợp với Resilience4j <code>@CircuitBreaker</code>.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Feign Client khác RestTemplate thế nào?</strong></summary>

**A:** RestTemplate: imperative, URL building thủ công, verbose. Feign: declarative — define interface với annotation, Feign generate implementation. `@FeignClient(name="payment-service")` + `@PostMapping("/payments")` → Feign tự handle serialization, HTTP call, error handling. Integrate với Spring Cloud LoadBalancer (client-side LB) và Circuit Breaker. Feign là preferred trong Spring Cloud microservices. RestTemplate deprecated trong Spring 5 (dùng WebClient cho reactive hoặc RestClient/Feign cho synchronous).

</details>

<details>
<summary><strong>Handle error với Feign Client thế nào?</strong></summary>

**A:** (1) **ErrorDecoder**: custom decode HTTP error response → throw specific exception. `@Bean ErrorDecoder errorDecoder() { return (methodKey, response) -> new PaymentException(...); }`. (2) **Fallback**: `@FeignClient(fallback = PaymentFallback.class)` — implement interface với fallback method khi service down. (3) **FallbackFactory**: `fallbackFactory` cho phép access Throwable để log reason. (4) **Retry**: `@Retryable` hoặc Feign Retryer. Combine với `@CircuitBreaker` để stop retry khi circuit open.

</details>
