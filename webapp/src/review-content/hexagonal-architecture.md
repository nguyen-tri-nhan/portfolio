---
key: hexagonal-architecture
title: Hexagonal Architecture (Ports & Adapters)
crumb: 9. Design Patterns > Architecture Patterns
---

Hexagonal Architecture (Ports & Adapters) của Alistair Cockburn đặt domain business logic ở trung tâm, cô lập hoàn toàn khỏi infrastructure — cho phép swap database, HTTP framework, hoặc message broker mà không thay đổi một dòng domain code nào.

## Điểm Chính

- **Domain (core)**: chứa toàn bộ business logic — pure Kotlin/Java, không có bất kỳ framework dependency nào (không import Spring, JPA, Jackson)
- **Ports**: interfaces định nghĩa cách domain giao tiếp với thế giới bên ngoài — **Primary/Driving ports** (driving use cases, ví dụ `PlaceOrderUseCase`), **Secondary/Driven ports** (driven by domain, ví dụ `OrderRepository`, `PaymentGateway`)
- **Adapters**: implementations của ports — **Primary adapters**: REST controller, gRPC handler, Kafka consumer (call domain); **Secondary adapters**: JPA repository, HTTP client, SMTP email (called by domain)
- **Dependency rule**: domain không depend vào adapters; adapter depend vào domain ports — dependency flow vào trong, không ra ngoài
- **Testing benefit**: domain có thể được test hoàn toàn in-memory không cần DB, HTTP server, hay any infrastructure
- **Swap adapter**: thay JPA bằng MongoDB bằng cách viết `MongoOrderRepository` implements `OrderRepository` port — domain không biết sự thay đổi này
- **So với Layered (N-tier)**: Layered có presentation → service → repository (dependency đi xuống); Hexagonal có domain ở trung tâm, infra ở viền ngoài (dependency đi vào trong)
- **So với Clean Architecture**: cùng concept (dependency rule hướng vào trong); Clean Architecture thêm explicit concentric rings (Entities, Use Cases, Interface Adapters, Frameworks)

## Ví Dụ Code

*Kotlin hexagonal structure — OrderService (domain), OrderRepository (port), JpaOrderRepository (adapter), OrderController (adapter)*

```kotlin
// ─────────────────────────────────────────
// DOMAIN LAYER — không import Spring/JPA
// ─────────────────────────────────────────

// Domain Entity (no framework annotations)
class Order(
    val id: OrderId,
    val customerId: CustomerId,
    private val items: MutableList<OrderItem> = mutableListOf(),
    var status: OrderStatus = OrderStatus.DRAFT
) {
    fun addItem(item: OrderItem) {
        check(status == OrderStatus.DRAFT) { "Cannot add items to $status order" }
        items.add(item)
    }

    fun place(): OrderPlacedEvent {
        check(items.isNotEmpty()) { "Cannot place empty order" }
        status = OrderStatus.PLACED
        return OrderPlacedEvent(id, customerId, items.toList(), Instant.now())
    }

    val total: Money get() = items.sumOf { it.subtotal }
}

// ─────────────────────────────────────────
// PORTS — interfaces owned by domain layer
// ─────────────────────────────────────────

// Primary/Driving Port: use case interface
// REST controller và Kafka consumer đều call qua port này
interface PlaceOrderUseCase {
    fun execute(command: PlaceOrderCommand): OrderId
}

data class PlaceOrderCommand(
    val customerId: CustomerId,
    val items: List<OrderItemRequest>
)

// Secondary/Driven Port: repository interface
// Domain calls này; adapter (JPA, Mongo) implements
interface OrderRepository {
    fun save(order: Order)
    fun findById(id: OrderId): Order?
}

// Secondary/Driven Port: payment gateway
interface PaymentGateway {
    fun charge(orderId: OrderId, amount: Money): PaymentResult
}

// ─────────────────────────────────────────
// DOMAIN SERVICE — implements primary port
// Không có @Service Spring annotation trong pure hexagonal
// ─────────────────────────────────────────
class PlaceOrderService(
    private val orderRepository: OrderRepository,   // port, không phải JPA class
    private val paymentGateway: PaymentGateway,     // port, không phải HTTP client
    private val eventPublisher: DomainEventPublisher
) : PlaceOrderUseCase {

    override fun execute(command: PlaceOrderCommand): OrderId {
        val order = Order(
            id = OrderId.generate(),
            customerId = command.customerId
        )

        command.items.forEach { req ->
            order.addItem(OrderItem(req.productId, req.productName, req.unitPrice, req.quantity))
        }

        val event = order.place()

        // Charge payment — domain chỉ biết port, không biết HTTP hay Stripe
        val paymentResult = paymentGateway.charge(order.id, order.total)
        if (!paymentResult.isSuccess) {
            throw PaymentFailedException(order.id, paymentResult.failureReason)
        }

        orderRepository.save(order)
        eventPublisher.publish(event)

        return order.id
    }
}

// ─────────────────────────────────────────
// PRIMARY ADAPTER — REST Controller
// Calls domain via PlaceOrderUseCase port
// ─────────────────────────────────────────
@RestController
@RequestMapping("/api/orders")
class OrderController(
    private val placeOrderUseCase: PlaceOrderUseCase  // inject port, không inject service trực tiếp
) {
    @PostMapping
    fun placeOrder(@RequestBody request: PlaceOrderHttpRequest): ResponseEntity<PlaceOrderResponse> {
        val command = PlaceOrderCommand(
            customerId = CustomerId(request.customerId),
            items = request.items.map { OrderItemRequest(it.productId, it.productName, it.unitPrice, it.quantity) }
        )
        val orderId = placeOrderUseCase.execute(command)
        return ResponseEntity.status(HttpStatus.CREATED).body(PlaceOrderResponse(orderId.value))
    }
}

// ─────────────────────────────────────────
// SECONDARY ADAPTER — JPA Repository
// Implements OrderRepository port
// ─────────────────────────────────────────
@Component
class JpaOrderRepository(
    private val jpaRepo: SpringDataOrderRepository
) : OrderRepository {

    override fun save(order: Order) {
        val entity = OrderEntity.fromDomain(order)  // map domain → JPA entity
        jpaRepo.save(entity)
    }

    override fun findById(id: OrderId): Order? =
        jpaRepo.findById(id.value).map { it.toDomain() }.orElse(null)
}

// SECONDARY ADAPTER — Stripe Payment Gateway
@Component
class StripePaymentGateway(private val stripeClient: StripeClient) : PaymentGateway {
    override fun charge(orderId: OrderId, amount: Money): PaymentResult {
        val charge = stripeClient.charges().create(
            ChargeCreateParams.builder()
                .setAmount(amount.toCents())
                .setCurrency(amount.currency.code)
                .setMetadata(mapOf("orderId" to orderId.value.toString()))
                .build()
        )
        return if (charge.status == "succeeded") PaymentResult.success()
        else PaymentResult.failure(charge.failureMessage)
    }
}
```

