---
key: "Distributed Tracing"
title: "Distributed Tracing"
crumb: "8. Cloud & DevOps › Monitoring"
---

Distributed tracing theo dõi request qua nhiều microservice bằng cách truyền trace context, cho phép phân tích nguyên nhân gốc của latency và lỗi trong service graph phức tạp.

## Điểm Chính

- <strong>Trace</strong>: toàn bộ hành trình request. <strong>Span</strong>: một thao tác (HTTP call, DB query). Span có quan hệ parent-child.
- Trace context được truyền qua HTTP header: <code>traceparent</code> (chuẩn W3C), hoặc <code>X-B3-TraceId</code> (Zipkin).
- Tool: Jaeger, Zipkin, AWS X-Ray, OpenTelemetry (protocol chuẩn).
- Spring: Micrometer Tracing (thay thế Sleuth trong Boot 3). Auto-instrument HTTP và Kafka.
- Sampling: đừng trace 100% — dùng probabilistic (1-10%) hoặc adaptive sampling.

## Ví Dụ Code

*Micrometer Tracing với Zipkin và manual span*

```bash
# Spring Boot 3 + Micrometer Tracing + Zipkin
# pom.xml:
# spring-boot-starter-actuator
# micrometer-tracing-bridge-brave
# zipkin-reporter-brave

# application.yml
management:
  tracing:
    sampling:
      probability: 0.1  # trace 10% of requests

# Auto-instrumented: RestTemplate, WebClient, @Async, Kafka
# Manual span:
@Autowired Tracer tracer;
Span span = tracer.nextSpan().name("db-query").start();
try (Tracer.SpanInScope ws = tracer.withSpan(span.start())) {
    return repo.findAll();
} catch(Exception e){
    span.error(e); throw e;
} finally { span.end(); }
```

## Ứng Dụng Thực Tế

Thêm tracing trước khi cần — sau incident thì quá muộn. Sample ở 1-10% trong production để kiểm soát chi phí storage. Dùng trace ID trong log (MDC) để bạn có thể correlate trace ID từ Jaeger với log line trong Loki/Elasticsearch.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa trace và span là gì?</strong></summary>

**A:** **Trace**: toàn bộ hành trình của một request qua nhiều service — identified bởi `traceId`. **Span**: một unit of work trong trace — một RPC call, một DB query, một function call. Mỗi span có `spanId`, `parentSpanId`, timestamp, duration, và tags. Trace là cây span: root span (incoming request) → child spans (downstream call, DB query). Jaeger/Zipkin visualize trace như waterfall diagram.

</details>

<details>
<summary><strong>Trace context được truyền qua HTTP boundary thế nào?</strong></summary>

**A:** Dùng **HTTP headers** để propagate context: W3C standard: `traceparent: 00-<traceId>-<spanId>-01`. B3 format (Zipkin): `X-B3-TraceId`, `X-B3-SpanId`, `X-B3-ParentSpanId`. Spring Cloud Sleuth/Micrometer Tracing tự động inject headers vào outgoing request (RestTemplate, WebClient, Feign) và extract từ incoming. Service nhận request extract context → tạo child span với parentSpanId = received spanId.

</details>

<details>
<summary><strong>Sampling là gì và tại sao 100% sampling problematic trong production?</strong></summary>

**A:** **Sampling**: chỉ collect trace cho một phần requests thay vì tất cả. 100% sampling problematic: (1) **Storage cost**: mỗi trace có hàng chục span × metadata → hàng TB/ngày với high traffic. (2) **Performance overhead**: serialization, network call đến tracing backend trên mỗi request. Strategies: **Head-based** (quyết định sample khi request bắt đầu, ví dụ 1%); **Tail-based** (quyết định sau khi request hoàn thành — có thể sample 100% lỗi + 1% thành công). Jaeger/Tempo support adaptive sampling.

</details>

## Sơ Đồ Distributed Tracing

```mermaid
flowchart LR
    Client["Client"] -->|"TraceId=abc123"| GW["API Gateway\nSpanId=s1"]
    GW -->|"TraceId=abc123\nParentSpanId=s1\nSpanId=s2"| Order["Order Service"]
    Order -->|"TraceId=abc123\nSpanId=s3"| Payment["Payment Service"]
    Order -->|"TraceId=abc123\nSpanId=s4"| Inventory["Inventory Service"]
    Order -->|"TraceId=abc123\nSpanId=s5"| DB["Database"]

    subgraph Collect["Telemetry Collection"]
        Each["Each service exports spans"] --> Collector["OpenTelemetry Collector"]
        Collector --> Jaeger["Jaeger / Zipkin\n(trace visualization)"]
        Collector --> Tempo["Grafana Tempo\n(correlate logs + traces)"]
    end
```
