---
key: "Routing Keys"
title: "Routing Key"
crumb: "6. Messaging › RabbitMQ"
---

Routing key là chuỗi gắn vào message mà exchange dùng (cùng binding) để quyết định queue nào nhận message.

## Điểm Chính

- Định dạng: quy ước từ phân cách bằng dấu chấm: <code>order.created</code>, <code>payment.failed</code>.
- Direct exchange: routing key binding phải khớp chính xác routing key message.
- Topic exchange: binding pattern có thể dùng <code>*</code> (một từ) và <code>#</code> (không hoặc nhiều từ).
- Fanout exchange: routing key bị bỏ qua.
- Headers exchange: routing dựa trên message header, không phải routing key.

## Ví Dụ Code

*Routing key taxonomy: domain.entity.action; wildcard patterns; multi-queue fan-out*

```java
// Routing key taxonomy: domain.entity.action
// Allows fine-grained subscriptions with topic exchange

// Routing key examples:
// order.created       → new order placed
// order.shipped       → shipment dispatched
// order.item.added    → item added to existing order
// payment.processed   → payment succeeded
// payment.failed      → payment declined
// user.registered     → new user signup

// Pattern matching on topic exchange:
// "order.*"    → order.created ✓  order.shipped ✓  order.item.added ✗ (3 words)
// "order.#"    → order.created ✓  order.shipped ✓  order.item.added ✓ (any depth)
// "#.failed"   → payment.failed ✓  order.failed ✓  any.thing.failed ✓
// "#"          → ALL events (audit log pattern)

// Subscribe to specific event types with annotation:
@RabbitListener(bindings = @QueueBinding(
    value   = @Queue("payment-failure-queue"),
    exchange = @Exchange(value = "app.exchange", type = ExchangeTypes.TOPIC),
    key     = "payment.failed"   // exact: only payment.failed events
))
public void onPaymentFailed(PaymentFailedEvent event) {
    orderService.handlePaymentFailure(event.getOrderId());
    refundService.initiateRefund(event.getOrderId(), event.getAmount());
}

// Subscribe to all order events (inventory service needs all lifecycle events):
@RabbitListener(bindings = @QueueBinding(
    value   = @Queue("inventory-order-queue"),
    exchange = @Exchange(value = "app.exchange", type = ExchangeTypes.TOPIC),
    key     = "order.#"    // wildcard: order.created, order.cancelled, order.returned, etc.
))
public void onAnyOrderEvent(OrderEvent event) {
    inventoryService.syncStock(event);
}

// One message → multiple queues if multiple bindings match:
// publish "order.created" → matches order.# (order-queue) AND # (audit-queue)
```

## Ứng Dụng Thực Tế

Thiết kế taxonomy routing key từ đầu: pattern <code>domain.entity.action</code> hoạt động tốt. Điều này cho phép downstream service subscribe chính xác event chúng quan tâm với topic binding pattern.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Routing key trong RabbitMQ direct exchange là gì?</strong></summary>

**A:** Routing key là string label producer gắn vào message. Direct exchange so sánh routing key với binding key của queue (exact match). Queue binding: `channel.queueBind(queue, exchange, bindingKey)`. Producer publish: `channel.basicPublish(exchange, routingKey, ..., body)`. Nếu `routingKey == bindingKey` → message route đến queue đó. Một queue có thể bind với nhiều binding keys. Routing key khác binding key → message bị discard (hoặc route đến alternate exchange). Use case: `error.order`, `info.order` → route tới queue khác nhau.

</details>

<details>
<summary><strong>Topic exchange routing pattern thế nào?</strong></summary>

**A:** Topic exchange dùng pattern matching với wildcards trong binding key: `*` match đúng **một word**, `#` match **zero hoặc nhiều word** (word = ký tự giữa các dấu chấm). Ví dụ binding keys: `*.order.error` match `app.order.error` nhưng không match `order.error`. `logs.#` match `logs`, `logs.app`, `logs.app.error`. Producer routing key: `payment.order.failure` → route đến queue bind với `payment.#` và `*.order.*`. Dùng: multi-level categorization — application + module + severity.

</details>

<details>
<summary><strong>Headers exchange hoạt động thế nào?</strong></summary>

**A:** Headers exchange ignore routing key — route dựa trên **message headers** (key-value pairs). Queue binding specify `x-match` (`all` hoặc `any`) + header conditions. `x-match=all`: tất cả header điều kiện phải match. `x-match=any`: ít nhất một header match. Ví dụ: queue bind `{x-match: all, format: pdf, type: report}` → chỉ message có cả `format=pdf` và `type=report` được route. Linh hoạt hơn routing key nhưng overhead cao hơn (parse headers). Ít dùng hơn direct/topic trong thực tế.

</details>
