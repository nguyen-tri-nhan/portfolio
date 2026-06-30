---
key: "Service Discovery"
title: "Service Discovery"
crumb: "5. Microservices"
---

Service discovery cho phép microservice tìm nhau một cách động bằng tên thay vì IP cứng, thiết yếu trong môi trường container nơi instance thường xuyên xuất hiện và biến mất.

## Điểm Chính

- <strong>Client-side discovery</strong>: client truy vấn registry (Eureka), chọn instance, gọi trực tiếp.
- <strong>Server-side discovery</strong>: client gọi load balancer (AWS ALB, Kubernetes Service), load balancer truy vấn registry.
- Self-registration: service đăng ký khi khởi động, hủy đăng ký khi tắt (hoặc qua health check).
- Health check: registry loại bỏ instance không healthy.
- Kubernetes: service discovery tích hợp qua DNS — <code>http://order-service:8080</code> route đến pod.

## Ví Dụ Code

*Client-side vs server-side discovery + Eureka config + @LoadBalanced WebClient*

```java
// ✅ How Service Discovery works — two patterns

// Pattern 1: Client-side discovery (Eureka / Spring Cloud LoadBalancer)
// 1. order-service starts → registers itself in Eureka registry
// 2. Client (payment-service) fetches the registry → gets list of order-service instances
// 3. Spring Cloud LoadBalancer picks one instance (round-robin by default)
// 4. Client calls the chosen instance directly

// Pattern 2: Server-side discovery (Kubernetes Service / AWS ALB)
// 1. Client calls stable DNS name (e.g., order-service.default.svc.cluster.local)
// 2. K8s kube-proxy / ALB queries the registry and routes to a healthy pod
// 3. Client has no knowledge of individual instances

// ✅ Spring Cloud Eureka setup (non-K8s environment)

// order-service: application.yml
spring:
  application:
    name: order-service          # this name is the service identifier in the registry
eureka:
  client:
    service-url:
      defaultZone: http://eureka-server:8761/eureka/
    fetch-registry: true         # download registry from Eureka (for client-side LB)
    register-with-eureka: true   # register self so others can find us
  instance:
    prefer-ip-address: true      # register IP not hostname (avoids DNS issues in Docker)
    lease-renewal-interval-in-seconds: 10   # heartbeat every 10s
    lease-expiration-duration-in-seconds: 30  # remove if no heartbeat for 30s

// ✅ Calling another service by logical name (Spring Cloud LoadBalancer)
@Configuration
public class WebClientConfig {
    @Bean
    @LoadBalanced                          // intercepts calls to http://service-name/...
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }
}

@Service
public class OrderService {
    private final WebClient webClient;

    public OrderService(WebClient.Builder builder) {
        this.webClient = builder.baseUrl("http://user-service").build();
        // "user-service" resolves via Eureka registry → actual IP:port chosen by LoadBalancer
    }

    public Mono<User> getUser(Long userId) {
        return webClient.get()
                        .uri("/api/users/{id}", userId)
                        .retrieve()
                        .bodyToMono(User.class);
        // If user-service has 3 instances, LoadBalancer rotates through them (round-robin)
    }
}
```

## Ứng Dụng Thực Tế

Trong Kubernetes, bỏ qua Eureka — dùng Kubernetes Services cho discovery và Spring Cloud Kubernetes cho config. Eureka hữu ích hơn trong môi trường non-K8s. Với dự án mới, dùng Consul xử lý cả secret và tích hợp service mesh.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa client-side và server-side service discovery là gì?
1. Eureka xử lý khi một service instance bị down thế nào?
1. Kubernetes service discovery hoạt động thế nào?
