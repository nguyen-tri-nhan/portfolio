---
key: websocket-sse
title: WebSocket & SSE
crumb: 18. API & Communication > Real-time
---

SSE và WebSocket là hai cơ chế real-time phổ biến nhất — SSE đơn giản cho push notification một chiều, WebSocket cho giao tiếp hai chiều full-duplex như chat và collaboration.

## Điểm Chính

- **Comparison table**: HTTP Polling (đơn giản, lãng phí), Long Polling (ít request hơn, vẫn overhead), SSE (server push, HTTP/1.1), WebSocket (full-duplex, protocol riêng).
- **SSE (Server-Sent Events)**: unidirectional server→client qua HTTP; `Content-Type: text/event-stream`; tự động reconnect với `Last-Event-ID`; hỗ trợ named event types; không cần special protocol.
- **WebSocket**: full-duplex bidirectional; handshake bắt đầu bằng HTTP `Upgrade: websocket` rồi switch sang `ws://`/`wss://` protocol; persistent connection.
- **Khi nào dùng SSE**: notification, activity feed, live dashboard, progress updates — khi chỉ cần server→client push và muốn đơn giản hơn WebSocket.
- **Khi nào dùng WebSocket**: chat, collaborative editing, multiplayer game, trading terminal — khi client cũng cần gửi message thường xuyên đến server.
- **Scaling WebSocket**: stateful connection — cần sticky session (load balancer route cùng client đến cùng server) hoặc pub/sub (Redis Pub/Sub broadcast message đến tất cả server instances).
- **Spring WebSocket + STOMP**: `@MessageMapping` xử lý message từ client; `SimpMessagingTemplate` để gửi từ server; topic/queue destinations (`/topic/room`, `/queue/user`).

## Ví Dụ Code

*Spring Boot SSE với Flux + WebSocket handler + Redis pub/sub cho multi-instance scaling*

```java
// ✅ SSE endpoint — server-sent events cho notification feed
@RestController
@RequestMapping("/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    // Client connect: GET /v1/notifications/stream
    // Response: Content-Type: text/event-stream
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<NotificationDto>> streamNotifications(
            @AuthenticationPrincipal UserDetails user,
            @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {

        return notificationService.getStream(user.getUsername(), lastEventId)
                .map(notification -> ServerSentEvent.<NotificationDto>builder()
                        .id(notification.getId().toString())   // client dùng để resume
                        .event("notification")                 // named event type
                        .data(notification)
                        .build())
                .doOnError(e -> log.error("SSE stream error for {}", user.getUsername(), e));
    }
}

// ✅ WebSocket config + STOMP — for bidirectional chat
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable Redis-backed message broker for multi-instance support
        config.enableStompBrokerRelay("/topic", "/queue")
                .setRelayHost("localhost").setRelayPort(61613);  // STOMP over Redis/RabbitMQ
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();  // SockJS fallback for environments blocking WebSocket
    }
}

@Controller
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;

    // Client sends to /app/chat.send → broadcast to /topic/room/{roomId}
    @MessageMapping("/chat.send/{roomId}")
    public void handleMessage(@DestinationVariable String roomId,
                               @Payload ChatMessage message,
                               @Header("simpSessionId") String sessionId) {

        ChatMessageDto response = ChatMessageDto.builder()
                .content(message.getContent())
                .sender(message.getSender())
                .roomId(roomId)
                .timestamp(Instant.now())
                .build();

        // Broadcast to all subscribers of this topic (across all server instances via Redis)
        messagingTemplate.convertAndSend("/topic/room/" + roomId, response);
    }

    // Send to specific user: /queue/reply — private message
    @MessageMapping("/chat.private")
    public void handlePrivate(@Payload PrivateMessage message,
                               Principal principal) {
        messagingTemplate.convertAndSendToUser(
                message.getRecipient(), "/queue/reply",
                new ChatMessageDto(message.getContent(), principal.getName(), Instant.now())
        );
    }
}

// ✅ Redis pub/sub for scaling SSE across multiple instances
@Service
public class NotificationService {

    private final Sinks.Many<NotificationDto> sink = Sinks.many().multicast().onBackpressureBuffer();
    private final ReactiveRedisOperations<String, NotificationDto> redisOps;

    @PostConstruct
    public void subscribeToRedis() {
        // Each instance subscribes to Redis channel → fan-out to local SSE streams
        redisOps.listenToChannel("notifications")
                .map(ReactiveSubscription.Message::getMessage)
                .subscribe(sink::tryEmitNext);
    }

    public Flux<NotificationDto> getStream(String userId, String lastEventId) {
        return sink.asFlux()
                .filter(n -> n.getTargetUserId().equals(userId));
    }

    public void publish(NotificationDto notification) {
        // Publish to Redis → all instances receive and push to their connected SSE clients
        redisOps.convertAndSend("notifications", notification).subscribe();
    }
}
```

