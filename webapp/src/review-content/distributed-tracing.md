---
key: distributed-tracing
title: Distributed Tracing
crumb: 19. Observability > Tracing
---

Distributed tracing theo dõi một request khi nó đi qua nhiều service — mỗi service tạo **span** riêng, tất cả span thuộc cùng **trace** để visualize toàn bộ request journey.

## Điểm Chính

- **Trace**: toàn bộ hành trình của một request từ đầu đến cuối, gồm root span và tất cả child span; mỗi trace có `traceId` duy nhất
- **Span**: đơn vị công việc nhỏ nhất — có start time, end time, attributes (metadata), và events; span có thể có child span để model nested operation
- **W3C Trace Context**: chuẩn `traceparent` header (`version-traceId-spanId-flags`) để propagate trace/span ID qua HTTP call giữa các service
- **OpenTelemetry (OTel)**: vendor-neutral SDK cho traces, metrics, logs — code một lần, export sang nhiều backend (Jaeger, Tempo, Zipkin, Datadog) qua OTLP exporter
- **Auto-instrumentation**: agent-based (Java agent inject bytecode) — zero code change, tự động trace HTTP, DB, Kafka; manual instrumentation dùng OTel SDK API cho business logic
- **Head-based sampling**: quyết định sample hay không tại root span (đầu trace) — đơn giản, low overhead, nhưng có thể miss important trace nếu error xảy ra ở cuối
- **Tail-based sampling**: quyết định sample sau khi toàn bộ trace hoàn thành (ở collector) — có thể giữ 100% error trace và sample normal trace — phức tạp hơn, cần buffer
- **Key use cases**: tìm service nào gây latency, trace slow DB query, debug cascade failure, visualize service dependency graph

## Ví Dụ Code

*Kotlin Spring Boot — OTel auto-instrumentation config và manual span creation cho business operation quan trọng.*

```kotlin
// build.gradle.kts — OpenTelemetry dependencies
// implementation("io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter")
// implementation("io.opentelemetry:opentelemetry-exporter-otlp")

// application.yml — OTel configuration
// otel:
//   service-name: order-service
//   exporter:
//     otlp:
//       endpoint: http://otel-collector:4318
//   traces:
//     sampler: parentbased_traceidratio
//     sampler-arg: "0.1"   # sample 10% of traces

@Service
class OrderService(
    private val openTelemetry: OpenTelemetry,
    private val inventoryClient: InventoryClient,
    private val paymentClient: PaymentClient
) {
    private val tracer = openTelemetry.getTracer("order-service", "1.0.0")

    fun placeOrder(request: PlaceOrderRequest): Order {
        // Manual span for critical business operation
        val span = tracer.spanBuilder("order.place")
            .setAttribute("order.customer_id", request.customerId)
            .setAttribute("order.item_count", request.items.size.toLong())
            .setAttribute("order.total_amount", request.totalAmount)
            .startSpan()

        return span.makeCurrent().use { _ ->
            try {
                // Child spans automatically created by auto-instrumented HTTP clients
                val inventoryCheck = inventoryClient.checkAvailability(request.items)
                if (!inventoryCheck.allAvailable) {
                    span.setStatus(StatusCode.ERROR, "Insufficient inventory")
                    span.setAttribute("order.failure_reason", "inventory")
                    throw InsufficientInventoryException(inventoryCheck.unavailableItems)
                }

                // Manual nested span for payment — add more detail
                val paymentSpan = tracer.spanBuilder("payment.process")
                    .setAttribute("payment.method", request.paymentMethod)
                    .setAttribute("payment.amount", request.totalAmount)
                    .startSpan()

                val payment = paymentSpan.makeCurrent().use {
                    try {
                        paymentClient.charge(request.customerId, request.totalAmount).also {
                            paymentSpan.setAttribute("payment.transaction_id", it.transactionId)
                            paymentSpan.setStatus(StatusCode.OK)
                        }
                    } catch (e: PaymentDeclinedException) {
                        paymentSpan.recordException(e)
                        paymentSpan.setStatus(StatusCode.ERROR, "Payment declined")
                        throw e
                    } finally {
                        paymentSpan.end()
                    }
                }

                val order = Order(
                    id = UUID.randomUUID().toString(),
                    customerId = request.customerId,
                    paymentId = payment.transactionId,
                    status = OrderStatus.CONFIRMED
                )

                span.setAttribute("order.id", order.id)
                span.setStatus(StatusCode.OK)
                order

            } catch (e: Exception) {
                span.recordException(e)
                span.setStatus(StatusCode.ERROR, e.message ?: "Unknown error")
                throw e
            } finally {
                span.end()
            }
        }
    }
}

// Trace propagation is automatic with OTel instrumented HTTP clients
// traceparent: 00-{traceId}-{spanId}-01 is added to every outbound request
// Downstream services auto-extract and continue the trace
```

