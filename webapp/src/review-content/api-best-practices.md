---
key: api-best-practices
title: API Design Best Practices
crumb: 18. API & Communication > REST & HTTP
---

API tốt cần naming nhất quán, error response chuẩn hóa, idempotency key cho POST, rate limiting rõ ràng, và backward compatibility nghiêm ngặt để client tin tưởng khi tích hợp.

## Điểm Chính

- **Naming conventions**: URI dùng noun (`/users`), không dùng verb (`/getUsers`); plural, kebab-case (`/user-profiles`), tránh động từ trong path.
- **Consistent error response**: mọi lỗi đều cùng structure — `errorCode`, `message`, `details`, `traceId` để client parse và debug dễ dàng.
- **Idempotency key**: client gửi UUID trong header (`Idempotency-Key`) cho POST request; server cache response trong thời gian ngắn, ngăn duplicate processing khi retry.
- **Rate limiting**: Token bucket (cho burst traffic) vs sliding window (chính xác hơn); trả về headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` với 429.
- **Backward compatibility**: thêm field mới là safe (additive change); xóa/đổi tên field, thay đổi type là breaking change → cần version mới.
- **Fail fast validation**: validate input ở controller layer, trả về 400 với message cụ thể; đừng để lỗi validation lan vào business/data layer.
- **CORS**: preflight `OPTIONS` request kiểm tra `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers` trước khi browser gửi request thực.

## Ví Dụ Code

*Standardized ErrorResponse + Idempotency key middleware + Rate limit headers*

```java
// ✅ Standard error response structure — consistent across all endpoints
@Getter
@Builder
public class ErrorResponse {
    private final String errorCode;     // machine-readable, e.g. "USER_NOT_FOUND"
    private final String message;       // human-readable description
    private final List<FieldError> details;  // validation errors per field
    private final String traceId;       // propagate from MDC for log correlation
    private final Instant timestamp;

    @Builder
    public record FieldError(String field, String message) {}
}

// ✅ Global exception handler — centralise error mapping
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest req) {

        List<ErrorResponse.FieldError> details = ex.getBindingResult()
                .getFieldErrors().stream()
                .map(e -> new ErrorResponse.FieldError(e.getField(), e.getDefaultMessage()))
                .toList();

        return ResponseEntity.badRequest().body(ErrorResponse.builder()
                .errorCode("VALIDATION_FAILED")
                .message("Request validation failed")
                .details(details)
                .traceId(MDC.get("traceId"))
                .timestamp(Instant.now())
                .build());
    }

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ErrorResponse> handleRateLimit(RateLimitExceededException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("X-RateLimit-Limit", String.valueOf(ex.getLimit()))
                .header("X-RateLimit-Remaining", "0")
                .header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()))
                .body(ErrorResponse.builder()
                        .errorCode("RATE_LIMIT_EXCEEDED")
                        .message("Too many requests. Retry after " + ex.getRetryAfterSeconds() + "s")
                        .traceId(MDC.get("traceId"))
                        .timestamp(Instant.now())
                        .build());
    }
}

// ✅ Idempotency key filter — prevent duplicate POST processing
@Component
@Order(1)
public class IdempotencyFilter extends OncePerRequestFilter {

    private final RedisTemplate<String, String> redis;
    private static final Duration TTL = Duration.ofHours(24);

    @Override
    protected void doFilterInternal(HttpServletRequest req,
            HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        if (!"POST".equals(req.getMethod())) { chain.doFilter(req, res); return; }

        String key = req.getHeader("Idempotency-Key");
        if (key == null) { chain.doFilter(req, res); return; }

        String cacheKey = "idempotency:" + key;
        String cached = redis.opsForValue().get(cacheKey);
        if (cached != null) {
            // Return cached response — safe replay
            res.setStatus(HttpStatus.OK.value());
            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
            res.getWriter().write(cached);
            return;
        }
        // Wrap response to capture & cache it
        ContentCachingResponseWrapper wrapped = new ContentCachingResponseWrapper(res);
        chain.doFilter(req, wrapped);
        String body = new String(wrapped.getContentAsByteArray(), StandardCharsets.UTF_8);
        redis.opsForValue().set(cacheKey, body, TTL);
        wrapped.copyBodyToResponse();
    }
}
```

## Ứng Dụng Thực Tế

Trong payment service, idempotency key là bắt buộc — network timeout không cho biết request có thành công không, client retry mà không có cơ chế này sẽ tạo duplicate charge. Rate limiting với `Retry-After` header cho phép client tự điều chỉnh thay vì flood server với exponential backoff.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Làm thế nào handle duplicate POST request trong distributed system khi client không nhận được response?</strong></summary>

**A:** Dùng idempotency key — client tạo một UUID duy nhất và gửi trong header `Idempotency-Key` với mỗi POST request. Server lưu key này cùng với response vào Redis (TTL 24 giờ). Nếu cùng key gửi lại, server trả về cached response thay vì xử lý lại. Pattern này giải quyết "exactly-once" semantics ở tầng HTTP: lần đầu tiên server xử lý và cache, các lần sau replay từ cache. Cần lưu ý: key phải unique per request intent (không phải per retry), và response cần serializable. Ngoài ra, cũng cần database-level unique constraint để bảo vệ race condition khi hai request cùng key đến đồng thời trước khi cache được set.

</details>

<details>
<summary><strong>Breaking vs non-breaking API change — phân biệt thế nào và cách xử lý breaking change?</strong></summary>

**A:** Non-breaking (additive) change là những thay đổi client cũ vẫn hoạt động được: thêm field mới vào response, thêm optional request parameter, thêm endpoint mới, mở rộng enum. Breaking change là những gì có thể phá vỡ client cũ: xóa/đổi tên field, thay đổi kiểu dữ liệu, thay đổi semantics của endpoint, thêm required field vào request. Khi cần breaking change, chiến lược đúng là tạo version mới (`/v2/`) trong khi duy trì `/v1/` với deprecation notice và sunset header (`Sunset: Sat, 31 Dec 2025 00:00:00 GMT`). Consumer-driven contract testing (như Pact) giúp phát hiện breaking change trước khi deploy. Nguyên tắc quan trọng: API là public contract — một khi đã release, phải giữ backward compatible hoặc version rõ ràng.

</details>

<details>
<summary><strong>Token bucket vs sliding window rate limiting — thuật toán nào phù hợp và khác nhau thế nào?</strong></summary>

**A:** Token bucket cho phép burst traffic: bucket có capacity N token, mỗi request tiêu một token, token được refill theo rate nhất định. Client có thể burst đến N request ngay lập tức nếu bucket đầy — phù hợp cho API cần cho phép burst ngắn. Sliding window đếm số request trong cửa sổ thời gian trượt (ví dụ: 100 request/60 giây), chính xác hơn nhưng tốn memory hơn (cần lưu timestamp từng request). Fixed window đơn giản nhất nhưng có vấn đề boundary — client có thể gửi 2x limit trong khoảng thời gian ngắn bắc qua window boundary. Trong thực tế: token bucket phổ biến hơn vì cho phép burst phù hợp với UX, Redis có `INCR` + TTL để implement fixed/sliding window, còn Nginx và nhiều API gateway dùng leaky bucket variant. Quan trọng là trả về đủ headers (Limit, Remaining, Reset) để client tự điều chỉnh.

</details>