## Ứng Dụng Thực Tế

Trong hệ thống order tracking, SSE phù hợp để push trạng thái đơn hàng đến customer browser — đơn giản, không cần WebSocket overhead, tự reconnect khi mất kết nối. Với multi-instance deployment, Redis pub/sub đảm bảo mọi server instance đều nhận và forward event đến clients đang kết nối với chúng.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>SSE vs WebSocket — khi nào dùng cái nào và trade-offs là gì?</strong></summary>

**A:** SSE là lựa chọn tốt hơn khi chỉ cần server→client push: đơn giản hơn (plain HTTP, không cần special library), tự động reconnect với `Last-Event-ID`, hoạt động qua HTTP/2 multiplexing, và dễ debug hơn (visible trong browser DevTools Network tab). WebSocket cần thiết khi client phải gửi data thường xuyên đến server (chat, collaborative editing, game) vì với SSE, client gửi data sẽ cần dùng separate HTTP request. Trade-offs quan trọng: WebSocket là persistent TCP connection nên cần nhiều file descriptor hơn trên server, không tương thích tốt với một số proxy/firewall cũ (vì thế có SockJS fallback), và load balancer cần sticky session hoặc pub/sub. SSE chỉ có giới hạn 6 connections per domain trên HTTP/1.1 (giải quyết bằng HTTP/2). Nguyên tắc: dùng SSE trước, chỉ chuyển sang WebSocket khi thực sự cần bidirectional communication.

</details>

<details>
<summary><strong>Làm thế nào scale WebSocket khi có nhiều server instance?</strong></summary>

**A:** WebSocket là stateful — connection của client gắn với một server instance cụ thể. Khi scale horizontal, có hai chiến lược: (1) Sticky session (session affinity): load balancer route cùng client IP đến cùng server instance — đơn giản nhưng vẫn single point of failure nếu server đó crash, và cân bằng tải không đều. (2) Message broker pub/sub: mỗi server subscribe một Redis channel (hoặc RabbitMQ, Kafka topic); khi một server nhận message từ client, publish lên broker → tất cả servers nhận và forward đến clients đang kết nối với mình. Spring STOMP + `enableStompBrokerRelay()` với RabbitMQ là giải pháp production-grade cho pattern này. Cách (2) phức tạp hơn nhưng không có single point of failure và scale tốt hơn. Trong Kubernetes, còn có thể dùng operator như Socket.IO adapter hoặc Centrifuge để quản lý connection state distributed.

</details>

<details>
<summary><strong>WebSocket connection handling khi server restart — làm thế nào để client reconnect gracefully?</strong></summary>

**A:** Khi server restart, tất cả WebSocket connections bị drop. Client cần implement reconnection logic: exponential backoff (1s, 2s, 4s, 8s... đến max 30s) để tránh thundering herd khi server restart; jitter thêm random delay để phân tán reconnect requests. Server nên gửi heartbeat ping (`ping/pong` trong WebSocket protocol) theo định kỳ để detect dead connections nhanh hơn OS TCP timeout. Trước khi shutdown, server nên gửi close frame với status code 1001 (Going Away) để client biết reconnect — khác với code 1000 (Normal Closure) cho biết đóng có chủ đích. Về state recovery: sau reconnect, client cần re-subscribe vào các channels cần thiết và nếu cần state continuity (như chat history), gửi `Last-Event-ID` hoặc sequence number để server biết missed messages. SockJS và nhiều WebSocket libraries có sẵn reconnection logic với exponential backoff.

</details>