## Ứng Dụng Thực Tế

Distributed tracing là công cụ thiết yếu khi debug latency issue trong hệ thống microservices — thay vì phải đoán service nào chậm, engineer có thể mở Jaeger hay Grafana Tempo, search theo traceId từ error log, và thấy waterfall diagram toàn bộ request với thời gian từng span. Một use case phổ biến là phát hiện N+1 DB query — trace sẽ hiển thị hàng chục span DB với latency nhỏ nhưng tổng cộng lại chiếm 80% request time. OTel auto-instrumentation với Java agent là lựa chọn phổ biến nhất vì không cần thay đổi code và tự động instrument JDBC, HTTP client, Kafka.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Trace và Span có relationship như thế nào?</strong></summary>

**A:** Một trace đại diện cho toàn bộ lifecycle của một request trong hệ thống, gồm nhiều span liên kết với nhau theo quan hệ cha-con. Root span là span đầu tiên được tạo (thường tại API gateway hoặc entry service), các service downstream tạo child span kế thừa traceId từ root. Mỗi span chứa: spanId riêng, parentSpanId tham chiếu đến span cha, traceId chung cho toàn trace, tên operation, start/end timestamp, attributes (key-value metadata), và events (timestamped log trong span). Khi visualize, tất cả span có cùng traceId được sắp xếp thành waterfall diagram theo thứ tự thời gian và quan hệ cha-con — cho thấy exactly mỗi service mất bao lâu và gọi service nào tiếp theo.

</details>

<details>
<summary><strong>Head-based sampling vs tail-based sampling — trade-offs là gì?</strong></summary>

**A:** Head-based sampling quyết định sample hay drop tại root span — đơn giản, không cần buffer, low overhead. Nhược điểm là quyết định được đưa ra khi chưa biết trace có error hay latency cao không — một error trace quan trọng có thể bị drop nếu rơi vào 90% không được sample. Tail-based sampling quyết định sau khi toàn bộ trace hoàn thành — collector buffer tất cả span, khi trace complete thì evaluate: nếu có error hay latency > threshold thì giữ, còn lại sample theo tỉ lệ thấp. Kết quả là giữ được 100% error trace trong khi vẫn reduce volume tổng. Nhược điểm là cần memory buffer lớn ở collector (toàn bộ in-flight trace), tăng complexity infrastructure. Trong thực tế, nhiều hệ thống dùng hybrid: head-based 10% + force-sample khi có error header.

</details>

<details>
<summary><strong>OpenTelemetry khác Jaeger và Zipkin như thế nào?</strong></summary>

**A:** OpenTelemetry là SDK và specification layer — cung cấp API để instrument code, collect signal (traces, metrics, logs), và export qua OTLP protocol. OTel không lưu hay visualize data. Jaeger và Zipkin là storage và visualization backend — nhận trace data, lưu vào storage (Elasticsearch, Cassandra), và cung cấp UI để search và visualize trace. Trước khi có OTel, phải dùng Jaeger client hay Zipkin client riêng — migrate backend đồng nghĩa với thay đổi code. Với OTel, code chỉ depend vào OTel API; chỉ thay OTLP exporter config để đổi backend từ Jaeger sang Tempo hay Datadog mà không thay code. Đây là lý do OTel trở thành standard de facto — vendor neutral, single API, multiple backends.

</details>
