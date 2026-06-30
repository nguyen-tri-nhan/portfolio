---
key: "Actuator"
title: "Spring Boot Actuator"
crumb: "3. Spring Ecosystem › Spring Boot"
---

Actuator expose các operational endpoint cho health check, metrics, thông tin môi trường, thread dump và nhiều hơn — thiết yếu cho production monitoring và readiness/liveness probe.

## Điểm Chính

- Thêm <code>spring-boot-starter-actuator</code>; endpoint có sẵn tại <code>/actuator/*</code>.
- Endpoint chính: <code>/actuator/health</code>, <code>/actuator/metrics</code>, <code>/actuator/info</code>, <code>/actuator/env</code>, <code>/actuator/threaddump</code>.
- Kubernetes: map <code>/actuator/health/liveness</code> và <code>/actuator/health/readiness</code> vào probe.
- Bảo mật theo mặc định — expose có chọn lọc: <code>management.endpoints.web.exposure.include=health,info,metrics</code>.
- Custom health indicator: implement <code>HealthIndicator</code> để thêm check (DB, external service, cache).

## Ví Dụ Code

*Actuator: custom HealthIndicator (Stripe gateway), InfoContributor, Micrometer business metrics (Counter/Timer), K8s probes YAML*

```java
import org.springframework.boot.actuate.health.*;
import org.springframework.boot.actuate.info.*;
import io.micrometer.core.instrument.*;
import org.springframework.stereotype.*;

// ---- 1. Custom HealthIndicator — adds to /actuator/health ----
// Use for: external API, message broker, payment gateway, cache connectivity
@Component
public class PaymentGatewayHealthIndicator implements HealthIndicator {

    private final PaymentGatewayClient paymentClient;

    public PaymentGatewayHealthIndicator(PaymentGatewayClient paymentClient) {
        this.paymentClient = paymentClient;
    }

    @Override
    public Health health() {
        try {
            // Lightweight ping — must complete quickly (health check timeout is typically 1–2s)
            PaymentGatewayStatus status = paymentClient.ping();
            return Health.up()
                .withDetail("gateway",       "Stripe")
                .withDetail("latencyMs",     status.getLatencyMs())
                .withDetail("environment",   status.getEnvironment())
                .build();
        } catch (PaymentGatewayException e) {
            // DOWN signals Kubernetes readiness probe to stop routing traffic here
            return Health.down()
                .withDetail("gateway", "Stripe")
                .withDetail("error",   e.getMessage())
                .withDetail("code",    e.getErrorCode())
                .build();
        }
    }
}
// GET /actuator/health returns:
// { "status": "UP", "components": { "paymentGateway": { "status": "UP", "details": {...} } } }

// ---- 2. Custom InfoContributor — adds to /actuator/info ----
@Component
public class OrderServiceInfoContributor implements InfoContributor {
    @Override
    public void contribute(Info.Builder builder) {
        builder.withDetail("service", Map.of(
            "name",    "order-service",
            "version", "2.4.1",
            "team",    "Platform Engineering"
        ));
    }
}

// ---- 3. Custom Micrometer metrics — expose business KPIs ----
@Service
public class OrderMetricsService {
    private final Counter ordersPlaced;
    private final Counter ordersFailed;
    private final Timer   orderProcessingTime;

    public OrderMetricsService(MeterRegistry meterRegistry) {
        // Counters increment; timers record duration distribution
        this.ordersPlaced = Counter.builder("orders.placed")
            .description("Total orders successfully placed")
            .tag("service", "order")
            .register(meterRegistry);

        this.ordersFailed = Counter.builder("orders.failed")
            .description("Total order placement failures")
            .tag("service", "order")
            .register(meterRegistry);

        this.orderProcessingTime = Timer.builder("order.processing.duration")
            .description("Time to complete order processing")
            .publishPercentiles(0.5, 0.95, 0.99)   // p50, p95, p99 latency
            .register(meterRegistry);
    }

    public Order placeOrder(CreateOrderRequest req) {
        return orderProcessingTime.record(() -> {
            try {
                Order order = doPlaceOrder(req);
                ordersPlaced.increment();
                return order;
            } catch (Exception e) {
                ordersFailed.increment(Tags.of("reason", e.getClass().getSimpleName()));
                throw e;
            }
        });
    }
}

// ---- application.yml: Actuator configuration ----
/*
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus  # only expose what's needed
        # NEVER expose: env, beans, heapdump in prod (security risk)
  endpoint:
    health:
      show-details: when-authorized  # hide internals from unauthenticated callers
      probes:
        enabled: true               # /actuator/health/liveness + /actuator/health/readiness
  health:
    livenessstate:
      enabled: true
    readinessstate:
      enabled: true

# Kubernetes probe config (in deployment.yaml):
# livenessProbe:  httpGet: /actuator/health/liveness  -- restart if process is hung
# readinessProbe: httpGet: /actuator/health/readiness -- stop traffic if not ready
*/
```

## Ứng Dụng Thực Tế

Tích hợp Actuator với Prometheus: thêm dependency <code>micrometer-registry-prometheus</code> và expose <code>/actuator/prometheus</code>. Grafana dashboard sau đó tự động visualize JVM metric, HTTP request rate và custom business metric.

## Câu Hỏi Phỏng Vấn

1. Spring Boot Actuator expose endpoint nào theo mặc định?
1. Làm thế nào để tạo custom health indicator?
1. Làm thế nào để bảo mật các Actuator endpoint?
