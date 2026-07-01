---
key: "RabbitMQ"
title: "RabbitMQ"
crumb: "6. Messaging"
---

RabbitMQ là message broker implement AMQP, dùng Exchange để route message đến Queue qua Binding linh hoạt — đơn giản hơn Kafka cho task queue và routing.

## Điểm Chính

- Core: Producer → <strong>Exchange</strong> → (Binding) → <strong>Queue</strong> → Consumer.
- Loại Exchange: <code>direct</code> (routing key exact), <code>topic</code> (wildcard), <code>fanout</code> (broadcast), <code>headers</code>.
- Message push-based: RabbitMQ đẩy đến consumer. Kafka là pull-based.
- Acknowledgement: <code>basic.ack</code> (đã xử lý), <code>basic.nack</code> (requeue hoặc DLQ).
- Dead Letter Exchange (DLX): message thất bại đi vào DLX → DLQ để kiểm tra.

## Ví Dụ Code

*RabbitMQ: topic exchange + DLQ config + publisher + manual-ack consumer*

```java
// RabbitMQ: full config with DLQ for order-events
@Configuration
public class RabbitMQConfig {

    // Main exchange: topic type → flexible routing by event type
    @Bean
    public TopicExchange orderExchange() {
        return ExchangeBuilder.topicExchange("order.exchange").durable(true).build();
    }

    // Dead-letter exchange: receives rejected/expired messages
    @Bean
    public DirectExchange deadLetterExchange() {
        return ExchangeBuilder.directExchange("order.dlx").durable(true).build();
    }

    // Main queue: bound to DLX so failed messages auto-route to DLQ
    @Bean
    public Queue orderQueue() {
        return QueueBuilder.durable("order.queue")
            .withArgument("x-dead-letter-exchange", "order.dlx")
            .withArgument("x-dead-letter-routing-key", "order.dead")
            .withArgument("x-message-ttl", 30_000)   // 30s TTL before → DLQ
            .build();
    }

    // DLQ: stores failed messages for investigation and replay
    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable("order.dlq").build();
    }

    @Bean public Binding orderBinding() {
        return BindingBuilder.bind(orderQueue()).to(orderExchange()).with("order.#");
    }
    @Bean public Binding dlqBinding() {
        return BindingBuilder.bind(deadLetterQueue()).to(deadLetterExchange()).with("order.dead");
    }
}

// Publisher: send order-created event
@Service @RequiredArgsConstructor
public class OrderEventPublisher {
    private final RabbitTemplate rabbitTemplate;

    public void publishOrderCreated(OrderCreatedEvent event) {
        rabbitTemplate.convertAndSend("order.exchange", "order.created", event,
            msg -> { msg.getMessageProperties().setContentType("application/json"); return msg; });
        log.info("Published order.created for orderId={}", event.getOrderId());
    }
}

// Consumer: manual ack with nack→DLQ on failure
@RabbitListener(queues = "order.queue")
public void onOrderCreated(OrderCreatedEvent event, Channel channel,
        @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
    try {
        orderService.process(event);
        channel.basicAck(deliveryTag, false);          // success: ack
    } catch (NonRecoverableException e) {
        channel.basicNack(deliveryTag, false, false);  // failure: nack → DLQ (requeue=false)
    }
}
```

## Ứng Dụng Thực Tế

Dùng RabbitMQ cho: task queue, request-reply pattern, routing phức tạp theo type/attribute, throughput nhỏ-vừa. Dùng Kafka cho: event streaming, audit log, replay, cross-team event bus, throughput cao.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Exchange types trong RabbitMQ là gì?</strong></summary>

**A:** (1) **Direct**: route message theo routing key exact match — queue bind với binding key, message chỉ đến queue có binding key = routing key. (2) **Topic**: routing key là pattern (word.word) với wildcards `*` (một word) và `#` (zero hoặc nhiều word) — `logs.*.error` match `logs.app.error`. (3) **Fanout**: broadcast tất cả message đến mọi bound queue — ignore routing key. (4) **Headers**: route theo header attributes thay vì routing key. Dùng: Direct cho task queue, Fanout cho pub/sub, Topic cho flexible routing.

</details>

<details>
<summary><strong>Đảm bảo message không bị mất trong RabbitMQ thế nào?</strong></summary>

**A:** Ba lớp bảo vệ: (1) **Publisher confirms**: `channel.confirmSelect()` → broker ack khi message được persist. (2) **Durable queue + persistent message**: queue với `durable=true` survive broker restart; message với `deliveryMode=2` (persistent). (3) **Consumer ack**: `autoAck=false` → consumer gọi `channel.basicAck()` sau khi xử lý xong — nếu consumer die trước khi ack, message requeue. Không ack → message không bị xóa khỏi queue. **Dead Letter Exchange (DLX)**: message không xử lý được → route đến DLX queue để analyze.

</details>

<details>
<summary><strong>Prefetch count ảnh hưởng consumer thế nào?</strong></summary>

**A:** `channel.basicQos(prefetchCount)` — giới hạn số message broker gửi trước khi consumer ack. Mặc định: không giới hạn → broker dump tất cả message vào consumer buffer → một consumer chậm nhận hết message, consumer khác idle. **prefetchCount=1**: broker chỉ gửi message mới khi consumer ack message trước — fair dispatch. **prefetchCount=10**: cân bằng giữa throughput và fair dispatch. Với multiple consumer: `basicQos(10)` cả hai consumers → mỗi consumer max 10 unacked message, load được balance tốt hơn.

</details>
