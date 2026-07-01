---
key: "REST vs gRPC"
title: "REST vs gRPC"
crumb: "5. Microservices › Service Communication"
---

REST dùng HTTP/1.1 + JSON (dễ đọc, hỗ trợ rộng); gRPC dùng HTTP/2 + Protobuf (binary, strongly typed, nhanh hơn, hỗ trợ streaming).

## Điểm Chính

- REST: text-based JSON, dễ debug, công cụ phong phú, thân thiện browser.
- gRPC: binary Protobuf (payload nhỏ hơn 3-10×), HTTP/2 multiplexing, bi-directional streaming, contract strongly typed.
- Code generation gRPC: file proto → stub type-safe trong bất kỳ ngôn ngữ nào (Java, Go, Python).
- Streaming gRPC: server-streaming, client-streaming, bidirectional (ví dụ: update real-time).
- REST tốt hơn cho: public API, browser client. gRPC tốt hơn cho: microservice nội bộ, low-latency, high-throughput.

## Ví Dụ Code

*REST vs gRPC comparison table + proto definition + gRPC server (unary + server-streaming) + gRPC client with deadline and error handling*

```java
// ✅ REST vs gRPC comparison:
// ┌────────────────────┬─────────────────────┬──────────────────────────────┐
// │ Property           │ REST (HTTP/1.1+JSON) │ gRPC (HTTP/2 + Protobuf)    │
// ├────────────────────┼─────────────────────┼──────────────────────────────┤
// │ Protocol           │ HTTP/1.1 text        │ HTTP/2 binary               │
// │ Payload format     │ JSON (human-readable)│ Protobuf (3-10× smaller)    │
// │ Contract           │ OpenAPI (optional)   │ .proto file (mandatory)     │
// │ Type safety        │ Runtime               │ Compile-time (code-gen)     │
// │ Streaming          │ SSE / WebSocket       │ Native bi-directional       │
// │ Browser support    │ Full                  │ Needs gRPC-Web proxy        │
// │ Tooling            │ Postman, curl, browser│ Grpcurl, Postman (limited) │
// └────────────────────┴─────────────────────┴──────────────────────────────┘

// ✅ gRPC: proto definition (orders.proto)
// syntax = "proto3";
// service OrderService {
//     rpc GetOrder(GetOrderRequest) returns (OrderResponse);
//     rpc StreamOrderUpdates(OrderId) returns (stream OrderEvent);  // server streaming
// }
// message GetOrderRequest { int64 order_id = 1; }
// message OrderResponse   { int64 id = 1; string status = 2; double total = 3; }
// message OrderEvent      { int64 order_id = 1; string event_type = 2; string timestamp = 3; }

// ✅ gRPC Server implementation (Spring Boot + grpc-spring-boot-starter)
@GrpcService
public class OrderGrpcService extends OrderServiceGrpc.OrderServiceImplBase {

    @Autowired
    private OrderRepository orderRepository;

    // Unary RPC: one request, one response
    @Override
    public void getOrder(GetOrderRequest req, StreamObserver<OrderResponse> observer) {
        try {
            Order order = orderRepository.findById(req.getOrderId())
                .orElseThrow(() -> new OrderNotFoundException(req.getOrderId()));
            OrderResponse response = OrderResponse.newBuilder()
                .setId(order.getId())
                .setStatus(order.getStatus().name())
                .setTotal(order.getTotal().doubleValue())
                .build();
            observer.onNext(response);
            observer.onCompleted();
        } catch (OrderNotFoundException e) {
            observer.onError(Status.NOT_FOUND
                .withDescription("Order " + req.getOrderId() + " not found")
                .asRuntimeException());
        }
    }

    // Server-streaming RPC: one request, multiple responses (real-time order updates)
    @Override
    public void streamOrderUpdates(OrderId req, StreamObserver<OrderEvent> observer) {
        orderEventBus.subscribe(req.getId(), event -> {
            observer.onNext(OrderEvent.newBuilder()
                .setOrderId(event.getOrderId())
                .setEventType(event.getType().name())
                .setTimestamp(event.getTimestamp().toString())
                .build());
        });
        // observer.onCompleted() called when order reaches terminal state
    }
}

// ✅ gRPC Client (calling from payment-service to order-service)
@GrpcClient("order-service")               // resolves via service discovery
private OrderServiceGrpc.OrderServiceBlockingStub orderStub;

public void validateOrderForPayment(Long orderId) {
    GetOrderRequest req = GetOrderRequest.newBuilder().setOrderId(orderId).build();
    try {
        OrderResponse order = orderStub.withDeadlineAfter(2, TimeUnit.SECONDS).getOrder(req);
        if (!order.getStatus().equals("CONFIRMED")) {
            throw new InvalidOrderStateException("Order must be CONFIRMED before payment");
        }
    } catch (StatusRuntimeException e) {
        if (e.getStatus().getCode() == Status.Code.NOT_FOUND) {
            throw new OrderNotFoundException(orderId);
        }
        throw new OrderServiceException("gRPC call failed", e);
    }
}
```

## Ứng Dụng Thực Tế

Cho inter-service call nội bộ trong môi trường microservice đa ngôn ngữ, gRPC hấp dẫn — Protobuf contract bắt API mismatch lúc compile time. Cho public API được dùng bởi browser và bên thứ ba, gắn với REST/OpenAPI.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>gRPC có ưu điểm gì so với REST trong service-to-service communication?</strong></summary>

**A:** (1) **Protobuf binary**: nhỏ hơn JSON 3-10x, serialize/deserialize nhanh hơn. (2) **HTTP/2 multiplexing**: nhiều request trên cùng connection, không head-of-line blocking. (3) **Streaming**: bidirectional streaming (không chỉ request-response). (4) **Strict contract** (proto file): type-safe, code generation, breaking change detection. (5) **Lower latency**: binary + HTTP/2 + persistent connection. Nhược điểm: không human-readable (debug khó hơn), browser không native support (cần gRPC-Web), learning curve. Dùng gRPC: internal microservices cần performance; REST: public API, browser clients.

</details>

<details>
<summary><strong>REST idempotency là gì và tại sao quan trọng?</strong></summary>

**A:** **Idempotent**: gọi N lần cho cùng result như gọi 1 lần. HTTP methods: `GET`, `HEAD`, `OPTIONS` — idempotent và safe. `PUT`, `DELETE` — idempotent (không safe). `POST`, `PATCH` — không idempotent (thường). Quan trọng với retry: nếu network fail sau server xử lý nhưng trước response → client retry. Idempotent endpoint: retry an toàn. `POST /orders` retry tạo duplicate order (vấn đề). Fix: idempotency key — `POST /orders` với header `Idempotency-Key: uuid` → server deduplicate bằng key.

</details>

<details>
<summary><strong>HTTP/2 multiplexing giải quyết vấn đề gì của HTTP/1.1?</strong></summary>

**A:** HTTP/1.1 **Head-of-Line Blocking**: một connection chỉ có một request đang flight — request sau phải chờ request trước xong. Workaround: mở nhiều parallel connection (6-8 per origin) → resource overhead, TCP slow start mỗi connection. **HTTP/2 multiplexing**: nhiều **stream** trong một TCP connection — independent frames interleaved. Request A đang chờ response không block Request B. Kết quả: ít connections, không HOL blocking, header compression (HPACK), server push. gRPC xây trên HTTP/2 → inherit tất cả benefits này cho service communication.

</details>
