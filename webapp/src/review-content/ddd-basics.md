---
key: ddd-basics
title: Domain-Driven Design (DDD) Basics
crumb: 9. Design Patterns > Architecture Patterns
---

DDD (Domain-Driven Design) căn chỉnh mô hình phần mềm với nghiệp vụ thực tế thông qua Ubiquitous Language, Bounded Context và Tactical Patterns, đặc biệt hiệu quả cho domain phức tạp với nhiều business rule.

## Điểm Chính

- **Ubiquitous Language**: ngôn ngữ chung giữa developer và domain expert — cùng dùng từ "Order", "Fulfillment", "SKU" trong cả code lẫn cuộc họp; tránh impedance mismatch giữa business model và code model
- **Bounded Context**: ranh giới rõ ràng cho một domain model — trong "Order Context", Customer là người mua hàng; trong "Support Context", Customer là ticket requester — cùng tên nhưng khác model
- **Context Map**: mô tả quan hệ giữa các Bounded Context — Upstream/Downstream, Shared Kernel, Anti-Corruption Layer, Published Language
- **Entity**: đối tượng có identity xuyên suốt lifecycle — `Order(id=123)` là cùng order dù thay đổi status; so sánh bằng ID
- **Value Object**: đối tượng không có identity, so sánh bằng value, bất biến — `Money(100, USD)`, `Address`, `Email`; không có setter
- **Aggregate**: ranh giới consistency — cluster của Entity và Value Object được treat như một unit; chỉ có Root Entity nhận request từ ngoài; transaction chỉ thay đổi một aggregate
- **Aggregate Rule**: Aggregate chỉ reference Aggregate khác bằng ID, không phải object reference — tránh load toàn bộ object graph
- **Domain Event**: sự kiện nghiệp vụ đã xảy ra — `OrderPlaced`, `PaymentProcessed`; publish để notify các bounded context khác mà không coupling trực tiếp

## Ví Dụ Code

*Kotlin Order aggregate với Value Objects (Money, OrderItem), Domain Event (OrderPlaced), Repository interface*

```kotlin
// Value Object: immutable, equality by value, no identity
data class Money(val amount: BigDecimal, val currency: Currency) {
    init {
        require(amount >= BigDecimal.ZERO) { "Amount cannot be negative" }
    }

    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "Cannot add different currencies" }
        return Money(amount + other.amount, currency)
    }

    operator fun times(quantity: Int): Money =
        Money(amount.multiply(BigDecimal(quantity)), currency)
}

data class OrderItem(
    val productId: ProductId,   // Value Object wrapping UUID
    val productName: String,
    val unitPrice: Money,
    val quantity: Int
) {
    init {
        require(quantity > 0) { "Quantity must be positive" }
    }

    val subtotal: Money get() = unitPrice * quantity
}

// Domain Event: immutable record of something that happened
data class OrderPlaced(
    val orderId: OrderId,
    val customerId: CustomerId,
    val items: List<OrderItem>,
    val totalAmount: Money,
    val occurredAt: Instant = Instant.now()
)

// Aggregate Root: consistency boundary for Order
// Invariant: Order total = sum of item subtotals
// Invariant: Cannot add items to a CONFIRMED or CANCELLED order
class Order private constructor(
    val id: OrderId,
    val customerId: CustomerId,
    private val items: MutableList<OrderItem> = mutableListOf(),
    var status: OrderStatus = OrderStatus.DRAFT,
    private val domainEvents: MutableList<Any> = mutableListOf()
) {
    val totalAmount: Money
        get() = items.fold(Money(BigDecimal.ZERO, Currency.USD)) { acc, item -> acc + item.subtotal }

    fun addItem(productId: ProductId, productName: String, unitPrice: Money, quantity: Int) {
        check(status == OrderStatus.DRAFT) { "Cannot add items to $status order" }

        // Merge with existing item if same product
        val existing = items.find { it.productId == productId }
        if (existing != null) {
            items.remove(existing)
            items.add(existing.copy(quantity = existing.quantity + quantity))
        } else {
            items.add(OrderItem(productId, productName, unitPrice, quantity))
        }
    }

    fun place(): OrderPlaced {
        check(status == OrderStatus.DRAFT) { "Only DRAFT orders can be placed" }
        check(items.isNotEmpty()) { "Cannot place empty order" }

        status = OrderStatus.PLACED
        val event = OrderPlaced(id, customerId, items.toList(), totalAmount)
        domainEvents.add(event)
        return event
    }

    fun pullDomainEvents(): List<Any> {
        val events = domainEvents.toList()
        domainEvents.clear()
        return events
    }

    // Factory method: enforce invariants at creation
    companion object {
        fun create(customerId: CustomerId): Order =
            Order(id = OrderId.generate(), customerId = customerId)

        fun reconstitute(id: OrderId, customerId: CustomerId, items: List<OrderItem>, status: OrderStatus): Order =
            Order(id, customerId, items.toMutableList(), status)
    }
}

// Repository: domain interface, infrastructure-agnostic
// Chỉ biết về domain objects, không biết về JPA, SQL
interface OrderRepository {
    fun save(order: Order)
    fun findById(id: OrderId): Order?
    fun findByCustomerId(customerId: CustomerId): List<Order>
}

// Domain Service: logic không thuộc về một Aggregate cụ thể
// Ví dụ: discount calculation cần biết về Customer + Order
class OrderPricingService(private val discountPolicy: DiscountPolicy) {
    fun calculateDiscount(order: Order, customerId: CustomerId): Money {
        val tier = discountPolicy.getTierForCustomer(customerId)
        return order.totalAmount * tier.discountPercentage
    }
}
```

