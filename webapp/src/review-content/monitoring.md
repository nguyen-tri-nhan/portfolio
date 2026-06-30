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

1. Ba trụ cột của observability là gì?
1. Bốn Golden Signal của Google là gì?
1. Micrometer tích hợp với Prometheus thế nào?