## Ứng Dụng Thực Tế

Hexagonal Architecture đặc biệt có giá trị khi team cần flexibility về infrastructure — migrate từ REST sang gRPC chỉ cần viết thêm gRPC adapter mà không đụng domain code. Trong microservices, mỗi service implement hexagonal architecture nội bộ: domain logic ở core, REST/gRPC adapter bên ngoài, JPA/Redis adapter ở secondary side. Test pyramid cũng tự nhiên hơn: unit test domain (không cần Spring context), integration test từng adapter riêng lẻ.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Hexagonal Architecture vs Layered Architecture — sự khác biệt cốt lõi là gì?</strong></summary>

**A:** **Layered (N-tier)**: dependency đi một chiều từ trên xuống — Presentation → Business Logic → Data Access. Vấn đề: Business Logic layer biết về Data Access layer (import JPA), khó test business logic mà không cần DB, khó swap database. **Hexagonal**: Domain ở trung tâm, không depend vào bất kỳ layer nào — Adapters (ở viền ngoài) depend vào Domain Ports. Business logic hoàn toàn independent với framework và infrastructure. Test domain chỉ cần in-memory implementations của ports. Swap JPA → MongoDB: viết `MongoOrderRepository` implement `OrderRepository` port, không thay đổi domain code.

</details>

<details>
<summary><strong>Ports vs Adapters — phân biệt Primary và Secondary?</strong></summary>

**A:** **Port** là interface (abstraction) — owned by domain layer; defines how domain communicates. **Adapter** là implementation của port — lives in infrastructure layer. Phân biệt **Primary (Driving)**: actor bên ngoài khởi tạo interaction với domain — REST controller là Primary Adapter implements `PlaceOrderUseCase` (Primary Port); Kafka consumer là Primary Adapter gọi domain use case. **Secondary (Driven)**: domain khởi tạo interaction với infrastructure — `OrderRepository` là Secondary Port (interface); `JpaOrderRepository` là Secondary Adapter implements port đó. Quy tắc nhớ: Primary = "drives the application"; Secondary = "driven by the application".

</details>

<details>
<summary><strong>Testing benefit của Hexagonal Architecture là gì?</strong></summary>

**A:** Vì domain không depend vào infrastructure, có thể test business logic với **in-memory adapters** — không cần Spring context, không cần DB, không cần HTTP server. Test chạy trong milliseconds thay vì seconds. Ví dụ: `InMemoryOrderRepository` implements `OrderRepository` chỉ dùng `HashMap` — inject vào `PlaceOrderService` trong test. `FakePaymentGateway` implements `PaymentGateway` return success/failure theo ý — test cả happy path và failure scenarios. Integration test từng adapter riêng: `JpaOrderRepositoryTest` chỉ test JPA mapping với Testcontainers (không cần load toàn bộ domain). Kết quả: unit test nhanh cho domain logic, focused integration test cho từng adapter.

</details>
