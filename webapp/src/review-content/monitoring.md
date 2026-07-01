---
key: "Monitoring"
title: "Monitoring & Observability"
crumb: "8. Cloud & DevOps"
---

Observability cung cấp insight vào distributed system qua ba trụ cột: Metric (cái gì), Log (tại sao) và Trace (ở đâu) — cho phép phát hiện incident nhanh và phân tích nguyên nhân gốc.

## Điểm Chính

- <strong>Metric</strong>: số time-series (request rate, error rate, latency, saturation). Tool: Prometheus + Grafana.
- <strong>Log</strong>: bản ghi event với context. Structured JSON log. Tool: ELK Stack, Loki + Grafana.
- <strong>Trace</strong>: đường dẫn request end-to-end qua service. Tool: Jaeger, Zipkin, AWS X-Ray.
- Golden Signal (Google SRE): Latency, Traffic, Error, Saturation (LTES).
- SLI/SLO/SLA: định nghĩa mục tiêu chất lượng service có thể đo lường và cảnh báo trước khi vi phạm SLO.

## Ví Dụ Code

*Micrometer custom business metric*

```java
// Spring Boot + Micrometer + Prometheus
@Bean
MeterRegistryCustomizer<PrometheusMeterRegistry> metricsConfig(){
    return r -> r.config().commonTags("service","order-service","env","prod");
}

// Custom business metrics
@Autowired MeterRegistry registry;
void processOrder(Order o){
    registry.counter("orders.processed",
        "status", o.getStatus(),
        "region", o.getRegion()
    ).increment();

    registry.timer("order.processing.time")
        .record(Duration.ofMillis(processingTime));
}

// Exposed at: GET /actuator/prometheus
// Scraped by Prometheus every 15s
```

## Ứng Dụng Thực Tế

Bắt đầu với phương pháp RED: Request Rate, Error Rate, Duration. Thêm business metric (order/phút, payment success rate) bên cạnh technical metric. Đặt SLO (ví dụ latency p99 < 500ms, error rate < 0.1%) và cảnh báo trước khi vi phạm.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Ba trụ cột của observability là gì?</strong></summary>

**A:** (1) **Metrics**: số đo định lượng theo thời gian — RPS, latency p99, error rate, CPU, memory. Prometheus + Grafana. Câu hỏi: "Hệ thống đang hoạt động thế nào?" (2) **Logs**: sự kiện text có timestamp và context — request log, error log, audit. ELK stack, Loki. Câu hỏi: "Chuyện gì đã xảy ra?" (3) **Traces**: theo dõi request qua nhiều service — thấy latency của từng step. Jaeger, Zipkin, Tempo. Câu hỏi: "Chậm ở đâu?" Ba trụ cột bổ sung nhau: metrics alert, logs explain, traces locate.

</details>

<details>
<summary><strong>Bốn Golden Signal của Google là gì?</strong></summary>

**A:** (1) **Latency**: thời gian xử lý request — cả thành công lẫn lỗi. (2) **Traffic**: load của hệ thống — RPS, message/s. (3) **Errors**: tỷ lệ request fail — 5xx rate, exception rate. (4) **Saturation**: mức độ "đầy" của resource — CPU%, memory%, thread pool queue depth, disk I/O. Nếu chỉ monitor 4 metric này, bạn đã có coverage tốt cho hầu hết incident. Dashboard chuẩn: latency histogram (p50/p95/p99), error rate %, RPS, CPU/memory.

</details>

<details>
<summary><strong>Micrometer tích hợp với Prometheus thế nào?</strong></summary>

**A:** Micrometer là **metrics facade** — abstract layer giống SLF4J cho logging. Spring Boot Actuator dùng Micrometer để collect metrics. Thêm `micrometer-registry-prometheus` dependency → Micrometer export metrics theo format Prometheus. Endpoint `/actuator/prometheus` expose tất cả metrics dạng text. Prometheus cấu hình scrape endpoint này theo interval (15s). Grafana query Prometheus để visualize. Custom metric: `Counter.builder("order.created").tag("status", "success").register(meterRegistry).increment()`.

</details>
