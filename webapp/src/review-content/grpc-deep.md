---
key: grpc-deep
title: gRPC Deep Dive
crumb: 18. API & Communication > gRPC
---

gRPC dùng Protobuf để định nghĩa contract, HTTP/2 để multiplexing, và hỗ trợ 4 loại streaming — phù hợp cho internal service communication với latency thấp và strong typing.

## Điểm Chính

- **4 service types**: unary (request/response), server streaming (server gửi nhiều message), client streaming (client gửi nhiều message), bidirectional streaming (cả hai chiều).
- **Protobuf**: field numbers (không đổi khi evolution), scalar types (`string`, `int32`, `bool`), `message` nesting, `oneof` (mutual exclusive fields), `repeated` (list), well-known types (`google.protobuf.Timestamp`, `google.protobuf.Any`).
- **Interceptors**: tương tự HTTP middleware — unary interceptor và stream interceptor; chaining nhiều interceptors cho auth, logging, metrics.
- **Metadata**: key-value pairs gửi cùng request/response (tương tự HTTP headers) — dùng để propagate auth token, trace context, request ID.
- **Deadline propagation**: client đặt deadline cho toàn bộ call chain; server phải check `context.isCancelled()` và forward deadline xuống downstream — ngăn cascade failure.
- **Error model**: gRPC Status codes (`OK`, `NOT_FOUND`, `INVALID_ARGUMENT`, `UNAVAILABLE`, `DEADLINE_EXCEEDED`); rich error details dùng `google.rpc.Status` với `details` chứa typed error info.
- **Authentication**: SSL/TLS cho transport, Bearer token trong metadata cho application-level auth, mTLS cho mutual authentication giữa services.

## Ví Dụ Code

*Kotlin gRPC service với interceptor cho auth + deadline propagation + rich error handling*

```kotlin
// user.proto (tham khảo)
// service UserService {
//   rpc GetUser (GetUserRequest) returns (UserResponse);
//   rpc ListUsers (ListUsersRequest) returns (stream UserResponse);
// }

// ✅ gRPC service implementation với deadline-aware processing
@GrpcService
class UserGrpcService(
    private val userRepository: UserRepository,
    private val orderClient: OrderServiceGrpc.OrderServiceBlockingStub
) : UserServiceGrpcKt.UserServiceCoroutineImplBase() {

    // Unary RPC
    override suspend fun getUser(request: GetUserRequest): UserResponse {
        val ctx = Context.current()

        // Check deadline before expensive operation
        if (ctx.isCancelled) throw StatusException(Status.CANCELLED)

        val user = userRepository.findById(request.userId)
            ?: throw StatusException(
                Status.NOT_FOUND.withDescription("User ${request.userId} not found")
                    .asRuntimeException().let {
                        // Rich error detail
                        StatusProto.toStatusRuntimeException(
                            com.google.rpc.Status.newBuilder()
                                .setCode(Code.NOT_FOUND_VALUE)
                                .setMessage("User not found")
                                .addDetails(Any.pack(ResourceInfo.newBuilder()
                                    .setResourceType("User")
                                    .setResourceName(request.userId.toString())
                                    .build()))
                                .build()
                        )
                    }
            )

        return userResponse {
            id = user.id
            name = user.name
            email = user.email
            createdAt = user.createdAt.toProtoTimestamp()
        }
    }

    // Server streaming RPC — stream users back to client
    override fun listUsers(request: ListUsersRequest): Flow<UserResponse> = flow {
        userRepository.findAll().collect { user ->
            // Respect cancellation on each iteration
            currentCoroutineContext().ensureActive()
            emit(userResponse { id = user.id; name = user.name; email = user.email })
        }
    }
}

// ✅ Auth interceptor — validate Bearer token from metadata
@Component
class AuthInterceptor(private val jwtService: JwtService) : ServerInterceptor {

    companion object {
        val USER_ID_KEY: Context.Key<String> = Context.key("userId")
    }

    override fun <Q, R> interceptCall(
        call: ServerCall<Q, R>,
        headers: Metadata,
        next: ServerCallHandler<Q, R>
    ): ServerCall.Listener<Q> {
        val token = headers.get(Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER))
            ?.removePrefix("Bearer ")

        if (token == null || !jwtService.isValid(token)) {
            call.close(Status.UNAUTHENTICATED.withDescription("Missing or invalid token"), headers)
            return object : ServerCall.Listener<Q>() {}
        }

        val userId = jwtService.extractSubject(token)
        val ctx = Context.current().withValue(USER_ID_KEY, userId)
        return Contexts.interceptCall(ctx, call, headers, next)
    }
}

// ✅ Deadline-aware downstream call — propagate context deadline
fun callDownstreamWithDeadline(userId: Long): OrderList {
    // Deadline automatically propagated via Context if using grpc-kotlin coroutines
    // For blocking stub: derive deadline from current context
    val remainingNanos = Context.current().deadline?.timeRemaining(TimeUnit.NANOSECONDS) ?: 5_000_000_000L
    return orderClient
        .withDeadlineAfter(remainingNanos - 100_000, TimeUnit.NANOSECONDS) // subtract buffer
        .listOrders(listOrdersRequest { this.userId = userId })
}
```

