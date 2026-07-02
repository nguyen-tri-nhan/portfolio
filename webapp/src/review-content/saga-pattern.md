---
key: saga-pattern
title: Saga Pattern
crumb: 13. System Design > Data Patterns
---

Saga là pattern quản lý distributed transaction qua nhiều service mà không cần 2PC (Two-Phase Commit) — dùng chuỗi local transaction và **compensating transaction** để đảm bảo consistency.

## Điểm Chính

- **Tại sao không dùng 2PC**: giao thức blocking, lock resource trên nhiều service đồng thời → giảm availability, không phù hợp với microservices loosely coupled
- **Choreography**: các service tự phối hợp qua event — OrderService publish OrderCreated → PaymentService xử lý → publish PaymentProcessed → InventoryService xử lý; đơn giản nhưng flow khó theo dõi
- **Orchestration**: SagaOrchestrator trung tâm điều phối từng bước, gọi từng service theo thứ tự và xử lý lỗi; dễ debug hơn nhưng tạo coupling vào orchestrator
- **Compensating transaction**: hành động đảo ngược bước đã thành công khi bước sau thất bại (refund payment nếu inventory reservation thất bại)
- **Thiếu isolation**: saga không có isolation như ACID — các transaction khác có thể thấy intermediate state trong khi saga đang chạy
- **Idempotency**: mỗi bước phải idempotent vì có thể được retry khi network error hoặc service restart
- **Saga log**: orchestrator lưu state của saga để có thể resume sau khi crash và restart
- **Eventual consistency**: sau khi saga hoàn thành (thành công hoặc compensate xong), hệ thống mới nhất quán

## Ví Dụ Code

*Orchestration-based saga cho luồng đặt hàng trong Kotlin — điều phối Payment, Inventory, Shipping với compensation.*

```kotlin
enum class SagaStep { PAYMENT, INVENTORY, SHIPPING }
enum class SagaStatus { STARTED, COMPLETED, COMPENSATING, FAILED }

data class SagaState(
    val sagaId: String,
    val orderId: String,
    val completedSteps: MutableList<SagaStep> = mutableListOf(),
    var status: SagaStatus = SagaStatus.STARTED
)

class OrderSaga(
    private val paymentService: PaymentService,
    private val inventoryService: InventoryService,
    private val shippingService: ShippingService,
    private val sagaRepository: SagaRepository
) {
    fun execute(order: Order): Result<Unit> {
        val state = SagaState(sagaId = generateId(), orderId = order.id)
        sagaRepository.save(state)

        return runCatching {
            // Step 1: Process payment
            paymentService.processPayment(order.id, order.totalAmount)
            state.completedSteps.add(SagaStep.PAYMENT)
            sagaRepository.save(state)

            // Step 2: Reserve inventory
            inventoryService.reserveItems(order.id, order.items)
            state.completedSteps.add(SagaStep.INVENTORY)
            sagaRepository.save(state)

            // Step 3: Schedule shipping
            shippingService.scheduleDelivery(order.id, order.shippingAddress)
            state.completedSteps.add(SagaStep.SHIPPING)

            state.status = SagaStatus.COMPLETED
            sagaRepository.save(state)
        }.onFailure { error ->
            compensate(state, order, error)
        }
    }

    private fun compensate(state: SagaState, order: Order, cause: Throwable) {
        state.status = SagaStatus.COMPENSATING
        sagaRepository.save(state)

        // Compensate in reverse order
        val stepsToCompensate = state.completedSteps.reversed()
        stepsToCompensate.forEach { step ->
            runCatching {
                when (step) {
                    SagaStep.PAYMENT -> paymentService.refundPayment(order.id)
                    SagaStep.INVENTORY -> inventoryService.releaseReservation(order.id)
                    SagaStep.SHIPPING -> shippingService.cancelDelivery(order.id)
                }
            }.onFailure { compensationError ->
                // Log and alert — manual intervention may be required
                log.error("Compensation failed for step $step", compensationError)
            }
        }

        state.status = SagaStatus.FAILED
        sagaRepository.save(state)
    }
}

interface PaymentService {
    fun processPayment(orderId: String, amount: Long)
    fun refundPayment(orderId: String)    // compensating transaction
}

interface InventoryService {
    fun reserveItems(orderId: String, items: List<OrderItem>)
    fun releaseReservation(orderId: String)    // compensating transaction
}

interface ShippingService {
    fun scheduleDelivery(orderId: String, address: String)
    fun cancelDelivery(orderId: String)    // compensating transaction
}
```

## Ứng Dụng Thực Tế

Saga pattern là lựa chọn tiêu chuẩn trong hệ thống e-commerce microservices khi một đơn hàng cần xác nhận thanh toán, trừ tồn kho, và đặt lịch giao hàng qua 3 service độc lập. Orchestration phù hợp khi flow phức tạp và cần dễ debug; choreography phù hợp cho flow đơn giản hơn với ít service hơn. Luôn cần monitor các saga bị stuck ở trạng thái COMPENSATING để phát hiện kịp thời các trường hợp cần can thiệp thủ công.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Saga vs 2PC — tại sao microservices ưu tiên Saga?</strong></summary>

**A:** 2PC yêu cầu một coordinator lock resource trên tất cả participant trong suốt quá trình — nếu bất kỳ participant nào chậm hoặc down, toàn bộ transaction bị block. Điều này vi phạm nguyên tắc loose coupling và ảnh hưởng nghiêm trọng đến availability của toàn hệ thống. Saga thay vào đó dùng chuỗi local transaction độc lập — mỗi service commit ngay, không giữ lock. Khi có lỗi, compensating transaction được chạy để undo các bước đã thành công. Saga chấp nhận eventual consistency thay vì strong consistency của 2PC, phù hợp với nature của distributed systems.

</details>

<details>
<summary><strong>Choreography vs Orchestration — trade-offs là gì?</strong></summary>

**A:** Choreography không có điểm trung tâm — mỗi service biết phải làm gì khi nhận event từ service khác, dẫn đến loose coupling và dễ scale độc lập. Nhược điểm là flow phân tán qua nhiều service nên rất khó debug và visualize toàn bộ transaction. Orchestration có SagaOrchestrator trung tâm nắm toàn bộ flow logic — dễ debug, dễ monitor, và dễ handle exception. Nhược điểm là orchestrator trở thành điểm tập trung logic và potential single point of coupling. Orchestration thường được ưu tiên cho saga phức tạp nhiều bước, choreography cho flow đơn giản.

</details>

<details>
<summary><strong>Compensating transaction là gì và có giống database rollback không?</strong></summary>

**A:** Compensating transaction là hành động nghiệp vụ đảo ngược tác động của một bước đã commit, ví dụ refundPayment để đảo ngược processPayment. Khác với database rollback — rollback xóa hoàn toàn thay đổi trong một transaction, compensating transaction tạo ra một transaction mới trái chiều. Điều này có nghĩa là trong khoảng thời gian giữa bước ban đầu và compensating transaction, các hệ thống khác có thể đã nhìn thấy intermediate state. Compensating transaction phải được thiết kế cẩn thận vì chính nó cũng có thể thất bại — cần retry và alerting khi compensation fails.

</details>
