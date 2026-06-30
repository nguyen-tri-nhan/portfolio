---
key: "Exchange / Queue / Binding"
title: "Exchange, Queue & Binding"
crumb: "6. Messaging › RabbitMQ"
---

Trong RabbitMQ, producer gửi đến Exchange (không trực tiếp vào queue); Exchange route đến Queue qua Binding dùng routing key và rule.

## Điểm Chính

- <strong>Exchange</strong>: nhận message từ producer. Không lưu trữ message.
- <strong>Queue</strong>: lưu message cho đến khi được consume. Tồn tại sau restart nếu durable.
- <strong>Binding</strong>: rule kết nối exchange với queue. Chỉ định routing key pattern.
- <strong>Direct</strong>: khớp chính xác trên routing key.
- <strong>Topic</strong>: khớp wildcard. <code>order.#</code> khớp <code>order.created</code>, <code>order.shipped</code>. <code>*</code> = một từ, <code>#</code> = không hoặc nhiều từ.
- <strong>Fanout</strong>: bỏ qua routing key, broadcast đến TẤT CẢ queue đã bind.

## Ví Dụ Code

*Exchange types: topic wildcard, fanout broadcast, direct priority routing với DLX*

```java
// Exchange types demo: order-events domain

// 1. TOPIC exchange: wildcard routing — most flexible
@Bean TopicExchange appExchange() {
    return ExchangeBuilder.topicExchange("app.exchange").durable(true).build();
}
// Bindings:
// "order.#"   → order-queue     (matches order.created, order.shipped, order.item.added)
// "payment.#" → payment-queue   (matches payment.processed, payment.failed)
// "#"         → audit-queue     (matches EVERYTHING — full audit log)
@Bean Binding orderBinding(Queue orderQueue, TopicExchange appExchange) {
    return BindingBuilder.bind(orderQueue).to(appExchange).with("order.#");
}

// 2. FANOUT exchange: broadcast to ALL queues — ignore routing key
// Use case: broadcast OrderCreatedEvent to email, SMS, push notification
@Bean FanoutExchange notificationExchange() {
    return ExchangeBuilder.fanoutExchange("notification.fanout").durable(true).build();
}
rabbitTemplate.convertAndSend("notification.fanout", "", notifyEvent);
// → delivered to email-queue, sms-queue, push-queue simultaneously

// 3. DIRECT exchange: exact routing key match
// Use case: priority-based routing (high-priority orders go to dedicated queue)
@Bean DirectExchange priorityExchange() {
    return ExchangeBuilder.directExchange("order.priority").durable(true).build();
}
// "high" → high-priority-queue (handled by dedicated fast consumers)
// "low"  → low-priority-queue  (handled by batch consumers)
rabbitTemplate.convertAndSend("order.priority", "high", vipOrderEvent);

// Queue durability: survives broker restart
// x-dead-letter-exchange: failed messages auto-route to DLQ
@Bean Queue orderQueue() {
    return QueueBuilder.durable("order.queue")
        .withArgument("x-dead-letter-exchange", "order.dlx").build();
}
```

## Ứng Dụng Thực Tế

Dùng direct exchange cho phân phối task đơn giản. Dùng topic cho routing theo loại event (order.created, order.shipped). Dùng fanout cho publish đến nhiều consumer đồng thời (ví dụ: notification). Thêm dead-letter exchange vào mọi queue để bắt message thất bại.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa direct và topic exchange là gì?
1. Điều gì xảy ra với message nếu không có queue nào bind để khớp routing key?
1. Làm thế nào để implement pub/sub pattern trong RabbitMQ?
