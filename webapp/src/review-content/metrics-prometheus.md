---
key: metrics-prometheus
title: Metrics & Prometheus
crumb: 19. Observability > Metrics
---

Metrics là các số đo numeric theo thời gian — khác log (discrete event) và trace (request flow) — dùng để monitor health, set alert, và phân tích trend của hệ thống.

## Điểm Chính

- **4 metric types Prometheus**: **Counter** (chỉ tăng, không giảm — total requests), **Gauge** (tăng/giảm — active connections, memory), **Histogram** (phân phối giá trị theo bucket — request latency), **Summary** (quantile được tính phía client)
- **RED method** cho services: **R**ate (requests/second), **E**rror rate (% requests thất bại), **D**uration (latency p50/p95/p99) — 3 signal quan trọng nhất để monitor user-facing service
- **USE method** cho resources: **U**tilization (% tài nguyên đang dùng), **S**aturation (queue length, wait time), **E**rrors — dùng cho CPU, memory, disk, network
- **Prometheus pull model**: Prometheus server chủ động scrape `/actuator/prometheus` endpoint của từng service theo interval (default 15s) — khác với push model
- **Micrometer**: abstraction layer cho Java/Kotlin — viết code với Micrometer API, export ra Prometheus, Datadog, CloudWatch mà không thay đổi code
- **PromQL**: query language của Prometheus — `rate()` tính rate trong window, `histogram_quantile()` tính percentile từ histogram bucket, `increase()` tính tổng tăng trong window
- **Alertmanager**: Prometheus Alertmanager nhận alert từ Prometheus rules → route đến PagerDuty, Slack, email theo severity và schedule
- **Cardinality**: số lượng unique label value combination — high cardinality labels (userId, requestId) có thể gây OOM cho Prometheus, cần tránh

## Ví Dụ Code

*Kotlin Spring Boot — custom Counter và Histogram cho business metrics bên cạnh auto-instrumented HTTP metrics.*

```kotlin
@Service
class OrderMetricsService(private val meterRegistry: MeterRegistry) {

    // Counter: monotonically increasing — total orders by status
    private val ordersProcessed = Counter.builder("orders.processed.total")
        .description("Total number of orders processed")
        .tag("service", "order-service")
        .register(meterRegistry)

    private fun ordersFailedCounter(reason: String) = Counter.builder("orders.failed.total")
        .description("Total number of failed orders")
        .tag("reason", reason)
        .register(meterRegistry)

    // Histogram: measure distribution of payment processing duration
    private val paymentDuration = Timer.builder("payment.processing.duration")
        .description("Payment processing duration in seconds")
        .serviceLevelObjectives(
            Duration.ofMillis(100),
            Duration.ofMillis(500),
            Duration.ofSeconds(1),
            Duration.ofSeconds(5)
        )
        .register(meterRegistry)

    // Gauge: current value — active orders being processed
    private val activeOrders = AtomicInteger(0).also { gauge ->
        Gauge.builder("orders.active", gauge) { it.get().toDouble() }
            .description("Number of orders currently being processed")
            .register(meterRegistry)
    }

    fun processOrder(order: Order): Order {
        activeOrders.incrementAndGet()

        return try {
            paymentDuration.recordCallable {
                // Business logic here
                val result = doProcessOrder(order)
                ordersProcessed.increment()
                result
            }!!
        } catch (e: PaymentDeclinedException) {
            ordersFailedCounter("payment_declined").increment()
            throw e
        } catch (e: Exception) {
            ordersFailedCounter("unexpected_error").increment()
            throw e
        } finally {
            activeOrders.decrementAndGet()
        }
    }
}

// application.yml — expose Prometheus endpoint
// management:
//   endpoints:
//     web:
//       exposure:
//         include: prometheus,health,info
//   metrics:
//     export:
//       prometheus:
//         enabled: true

// PromQL examples:
// Rate of successful orders per second (5m window):
//   rate(orders_processed_total[5m])
//
// 95th percentile payment duration:
//   histogram_quantile(0.95, rate(payment_processing_duration_bucket[5m]))
//
// Error rate percentage:
//   rate(orders_failed_total[5m]) / rate(orders_processed_total[5m]) * 100
//
// Prometheus alert rule:
// - alert: HighOrderFailureRate
//   expr: rate(orders_failed_total[5m]) / rate(orders_processed_total[5m]) > 0.05
//   for: 2m
//   labels:
//     severity: critical
//   annotations:
//     summary: "Order failure rate above 5%"
```

## Ứng Dụng Thực Tế

Prometheus + Grafana là stack monitoring tiêu chuẩn cho Kubernetes-based microservices — Spring Boot Actuator tự động expose JVM metrics, HTTP request metrics, và connection pool metrics qua Micrometer mà không cần code thêm. Business metrics như order conversion rate, payment success rate, hay checkout abandonment rate được custom và visualize trên Grafana dashboard để team product có thể monitor real-time. Alert rule được set để notify on-call engineer khi error rate vượt ngưỡng hoặc p99 latency tăng đột biến.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Counter vs Gauge vs Histogram — khi nào dùng loại nào?</strong></summary>

**A:** Counter dùng cho giá trị chỉ tăng và không bao giờ reset (trừ restart) — tổng số request, tổng số error, tổng số order. Query thường dùng `rate()` hay `increase()` để tính tốc độ tăng trong window. Gauge dùng cho giá trị có thể tăng hoặc giảm — số active connection, memory usage hiện tại, số item trong queue. Histogram dùng khi cần biết phân phối của giá trị — latency p50, p95, p99; giá trị được phân vào các bucket (< 100ms, < 500ms, < 1s). Histogram tốn storage hơn Counter/Gauge nhưng là lựa chọn bắt buộc khi cần SLO latency. Summary tương tự Histogram nhưng quantile được tính phía client — ít flexible hơn vì không aggregate được trên Prometheus server.

</details>

<details>
<summary><strong>RED method là gì và tại sao nó quan trọng?</strong></summary>

**A:** RED (Rate, Error, Duration) là phương pháp được Tom Wilkie đề xuất để monitor user-facing service, tập trung vào 3 signal quan trọng nhất từ góc nhìn user. Rate là số request mỗi giây — cho biết traffic load và phát hiện traffic spike. Error rate là % request bị lỗi — chỉ số trực tiếp về service health từ góc nhìn user. Duration là latency distribution (p50, p95, p99) — cho biết user experience thực tế. Ba metric này đủ để phát hiện hầu hết production incident: traffic tăng đột ngột, error spike, hay latency degradation. RED method bổ sung cho USE method — USE tập trung vào resource health (CPU, memory), RED tập trung vào service quality.

</details>

<details>
<summary><strong>histogram_quantile() dùng thế nào và cần lưu ý gì?</strong></summary>

**A:** `histogram_quantile(φ, metric_bucket)` tính approximate quantile từ histogram bucket data. Ví dụ `histogram_quantile(0.95, rate(http_request_duration_bucket[5m]))` tính p95 latency trong 5 phút qua. Cần kết hợp với `rate()` trên `_bucket` metric để normalize theo thời gian. Lưu ý quan trọng: bucket boundaries phải được định nghĩa trước khi record data — nếu bucket quá thưa (ví dụ chỉ có < 1s và < 10s), quantile tính sẽ rất kém chính xác. Nên define bucket theo SLO của service — ví dụ service có SLO < 200ms thì cần bucket 50ms, 100ms, 150ms, 200ms, 500ms. Nếu dùng Spring Boot Micrometer, dùng `serviceLevelObjectives()` để set bucket tự động.

</details>