## Ứng Dụng Thực Tế

DDD phù hợp với e-commerce, fintech, logistics — nơi business rules phức tạp và domain experts có nhiều kiến thức cần được capture trong code. Aggregate boundaries trong DDD thường map tự nhiên sang microservice boundaries: Order Service, Inventory Service, Payment Service mỗi service sở hữu Aggregate của mình. Trong CRUD-heavy app đơn giản (admin panel, config management), DDD là over-engineering.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Aggregate vs Entity — sự khác biệt quan trọng nhất là gì?</strong></summary>

**A:** **Entity** có identity (ID) và lifecycle — `User(id=42)` tồn tại qua nhiều trạng thái. **Aggregate** là ranh giới consistency — một cluster gồm một Root Entity và các Entity/Value Object liên quan, được xử lý như một unit transactional. Điểm khác biệt quan trọng: (1) Chỉ Aggregate Root nhận commands từ bên ngoài — không access trực tiếp vào child entity. (2) Một transaction chỉ thay đổi một Aggregate — nếu cần thay đổi nhiều Aggregate, dùng Domain Events + eventual consistency. (3) Aggregate reference Aggregate khác chỉ bằng ID, không phải object — tránh load toàn bộ object graph.

</details>

<details>
<summary><strong>Bounded Context là gì và tại sao quan trọng trong microservices?</strong></summary>

**A:** **Bounded Context** là ranh giới trong đó một domain model có nghĩa nhất quán — cùng term "Product" có thể có model khác nhau trong Catalog Context (name, description, images) vs Inventory Context (SKU, stock level, warehouse location) vs Pricing Context (price, discount rules). Trong microservices, Bounded Context thường map 1:1 với một service — mỗi service owns its domain model và database. Quan trọng vì: (1) Tránh "God Model" — một model cố gắng đáp ứng tất cả context → quá phức tạp; (2) Team autonomy — mỗi team own một BC, thay đổi model không ảnh hưởng team khác; (3) Clear interface — Context Map định nghĩa integration points giữa BCs.

</details>

<details>
<summary><strong>Khi nào DDD là overkill và không nên dùng?</strong></summary>

**A:** DDD là overkill khi: (1) **CRUD-heavy application** — admin panel, config management, reporting dashboard không có business logic phức tạp; simple layered architecture là đủ. (2) **Small team / startup** — overhead của DDD (strategic + tactical patterns, event sourcing, CQRS) không justified khi team nhỏ cần ship nhanh. (3) **Well-understood domain** — domain không phức tạp, không có nhiều business rules, không cần domain expert; simple transaction script approach là đủ. (4) **Time-constrained MVP** — DDD require significant upfront design; không phù hợp khi cần validate idea nhanh. DDD phù hợp khi: domain complexity cao, domain experts available, long-term system cần maintainable, team đủ lớn để absorb learning curve.

</details>
