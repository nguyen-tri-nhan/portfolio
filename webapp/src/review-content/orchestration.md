---
key: "Orchestration"
title: "Orchestration Saga"
crumb: "5. Microservices › Saga Pattern"
---

Trong orchestration, saga coordinator trung tâm (orchestrator) điều khiển distributed transaction, gọi rõ ràng từng participant và xử lý compensation khi thất bại.

## Điểm Chính

- Orchestrator giữ toàn bộ state machine saga — explicit, auditable, testable.
- Công cụ: Temporal, Camunda, AWS Step Functions, Conductor (Netflix).
- Participant là service đơn giản làm theo lệnh orchestrator.
- <strong>Ưu</strong>: visibility flow tập trung, quản lý compensation phức tạp dễ hơn, một nơi để thêm retry.
- <strong>Nhược</strong>: orchestrator có thể trở thành bottleneck/single point of failure.

## Ví Dụ Code

*Temporal Orchestration: 3-step saga, per-step ActivityOptions, reverse compensation, @SignalMethod cancel, idempotent workflowId*

```java
// ✅ Orchestration Saga: central orchestrator drives the entire order flow
// The workflow is the "brain": it calls each service and handles compensation
//
// Happy path:
//   Step 1: Reserve inventory  → Step 2: Charge payment → Step 3: Schedule shipping → DONE
// Compensation (reverse order):
//   Payment fails → release reservation
//   Shipping fails → refund payment + release reservation

@WorkflowInterface
public interface OrderFulfillmentWorkflow {
    @WorkflowMethod
    OrderResult processOrder(OrderRequest request);

    @SignalMethod
    void cancelOrder(String reason);  // signal from external system to abort
}

@WorkflowImpl
public class OrderFulfillmentWorkflowImpl implements OrderFulfillmentWorkflow {

    // Each activity stub has independent timeout + retry config
    private final InventoryActivity inventory = Workflow.newActivityStub(
        InventoryActivity.class,
        ActivityOptions.newBuilder()
            .setStartToCloseTimeout(Duration.ofSeconds(10))
            .setRetryOptions(RetryOptions.newBuilder()
                .setMaximumAttempts(3)
                .setDoNotRetry(OutOfStockException.class.getName())  // no retry for business error
                .build())
            .build());

    private final PaymentActivity payment = Workflow.newActivityStub(
        PaymentActivity.class,
        ActivityOptions.newBuilder()
            .setStartToCloseTimeout(Duration.ofSeconds(30))
            .setRetryOptions(RetryOptions.newBuilder().setMaximumAttempts(2).build())
            .build());

    private volatile boolean cancelled = false;

    @Override
    public OrderResult processOrder(OrderRequest req) {
        String reservationId = null;
        String transactionId  = null;
        try {
            // Step 1: Reserve stock — Temporal auto-retries transient failures
            reservationId = inventory.reserve(req.getOrderId(), req.getItems());

            if (cancelled) {
                inventory.release(reservationId);   // compensate before abort
                return OrderResult.cancelled(req.getOrderId());
            }

            // Step 2: Charge customer — if this fails, compensate Step 1
            transactionId = payment.charge(req.getCustomerId(), req.getTotal(), req.getOrderId());

            // Step 3: Schedule shipping
            ShippingActivity shipping = Workflow.newActivityStub(ShippingActivity.class,
                ActivityOptions.newBuilder().setStartToCloseTimeout(Duration.ofMinutes(5)).build());
            String tracking = shipping.schedule(req.getOrderId(), req.getShippingAddress());

            return OrderResult.success(req.getOrderId(), transactionId, tracking);

        } catch (OutOfStockException e) {
            return OrderResult.failed(req.getOrderId(), "Out of stock: " + e.getMessage());
        } catch (PaymentDeclinedException e) {
            if (reservationId != null) inventory.release(reservationId);  // compensate Step 1
            return OrderResult.failed(req.getOrderId(), "Payment declined");
        } catch (Exception e) {
            if (transactionId != null) payment.refund(transactionId, req.getTotal());  // comp Step 2
            if (reservationId != null) inventory.release(reservationId);              // comp Step 1
            throw ApplicationFailure.newFailure("Order failed", "OrderError", e);
        }
    }

    @Override
    public void cancelOrder(String reason) { this.cancelled = true; }
}

// ✅ Launch workflow — idempotent: same workflowId = reuse existing, no duplicate
WorkflowOptions opts = WorkflowOptions.newBuilder()
    .setWorkflowId("order-" + req.getOrderId())   // stable ID prevents duplicates
    .setTaskQueue("order-fulfillment-queue")
    .setWorkflowExecutionTimeout(Duration.ofMinutes(10))
    .build();
OrderFulfillmentWorkflow wf = client.newWorkflowStub(OrderFulfillmentWorkflow.class, opts);
OrderResult result = wf.processOrder(req);
// Temporal persists each activity result to DB
// Server crash mid-workflow → Temporal replays history to resume from last completed step
```

## Ứng Dụng Thực Tế

Dùng Temporal cho workflow chạy lâu cần durability, retry và visibility. Temporal lưu trữ workflow state vào database — tồn tại sau khi server restart. Tốt cho: xử lý đơn hàng, phê duyệt vay vốn, pipeline onboarding.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Vai trò của orchestrator trong orchestration saga là gì?</strong></summary>

**A:** **Orchestrator** là central service điều phối các bước của saga: gọi từng service theo thứ tự, handle response, quyết định bước tiếp theo hoặc trigger compensating transaction khi fail. Orchestrator biết toàn bộ flow — là source of truth về trạng thái saga. Ví dụ: `OrderOrchestrator` → gọi PaymentService → nếu thành công gọi InventoryService → nếu fail gọi CancelPaymentService (compensating). Pattern: saga state machine trong orchestrator.

</details>

<details>
<summary><strong>Temporal khác message queue cho saga orchestration thế nào?</strong></summary>

**A:** **Message queue** (RabbitMQ/Kafka): orchestrator gửi command, subscribe event — cần implement retry, timeout, state persistence manually. Code phức tạp khi saga có nhiều bước và compensating path. **Temporal.io**: workflow engine — code saga như sequential function nhưng durable (persist state tự động), built-in retry, timeout, compensation. Failure của worker process không mất state — Temporal replay lại workflow từ event history. Temporal đơn giản hóa saga orchestration code đáng kể.

</details>

<details>
<summary><strong>Trade-off giữa orchestration và choreography là gì?</strong></summary>

**A:** **Orchestration**: central control, easy to debug (một nơi xem flow), easy to add step, risk single point of failure/coupling. **Choreography**: decentralized, services không biết nhau (loose coupling), không có single orchestrator, harder to debug (trace event qua nhiều service), harder to understand full flow. Chọn orchestration khi: complex flow với nhiều compensating path, cần visibility; choreography khi: simple few-step flow, muốn maximum decoupling giữa service.

</details>
