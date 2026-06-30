---
key: "Eureka / Consul"
title: "Eureka & Consul"
crumb: "5. Microservices › Service Discovery"
---

Eureka (Netflix) và Consul (HashiCorp) là service registry phổ biến; Eureka ưu tiên availability, Consul cung cấp health check phong phú hơn, DNS interface và key-value store.

## Điểm Chính

- <strong>Eureka</strong>: hệ thống AP (ưu tiên availability hơn consistency). Service tự đăng ký. Hỗ trợ "self-preservation mode" để tránh hủy đăng ký hàng loạt khi network partition.
- <strong>Consul</strong>: hệ thống CP theo mặc định. Health check phong phú (TCP, HTTP, script). KV store tích hợp cho config. Tích hợp service mesh (Consul Connect).
- Eureka: tích hợp Spring Cloud đơn giản hơn. Consul: nhiều tính năng hơn, phức tạp vận hành hơn.
- Cả hai hỗ trợ health monitoring dựa trên heartbeat và client-side load balancing.

## Ví Dụ Code

*Consul JSON config + Spring Cloud Consul YAML + Eureka vs Consul comparison*

```bash
# ✅ Consul service definition (consul.json — placed on each service node)
{
  "service": {
    "name": "order-service",
    "id":   "order-service-1",          // unique ID per instance (node name + port)
    "port": 8080,
    "tags": ["v2", "production"],
    "meta": { "version": "2.3.1" },     // arbitrary key-value metadata
    "check": {
      "http":     "http://localhost:8080/actuator/health",
      "interval": "10s",                // poll health endpoint every 10 seconds
      "timeout":  "5s",                 // mark critical if no response in 5s
      "deregister_critical_service_after": "60s"  // auto-deregister after 60s critical
    }
  }
}
# Consul DNS: order-service.service.consul → returns healthy instance IPs
# Consul HTTP API: GET /v1/health/service/order-service?passing=true

# ✅ Spring Boot application.yml for Spring Cloud Consul
spring:
  application:
    name: order-service
  cloud:
    consul:
      host: consul-agent              # Consul agent address (sidecar on same host)
      port: 8500
      discovery:
        instance-id: ${spring.application.name}-${random.value}  # unique per instance
        health-check-path: /actuator/health
        health-check-interval: 10s
        tags:
          - version=2.3.1
          - env=production
      config:
        enabled: true                 # also pull config from Consul KV store
        prefix: config                # KV key prefix: config/order-service/data
        format: YAML

# ✅ Eureka vs Consul comparison
# Eureka:
#   - AP system (available during network partition; may show stale data)
#   - Self-preservation mode: stops deregistering when heartbeats drop (network issue vs crash)
#   - Simple setup; Spring Cloud Netflix integration
#   - Health check: heartbeat-based (passive — relies on client sending heartbeat)
#
# Consul:
#   - CP system by default (Raft consensus; consistent view across agents)
#   - Active health check: Consul agent polls the health endpoint directly
#   - Built-in KV store for config, service mesh (Consul Connect), DNS interface
#   - More operational complexity; better fit for polyglot (non-JVM) environments
```

## Ứng Dụng Thực Tế

Trong môi trường cloud-native/K8s, không cần Eureka hay Consul — dùng K8s DNS. Với môi trường hybrid/non-K8s, Consul là lựa chọn robust hơn. Luôn cấu hình interval health check tích cực để loại bỏ instance hỏng nhanh.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Service Discovery tại sao cần và implement thế nào?</strong></summary>

**A:** Microservices scale dynamically — IP/port thay đổi khi container restart. Hard-code IP là anti-pattern. Client-side discovery: client query registry (Eureka) lấy instance list, tự load balance (Ribbon/Spring LoadBalancer). Server-side discovery: client gọi load balancer (AWS ALB), LB query registry nội bộ. Eureka: AP (Availability over Consistency) — trong network partition, tiếp tục serve stale registry hơn là unavailable. Consul: CP (Consistency) — strong consistency, cũng là KV store và DNS server.

</details>

<details>
<summary><strong>Tại sao Spring Cloud đang dịch chuyển từ Eureka sang Kubernetes native discovery?</strong></summary>

**A:** Kubernetes đã cung cấp service discovery natively: K8s Service DNS (`order-service.default.svc.cluster.local`) + kube-proxy load balance. Dùng thêm Eureka trong K8s = duplicate functionality, thêm component cần maintain. Spring Cloud Kubernetes tích hợp với K8s API trực tiếp. Eureka vẫn cần cho: hybrid deployment (K8s + VMs), multi-cluster discovery, hoặc team đang migrate từ Spring Cloud Netflix stack. Mới: dùng K8s Service + Spring Cloud LoadBalancer, không cần Eureka.

</details>
