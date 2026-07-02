---
key: outbox-pattern
title: Outbox Pattern
crumb: 13. System Design > Data Patterns
---

Outbox Pattern giải quyết bài toán atomic write khi cần lưu dữ liệu vào DB và publish event lên message broker trong cùng một thao tác — tránh inconsistency khi một trong hai thất bại.

## Điểm Chính

- **Vấn đề dual-write**: ghi DB rồi publish broker là hai operation riêng biệt — DB commit thành công nhưng broker publish thất bại (hoặc ngược lại) dẫn đến inconsistency không thể recover
- **Outbox table**: bảng phụ trong cùng DB lưu event cần publish; business data và outbox event được ghi trong **cùng một transaction** → đảm bảo atomic
- **Schema outbox table**: `id`, `aggregate_type`, `aggregate_id`, `event_type`, `payload` (JSON), `created_at`, `published_at` (NULL = chưa publish)
- **Outbox relay/processor**: background job poll outbox table → publish lên Kafka/RabbitMQ → đánh dấu `published_at` sau khi thành công
- **CDC approach (Debezium)**: đọc WAL (Write-Ahead Log) của DB thay vì polling — hiệu quả hơn, low latency, không cần polling interval, nhưng phức tạp hơn về infrastructure
- **At-least-once delivery**: relay có thể publish duplicate nếu crash sau publish nhưng trước khi mark published → consumer phải idempotent
- **Cleanup**: định kỳ xóa các event đã published khỏi outbox table để tránh table growth vô hạn
- **Ordering guarantee**: event trong outbox table có thứ tự theo `id` hoặc `created_at` — relay publish theo thứ tự đó, phù hợp với Kafka partition ordering

## Ví Dụ Code

*Spring Boot Kotlin — lưu Order và OutboxEvent trong cùng `@Transactional`, OutboxRelayService poll và publish lên Kafka.*

```kotlin
// Outbox entity
@Entity
@Table(name = "outbox_events")
data class OutboxEvent(
    @Id val id: String = UUID.randomUUID().toString(),
    val aggregateType: String,
    val aggregateId: String,
    val eventType: String,
    @Column(columnDefinition = "TEXT") val payload: String,
    val createdAt: Instant = Instant.now(),
    var publishedAt: Instant? = null
)

// Order service — atomic write
@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val outboxRepository: OutboxRepository,
    private val objectMapper: ObjectMapper
) {
    @Transactional
    fun placeOrder(request: PlaceOrderRequest): Order {
        // Step 1: Save business data
        val order = Order(
            id = UUID.randomUUID().toString(),
            customerId = request.customerId,
            items = request.items,
            totalAmount = request.totalAmount,
            status = OrderStatus.PENDING
        )
        orderRepository.save(order)

        // Step 2: Write outbox event in SAME transaction
        val event = OrderPlacedEvent(
            orderId = order.id,
            customerId = order.customerId,
            totalAmount = order.totalAmount
        )
        val outboxEvent = OutboxEvent(
            aggregateType = "Order",
            aggregateId = order.id,
            eventType = "OrderPlaced",
            payload = objectMapper.writeValueAsString(event)
        )
        outboxRepository.save(outboxEvent)

        // Both committed atomically — no dual-write risk
        return order
    }
}

// Outbox relay — polling approach
@Component
class OutboxRelayService(
    private val outboxRepository: OutboxRepository,
    private val kafkaTemplate: KafkaTemplate<String, String>
) {
    @Scheduled(fixedDelay = 1000)  // poll every 1 second
    @Transactional
    fun publishPendingEvents() {
        val pending = outboxRepository.findTop100ByPublishedAtIsNullOrderByCreatedAt()

        pending.forEach { event ->
            runCatching {
                kafkaTemplate.send(
                    "domain-events",
                    event.aggregateId,  // partition key for ordering
                    event.payload
                ).get(5, TimeUnit.SECONDS)

                event.publishedAt = Instant.now()
                outboxRepository.save(event)
            }.onFailure { e ->
                log.error("Failed to publish outbox event ${event.id}", e)
                // Will retry on next poll cycle
            }
        }
    }
}
```

## Ứng Dụng Thực Tế

Outbox Pattern được dùng rộng rãi trong hệ thống microservices khi một service cần đồng thời cập nhật dữ liệu và thông báo cho các service khác qua Kafka. Ví dụ, khi user hoàn thành thanh toán, PaymentService ghi payment record và publish PaymentCompleted event vào outbox cùng một transaction — đảm bảo event luôn được gửi dù service restart ngay sau đó. Với hệ thống high-throughput, CDC qua Debezium thường được ưu tiên hơn polling để giảm latency và database load.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao dual-write nguy hiểm và Outbox Pattern giải quyết thế nào?</strong></summary>

**A:** Dual-write là pattern ghi DB rồi publish event broker — hai operation này không atomic. Nếu service crash sau khi DB commit nhưng trước khi publish broker, event bị mất hoàn toàn mà không có cách nào phát hiện hay recover. Ngược lại, nếu publish thành công nhưng DB transaction roll back do exception, event được gửi đi nhưng business data không được lưu — gây ra ghost event. Outbox Pattern đưa cả hai vào cùng một DB transaction: business data và outbox event được commit atomically. Relay sau đó chịu trách nhiệm publish từ outbox — nếu crash, relay restart và tiếp tục từ event chưa published.

</details>

<details>
<summary><strong>Outbox với polling khác CDC (Debezium) thế nào?</strong></summary>

**A:** Polling approach: relay query DB định kỳ (ví dụ mỗi giây) để lấy event chưa published — đơn giản, dễ implement, không cần infrastructure phụ, nhưng có latency bằng polling interval và tạo DB load liên tục. CDC approach với Debezium đọc trực tiếp từ WAL (Write-Ahead Log) của PostgreSQL/MySQL — không polling, latency cực thấp (milliseconds), không tạo thêm DB query. Tuy nhiên Debezium cần Kafka Connect infrastructure, cần cấu hình replication slot trên DB, và phức tạp hơn để operate. Với hệ thống cần latency thấp hoặc throughput cao, CDC là lựa chọn tốt hơn; polling đủ tốt cho hầu hết use case.

</details>

<details>
<summary><strong>Consumer phải idempotent như thế nào để handle at-least-once delivery?</strong></summary>

**A:** At-least-once delivery nghĩa là consumer có thể nhận duplicate event — relay publish thành công nhưng crash trước khi mark published, nên publish lại lần nữa sau khi restart. Consumer phải thiết kế để xử lý event giống nhau nhiều lần mà không gây side effect. Cách phổ biến nhất là lưu `event_id` đã xử lý vào DB (deduplification table) và check trước khi xử lý — nếu đã tồn tại thì skip. Cách khác là thiết kế operation tự nhiên là idempotent — ví dụ `INSERT ... ON CONFLICT DO NOTHING` hoặc upsert thay vì insert. Cần phân biệt idempotent (same result) với at-most-once (có thể miss) — ta muốn at-least-once + idempotent consumer = effectively-once.

</details>