## Ứng Dụng Thực Tế

Trong microservice architecture, gRPC phù hợp cho internal service-to-service communication nhờ Protobuf strong typing (compile-time contract verification) và HTTP/2 multiplexing giảm connection overhead. Deadline propagation đặc biệt quan trọng: nếu frontend đặt timeout 2 giây, các service downstream phải biết để không tiếp tục xử lý sau khi client đã timeout.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>gRPC deadline propagation là gì và tại sao quan trọng trong microservice chain?</strong></summary>

**A:** Deadline là một timestamp tuyệt đối (không phải timeout relative) mà client đặt cho toàn bộ call, tự động propagate qua gRPC context xuống các service downstream. Tầm quan trọng: nếu client A gọi service B, B gọi service C với timeout 10 giây, nhưng A chỉ đặt deadline 3 giây — nếu không propagate deadline, B và C vẫn xử lý 10 giây dù A đã bỏ đi sau 3 giây, gây waste resource. Với deadline propagation, C biết chỉ còn 2 giây và có thể fail fast hoặc return partial result. Không propagate deadline là nguyên nhân phổ biến của resource leak và cascade failure trong microservice — một service chậm làm thread pool service trên cạn kiệt. Trong Kotlin coroutines gRPC, deadline tự động propagate qua `Context`, còn blocking stub cần manual calculation.

</details>

<details>
<summary><strong>gRPC interceptor vs Spring HTTP Filter — điểm giống và khác nhau?</strong></summary>

**A:** Cả hai đều implement cross-cutting concerns (auth, logging, metrics) theo chain-of-responsibility pattern. Điểm khác: gRPC interceptor có hai loại — `ServerInterceptor` cho unary và `StreamInterceptor` cho streaming calls, vì streaming cần handle từng message trong stream chứ không chỉ request/response đơn. HTTP Filter hoạt động trên HTTP request/response là byte stream đơn giản hơn. gRPC interceptor access `Metadata` (không phải HTTP headers), `Context` để pass data giữa interceptors (tương tự Spring `SecurityContextHolder`), và `Status` cho error — khác với HTTP Filter dùng `HttpServletRequest`/`HttpServletResponse`. Chaining interceptors trong gRPC dùng `ServerInterceptors.interceptForward(service, interceptor1, interceptor2)` — thứ tự ngược với Spring Filter chain.

</details>

<details>
<summary><strong>Khi nào nên dùng bidirectional streaming thay vì unary RPC?</strong></summary>

**A:** Bidirectional streaming phù hợp khi cả client và server cần gửi nhiều message độc lập với nhau, không cần request-response pair. Use cases cụ thể: real-time collaboration (Google Docs-style), chat application, live telemetry/monitoring (client gửi metrics liên tục, server gửi alerts), interactive game state synchronization. Lưu ý quan trọng: bidi streaming phức tạp hơn nhiều — cần xử lý backpressure, half-close (client finish sending nhưng vẫn receive), error recovery, và reconnection logic. Với trường hợp đơn giản như push notification một chiều, server streaming là đủ và dễ implement hơn. Unary RPC nên là lựa chọn mặc định; chỉ dùng streaming khi cần thiết thực sự vì tăng độ phức tạp đáng kể ở cả client lẫn server.

</details>
