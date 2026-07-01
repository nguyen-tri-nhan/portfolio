---
key: "Service Communication"
title: "Giao Tiếp Service"
crumb: "5. Microservices"
---

Microservice giao tiếp đồng bộ (REST, gRPC) hoặc bất đồng bộ (messaging) — chọn pattern đúng ảnh hưởng đến coupling, latency và resilience.

## Điểm Chính

- <strong>Đồng bộ</strong>: REST (HTTP/JSON), gRPC (HTTP/2 + Protobuf). Đơn giản, response ngay, nhưng caller phải chờ.
- <strong>Bất đồng bộ</strong>: Kafka, RabbitMQ, SQS. Decoupled, resilient, nhưng eventual consistency.
- Dùng sync cho: read hướng user, query API, cần response real-time.
- Dùng async cho: event, notification, workflow decoupled, ghi throughput cao.
- Service Mesh (Istio, Linkerd): xử lý retry, circuit breaking, mTLS ở cấp infrastructure.

## Ví Dụ Code

*3 patterns: Feign REST (FallbackFactory), gRPC blocking stub, Kafka async event publishing*

```java
// ✅ Three communication patterns in microservices

// ─── Pattern 1: SYNCHRONOUS REST (Feign Client) ───
// Use for: user-facing queries needing immediate response (order details, product lookup)
@FeignClient(
    name = "inventory-service",
    url = "${services.inventory.url}",
    fallbackFactory = InventoryClientFallbackFactory.class
)
public interface InventoryClient {
    @GetMapping("/api/inventory/{productId}")
    StockResponse checkStock(@PathVariable Long productId);

    @PostMapping("/api/inventory/reserve")
    ReserveResponse reserve(@RequestBody ReserveRequest request);
}

// Fallback factory: different response per exception type
@Component
public class InventoryClientFallbackFactory implements FallbackFactory<InventoryClient> {
    public InventoryClient create(Throwable cause) {
        return new InventoryClient() {
            public StockResponse checkStock(Long productId) {
                log.warn("Inventory service unavailable for product {}", productId, cause);
                return StockResponse.unknown();  // show "availability unknown" to user
            }
            public ReserveResponse reserve(ReserveRequest request) {
                throw new InventoryServiceException("Cannot reserve stock — inventory service down");
            }
        };
    }
}

// ─── Pattern 2: SYNCHRONOUS gRPC ───
// Use for: internal service-to-service calls needing low latency + strong contract
// Protobuf contract defined in orders.proto:
// service OrderService {
//     rpc GetOrder(GetOrderRequest) returns (OrderResponse);
//     rpc StreamOrderUpdates(OrderId) returns (stream OrderUpdate);  // server streaming
// }
@GrpcClient("order-service")
private OrderServiceGrpc.OrderServiceBlockingStub orderStub;

public OrderDto getOrderViaGrpc(Long orderId) {
    GetOrderRequest req = GetOrderRequest.newBuilder().setOrderId(orderId).build();
    OrderResponse resp = orderStub.getOrder(req);
    return new OrderDto(resp.getId(), resp.getStatus(), resp.getTotal());
}

// ─── Pattern 3: ASYNCHRONOUS Kafka event ───
// Use for: state changes that other services "react to" (no immediate response needed)
// Order placed → InventoryService reserves stock, PaymentService charges, NotificationService emails
@Service
public class OrderEventPublisher {
    @Autowired
    private KafkaTemplate<String, Object> kafka;

    public void publishOrderCreated(Order order) {
        OrderCreatedEvent event = new OrderCreatedEvent(
            order.getId(), order.getCustomerId(), order.getItems(), order.getTotal()
        );
        // Key = orderId: ensures all events for same order go to same partition (ordering)
        kafka.send("order.created", String.valueOf(order.getId()), event)
             .addCallback(
                 result -> log.info("Published order.created for orderId={}", order.getId()),
                 failure -> log.error("Failed to publish order.created", failure)
             );
    }
}
```

## Ứng Dụng Thực Tế

Dùng Feign + Circuit Breaker cho sync inter-service call. Publish event lên Kafka cho thay đổi state mà service khác quan tâm. Kết hợp này ("sync cho query, async cho command") là default thực dụng.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Synchronous vs asynchronous communication trade-off là gì?</strong></summary>

**A:** **Synchronous** (REST, gRPC): simple request-response, caller block chờ result, easy debugging, tight coupling — caller phải available, latency tích lũy qua chain. **Asynchronous** (Kafka, RabbitMQ): caller không block, loose coupling, higher throughput, fault tolerance (message persist) — complexity cao hơn (eventual consistency, message ordering, idempotency). Chọn sync: cần immediate response (login, payment status query), simple CRUD. Chọn async: background jobs (email, notification), event broadcasting, high throughput ingestion, decoupling giữa services có SLA khác nhau.

</details>

<details>
<summary><strong>Service mesh như Istio giúp gì cho service communication?</strong></summary>

**A:** Service mesh inject **sidecar proxy** (Envoy) vào mỗi Pod — intercept tất cả network traffic. Benefits: (1) **mTLS automatic**: encrypt và authenticate service-to-service traffic không cần code change. (2) **Traffic management**: retry, circuit breaking, canary routing tại proxy level. (3) **Observability**: distributed tracing, metrics tự động cho mọi service call. (4) **Load balancing**: advanced (least connections, locality-aware). Tradeoff: latency overhead (proxy hop), operational complexity, learning curve. Dùng khi: có nhiều service (>10), cần zero-trust security, muốn centralize cross-cutting concerns.

</details>

<details>
<summary><strong>Request timeout nên set thế nào trong microservices?</strong></summary>

**A:** Nguyên tắc: timeout phải **nhỏ hơn** timeout của caller. Service chain A → B → C: nếu A timeout sau 3s, B phải timeout sau <3s, C phải timeout sau <B_timeout. Tránh timeout lớn hơn caller — resource bị giữ vô ích. **Aggressive timeout** (fast fail): 500ms-2s cho user-facing services — user experience quan trọng hơn eventual success. **Relaxed timeout**: 30s-60s cho background jobs, batch processing. Kết hợp: timeout + retry + circuit breaker. Sai lầm phổ biến: default timeout quá lớn (30s) → slow cascade failure khi downstream chậm.

</details>
