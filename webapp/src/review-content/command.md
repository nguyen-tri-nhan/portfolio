---
key: "Command"
title: "Command Pattern"
crumb: "10. Design Patterns › Behavioral"
---

Command encapsulate request như object với method execute() — cho phép parameterization, queuing, logging và undo/redo của operation.

## Điểm Chính

- <strong>Command</strong>: interface với <code>execute()</code> và tùy chọn <code>undo()</code>.
- <strong>Invoker</strong>: giữ lịch sử command, gọi execute/undo.
- <strong>Receiver</strong>: object thực sự thực hiện hành động.
- Use case: undo/redo, macro recording, job queue, audit log, transactional script.

## Ví Dụ Code

*PlaceOrderCommand + CancelOrderCommand + CommandHistory (undo/redo) + audit trail*

```java
// ── Command interface ─────────────────────────────────────────────────────────
public interface OrderCommand {
    void execute();   // perform the operation
    void undo();      // reverse the operation
    String describe(); // human-readable description for audit log
}

// ── PlaceOrderCommand — receiver: OrderService ────────────────────────────────
public class PlaceOrderCommand implements OrderCommand {
    private final OrderService  orderService;
    private final OrderRequest  request;
    private       Order         placedOrder;  // stored for undo

    public PlaceOrderCommand(OrderService service, OrderRequest request) {
        this.orderService = service;
        this.request      = request;
    }

    @Override
    public void execute() {
        placedOrder = orderService.placeOrder(request);
        log.info("PlaceOrderCommand.execute() orderId={}", placedOrder.getId());
    }

    @Override
    public void undo() {
        if (placedOrder == null) throw new IllegalStateException("Cannot undo: not yet executed");
        orderService.cancelOrder(placedOrder.getId());
        log.info("PlaceOrderCommand.undo() cancelled orderId={}", placedOrder.getId());
    }

    @Override public String describe() {
        return "Place order for user=" + request.getUserId() + " items=" + request.getItemCount();
    }
}

// ── CancelOrderCommand — receiver: OrderService ───────────────────────────────
public class CancelOrderCommand implements OrderCommand {
    private final OrderService orderService;
    private final Long         orderId;
    private       Order        cancelledOrder;  // snapshot before cancel, for undo

    @Override
    public void execute() {
        cancelledOrder = orderService.findById(orderId);   // snapshot current state
        orderService.cancelOrder(orderId);
        log.info("CancelOrderCommand.execute() orderId={}", orderId);
    }

    @Override
    public void undo() {
        // Restore order to its previous state (only if business rules allow)
        orderService.restoreOrder(cancelledOrder);
        log.info("CancelOrderCommand.undo() restored orderId={}", orderId);
    }

    @Override public String describe() { return "Cancel order orderId=" + orderId; }
}

// ── CommandHistory (Invoker) — executes, tracks, and undoes commands ──────────
@Service
public class OrderCommandHistory {
    private final Deque<OrderCommand> history = new ArrayDeque<>();
    private final AuditLogRepository  auditLog;

    public void execute(OrderCommand command) {
        command.execute();
        history.push(command);
        auditLog.record(command.describe(), "EXECUTED");  // audit trail
    }

    public void undo() {
        if (history.isEmpty()) throw new IllegalStateException("Nothing to undo");
        OrderCommand last = history.pop();
        last.undo();
        auditLog.record(last.describe(), "UNDONE");
    }

    public List<String> getHistory() {
        return history.stream().map(OrderCommand::describe).toList();
    }
}

// ── Usage: checkout flow with undo capability ─────────────────────────────────
@Service @RequiredArgsConstructor
public class CheckoutCommandService {
    private final OrderCommandHistory commandHistory;
    private final OrderService        orderService;

    public Order checkout(OrderRequest request) {
        PlaceOrderCommand cmd = new PlaceOrderCommand(orderService, request);
        commandHistory.execute(cmd);  // → place order + record in history
        return cmd.getPlacedOrder();
    }

    public void undoLastAction() {
        commandHistory.undo();        // → cancel most recent order
    }
}
```

## Ứng Dụng Thực Tế

Dùng Command cho bất kỳ UI action cần undo, bất kỳ operation nên được queue và thực thi sau, hoặc bất kỳ tập hợp operation cần transactional rollback semantics. Spring Batch Step là một Command.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Command cho phép undo/redo thế nào?</strong></summary>

**A:** Mỗi Command object implement cả `execute()` và `undo()`. Maintain hai stack: **undo stack** và **redo stack**. Khi execute command: push vào undo stack. Khi undo: pop từ undo stack, gọi `undo()`, push vào redo stack. Khi redo: pop từ redo stack, gọi `execute()`, push vào undo stack. Command phải lưu đủ state để đảo ngược — ví dụ DrawCommand lưu trước/sau color, vị trí.

</details>

<details>
<summary><strong>Vai trò của Invoker trong Command pattern?</strong></summary>

**A:** **Invoker** là object quyết định khi nào thực thi command, nhưng không biết command làm gì cụ thể — chỉ gọi `command.execute()`. Invoker tách biệt người gửi yêu cầu khỏi người thực thi. Ví dụ: Button (Invoker) giữ Command object, khi click → gọi `execute()` — Button không biết command là SaveFile hay DeleteRecord. Cho phép swap command ở runtime, queue/delay/log command, hỗ trợ undo.

</details>

<details>
<summary><strong>Làm thế nào để implement job queue với Command?</strong></summary>

**A:** Mỗi job là một Command object (implement `execute()`). Queue (LinkedBlockingQueue) giữ pending commands. Worker thread poll từ queue và gọi `execute()`. Command có thể serialize (lưu DB hoặc message queue) để survive restart. Ví dụ:
```java
BlockingQueue<Command> queue = new LinkedBlockingQueue<>();
queue.put(new SendEmailCommand(user));
queue.put(new GenerateReportCommand(params));
worker.execute(() -> { while(true) queue.take().execute(); });
```

</details>
