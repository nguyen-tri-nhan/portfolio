---
key: structured-logging
title: Structured Logging
crumb: 19. Observability > Logging
---

Structured logging ghi log dưới dạng JSON machine-parseable thay vì plain text — cho phép query, filter, và aggregate log hiệu quả trên hệ thống tập trung như ELK hoặc Loki.

## Điểm Chính

- **JSON format**: mỗi log line là một JSON object với các field cố định — `timestamp`, `level`, `message`, `service`, `traceId`, `spanId`, `userId`, `requestId`, `duration`
- **Correlation ID / Trace ID**: ID duy nhất được propagate qua tất cả service call trong một request — giúp tìm toàn bộ log liên quan đến một request trên nhiều service
- **MDC (Mapped Diagnostic Context)**: thread-local map trong Java/Kotlin tự động inject context (traceId, userId) vào mọi log line trong request — không cần pass thủ công
- **Log levels**: TRACE < DEBUG < INFO < WARN < ERROR; production nên set minimum INFO, chỉ ERROR cho các alert cần action ngay
- **Không log sensitive data**: passwords, token, credit card number, PII tuyệt đối không được xuất hiện trong log — dùng masking hoặc hashing nếu cần reference
- **Centralized logging**: ELK Stack (Elasticsearch + Logstash + Kibana) hoặc Loki + Grafana — index theo traceId/userId để query nhanh
- **Log sampling**: với high-throughput service, sample DEBUG log (ví dụ 10%) thay vì log 100% để tránh quá tải storage
- **Contextual fields**: thêm business context vào log — `orderId`, `paymentMethod`, `productCategory` — giúp debug nghiệp vụ nhanh hơn

## Ví Dụ Code

*Kotlin Spring Boot với Logback JSON encoder, MDC tự động inject traceId/userId vào mọi log line.*

```kotlin
// MDC Filter — inject context for every request
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class MdcContextFilter : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        try {
            // Extract or generate trace ID (W3C traceparent or custom header)
            val traceId = request.getHeader("X-Trace-Id")
                ?: request.getHeader("traceparent")?.extractTraceId()
                ?: UUID.randomUUID().toString()

            val requestId = UUID.randomUUID().toString()

            // MDC auto-injects these fields into every log line in this thread
            MDC.put("traceId", traceId)
            MDC.put("requestId", requestId)
            MDC.put("httpMethod", request.method)
            MDC.put("httpPath", request.requestURI)

            // Propagate traceId downstream
            response.setHeader("X-Trace-Id", traceId)

            filterChain.doFilter(request, response)
        } finally {
            MDC.clear()  // Always clear to avoid leaking between requests
        }
    }
}

// Service — structured logging with SLF4J
@Service
class OrderService(private val log: Logger = LoggerFactory.getLogger(OrderService::class.java)) {

    fun processOrder(request: PlaceOrderRequest): Order {
        // Add business context to MDC for this operation
        MDC.put("customerId", request.customerId)
        MDC.put("orderValue", request.totalAmount.toString())

        log.info("Processing order",
            kv("customerId", request.customerId),
            kv("itemCount", request.items.size),
            kv("totalAmount", request.totalAmount)
        )

        val startTime = System.currentTimeMillis()

        return try {
            val order = createOrder(request)

            log.info("Order created successfully",
                kv("orderId", order.id),
                kv("durationMs", System.currentTimeMillis() - startTime)
            )
            order
        } catch (e: InsufficientInventoryException) {
            // WARN for expected business errors
            log.warn("Order failed — insufficient inventory",
                kv("customerId", request.customerId),
                kv("productId", e.productId),
                kv("requestedQty", e.requestedQty),
                kv("availableQty", e.availableQty)
            )
            throw e
        } catch (e: Exception) {
            // ERROR for unexpected failures requiring action
            log.error("Unexpected error processing order",
                kv("customerId", request.customerId),
                e
            )
            throw e
        } finally {
            MDC.remove("customerId")
            MDC.remove("orderValue")
        }
    }
}

// logback-spring.xml — JSON output via logstash-logback-encoder
// <encoder class="net.logstash.logback.encoder.LogstashEncoder">
//   <includeCallerData>false</includeCallerData>
//   <includeMdcKeyName>traceId</includeMdcKeyName>
//   <includeMdcKeyName>requestId</includeMdcKeyName>
// </encoder>
```

## Ứng Dụng Thực Tế

Trong hệ thống microservices, structured logging kết hợp với traceId propagation cho phép engineer query toàn bộ log của một user request trải qua 5-6 service chỉ với một filter `traceId = "abc123"` trong Kibana. Khi có incident, thay vì phải SSH vào từng server đọc log file, team có thể search và correlate log từ tất cả service trong vài giây. MDC đặc biệt quan trọng trong async code — cần manually propagate MDC context sang coroutine hay thread pool vì MDC là thread-local.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao structured logging tốt hơn plain text logging?</strong></summary>

**A:** Plain text log như `"User 123 placed order for $50"` rất khó parse bằng máy — để filter, cần regex phức tạp và dễ sai khi format thay đổi. Structured logging ghi JSON với field cố định — `userId: "123"`, `action: "place_order"`, `amount: 50` — cho phép query chính xác như `userId = "123" AND amount > 100` trong Elasticsearch hay Loki. Ngoài ra, thêm field mới vào JSON không breaking existing query, trong khi thay đổi format text string có thể break tất cả parsing logic. Structured logging cũng dễ index và aggregate hơn để tạo dashboard và alert.

</details>

<details>
<summary><strong>MDC là gì và hoạt động như thế nào trong multi-threaded environment?</strong></summary>

**A:** MDC (Mapped Diagnostic Context) là thread-local map do SLF4J cung cấp — mỗi thread có một MDC map riêng. Khi Logback format log line, nó tự động đọc tất cả key-value trong MDC của thread hiện tại và thêm vào output JSON. Điều này cho phép set traceId một lần trong request filter rồi mọi log call trong request đó — dù ở service layer hay repository layer — đều tự động có traceId mà không cần pass qua parameter. Vấn đề với async code: khi spawn coroutine hay submit task vào ExecutorService, thread mới không có MDC của thread cha. Cần dùng `MDCContext` cho Kotlin coroutines hoặc `MDC.getCopyOfContextMap()` để manually copy MDC sang thread mới.

</details>

<details>
<summary><strong>Làm thế nào propagate traceId qua HTTP call giữa các service?</strong></summary>

**A:** Khi Service A gọi Service B qua HTTP, traceId phải được truyền theo qua HTTP header. Standard hiện tại là W3C Trace Context với header `traceparent` có format `version-traceId-spanId-flags`. Với Spring Boot, nếu dùng Micrometer Tracing hoặc OpenTelemetry, việc propagation được tự động hóa qua instrumented RestTemplate hay WebClient. Nếu dùng custom header như `X-Trace-Id`, cần viết ClientHttpRequestInterceptor đọc traceId từ MDC và add vào outbound request, đồng thời viết filter ở Service B đọc header đó và set vào MDC. Service B cũng cần giữ nguyên traceId thay vì tạo mới để toàn bộ flow có cùng một traceId.

</details>
