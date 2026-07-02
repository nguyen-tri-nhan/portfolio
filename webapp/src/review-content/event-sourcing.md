---
key: event-sourcing
title: Event Sourcing
crumb: 13. System Design > Data Patterns
---

Event Sourcing lưu trữ chuỗi các **sự kiện** thay vì trạng thái hiện tại — trạng thái hiện tại được tái tạo bằng cách replay toàn bộ event log.

## Điểm Chính

- **Event store**: append-only log chứa các domain event (OrderCreated, OrderShipped, OrderCancelled) — không bao giờ xóa hay sửa
- **Projection**: read model được xây dựng bằng cách replay event; mỗi projection là một denormalized view phục vụ query cụ thể
- **Aggregate**: domain object nhận command, validate business rule, và emit event; state chỉ thay đổi qua `apply(event)`
- **Snapshot**: ảnh chụp trạng thái tại một thời điểm để tránh replay từ đầu khi event log quá lớn
- **Audit log miễn phí**: toàn bộ lịch sử thay đổi được lưu tự nhiên — không cần bảng audit riêng
- **Time-travel debugging**: replay event đến bất kỳ thời điểm nào để tái tạo trạng thái quá khứ
- **Relation to CQRS**: Event Sourcing thường kết hợp với CQRS — event store là write side, projection là read side — nhưng CQRS có thể tồn tại độc lập không cần Event Sourcing
- **Schema evolution**: thách thức lớn nhất — event cũ phải được đọc hiểu bởi code mới (upcasting, versioned events)

## Ví Dụ Code

*BankAccount aggregate với Event Sourcing trong Kotlin — lưu event, apply để rebuild state, và snapshot.*

```kotlin
// Domain Events
sealed class BankAccountEvent {
    data class AccountOpened(
        val accountId: String,
        val ownerId: String,
        val initialBalance: Long,
        val occurredAt: Instant = Instant.now()
    ) : BankAccountEvent()

    data class MoneyDeposited(
        val accountId: String,
        val amount: Long,
        val occurredAt: Instant = Instant.now()
    ) : BankAccountEvent()

    data class MoneyWithdrawn(
        val accountId: String,
        val amount: Long,
        val occurredAt: Instant = Instant.now()
    ) : BankAccountEvent()
}

// Aggregate
class BankAccount private constructor(
    val accountId: String,
    var balance: Long = 0L,
    var version: Long = 0L
) {
    companion object {
        fun open(accountId: String, ownerId: String, initialBalance: Long): Pair<BankAccount, BankAccountEvent> {
            val event = BankAccountEvent.AccountOpened(accountId, ownerId, initialBalance)
            val account = BankAccount(accountId)
            account.apply(event)
            return Pair(account, event)
        }

        // Rebuild state by replaying events
        fun rehydrate(events: List<BankAccountEvent>): BankAccount {
            val firstEvent = events.firstOrNull() as? BankAccountEvent.AccountOpened
                ?: throw IllegalArgumentException("First event must be AccountOpened")
            val account = BankAccount(firstEvent.accountId)
            events.forEach { account.apply(it) }
            return account
        }
    }

    fun deposit(amount: Long): BankAccountEvent {
        require(amount > 0) { "Deposit amount must be positive" }
        val event = BankAccountEvent.MoneyDeposited(accountId, amount)
        apply(event)
        return event
    }

    fun withdraw(amount: Long): BankAccountEvent {
        require(amount > 0) { "Withdrawal amount must be positive" }
        require(balance >= amount) { "Insufficient funds" }
        val event = BankAccountEvent.MoneyWithdrawn(accountId, amount)
        apply(event)
        return event
    }

    private fun apply(event: BankAccountEvent) {
        when (event) {
            is BankAccountEvent.AccountOpened -> balance = event.initialBalance
            is BankAccountEvent.MoneyDeposited -> balance += event.amount
            is BankAccountEvent.MoneyWithdrawn -> balance -= event.amount
        }
        version++
    }
}

// Event Store interface
interface EventStore {
    fun append(aggregateId: String, events: List<BankAccountEvent>, expectedVersion: Long)
    fun load(aggregateId: String, fromVersion: Long = 0): List<BankAccountEvent>
    fun saveSnapshot(aggregateId: String, account: BankAccount)
    fun loadSnapshot(aggregateId: String): BankAccount?
}
```

## Ứng Dụng Thực Tế

Event Sourcing rất phù hợp cho các hệ thống yêu cầu audit trail đầy đủ như banking, e-commerce order management, hay healthcare — nơi cần biết chính xác điều gì đã xảy ra và khi nào. Projection có thể được rebuild bất cứ lúc nào để fix bug hoặc thêm reporting view mới mà không cần migration dữ liệu. Snapshot thường được tạo sau mỗi N event (ví dụ 100) để cải thiện performance khi load aggregate.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Event Sourcing khác traditional database update như thế nào?</strong></summary>

**A:** Traditional database chỉ lưu trạng thái hiện tại — khi UPDATE một record, giá trị cũ bị mất vĩnh viễn. Event Sourcing thay vào đó lưu toàn bộ chuỗi sự kiện dẫn đến trạng thái đó vào một append-only log. Trạng thái hiện tại được tính bằng cách replay tất cả event từ đầu. Điều này cho phép audit log đầy đủ, time-travel debugging, và khả năng tạo ra các projection mới từ cùng một bộ event mà không cần thay đổi dữ liệu gốc.

</details>

<details>
<summary><strong>Snapshot trong Event Sourcing là gì và khi nào cần dùng?</strong></summary>

**A:** Snapshot là ảnh chụp trạng thái của aggregate tại một thời điểm cụ thể, được lưu song song với event log. Khi cần load aggregate, thay vì replay toàn bộ event từ đầu, hệ thống load snapshot gần nhất rồi chỉ replay các event xảy ra sau snapshot đó. Snapshot thường được tạo định kỳ sau mỗi N event hoặc sau một khoảng thời gian nhất định. Cần cân nhắc dùng snapshot khi aggregate có event log rất dài (hàng nghìn event) khiến latency khi load tăng đáng kể.

</details>

<details>
<summary><strong>Event schema versioning là thách thức gì và giải quyết thế nào?</strong></summary>

**A:** Khi schema của một event thay đổi (thêm field, đổi tên, xóa field), các event cũ trong store vẫn ở format cũ trong khi code mới expect format mới. Giải pháp phổ biến là **upcasting** — transform event cũ sang version mới khi đọc từ store, thường theo chuỗi V1 → V2 → V3. Cách khác là **versioned events** — đặt version vào tên event (OrderCreatedV1, OrderCreatedV2) và giữ handler cho tất cả version. Tốt nhất nên thiết kế event để backward compatible — chỉ thêm optional field, không xóa hay đổi tên field bắt buộc.

</details>
