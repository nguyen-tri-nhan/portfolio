---
key: quarkus-cdi
title: Quarkus CDI & Dependency Injection
crumb: "8. Quarkus > Quarkus Cơ Bản"
---

Quarkus dùng CDI (Contexts and Dependency Injection) chuẩn Jakarta EE, xử lý toàn bộ bean wiring tại build-time thay vì runtime — nhanh hơn và an toàn hơn Spring's reflection-based DI.

## Điểm Chính

- **@ApplicationScoped**: singleton per application, lazy-initialized (khác Spring `@Service` là eager by default)
- **@RequestScoped**: một instance per HTTP request, tự destroy sau request
- **@SessionScoped**: per session (ít dùng trong REST API, cần session support)
- **@Dependent**: default scope — một instance mới mỗi lần inject, lifecycle gắn với bean sở hữu nó
- **@Inject**: CDI standard injection — field, constructor, setter đều hỗ trợ
- **@Produces**: factory method để tạo bean không có CDI annotation (third-party class)
- **Interceptors**: `@Interceptor` + `@InterceptorBinding` + `@AroundInvoke` — tương đương Spring AOP nhưng standard hơn
- **@Transactional**: từ `jakarta.transaction` — Quarkus auto-integrate với Hibernate, không cần Spring `@EnableTransactionManagement`

## Ví Dụ Code

*CDI scopes, interceptor custom logging, và @Produces cho third-party integration trong Kotlin*

```kotlin
import jakarta.enterprise.context.ApplicationScoped
import jakarta.enterprise.context.RequestScoped
import jakarta.enterprise.inject.Produces
import jakarta.inject.Inject
import jakarta.interceptor.*
import jakarta.transaction.Transactional
import io.quarkus.logging.Log

// ---- 1. ApplicationScoped service — singleton, lazy-init ----
@ApplicationScoped
class UserService(
    private val userRepository: UserRepository  // Constructor injection — Kotlin-idiomatic
) {
    @Transactional  // Quarkus tự manage transaction qua Narayana JTA
    fun createUser(name: String, email: String): User {
        val user = User(name = name, email = email)
        userRepository.persist(user)
        return user
    }
}

// ---- 2. RequestScoped — per-request context holder ----
@RequestScoped
class RequestContext {
    var currentUserId: Long? = null
    var traceId: String = java.util.UUID.randomUUID().toString()
}

// ---- 3. Custom Interceptor — annotation-driven logging ----
// Step 1: Define the binding annotation
@InterceptorBinding
@Target(AnnotationTarget.CLASS, AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class Logged

// Step 2: Implement the interceptor
@Logged
@Interceptor
@Priority(Interceptor.Priority.APPLICATION)
class LoggingInterceptor {

    @AroundInvoke
    fun logInvocation(ctx: InvocationContext): Any? {
        val method = "${ctx.method.declaringClass.simpleName}.${ctx.method.name}"
        Log.infof(">>> %s called with %d args", method, ctx.parameters.size)
        val start = System.currentTimeMillis()
        return try {
            val result = ctx.proceed()
            Log.infof("<<< %s completed in %dms", method, System.currentTimeMillis() - start)
            result
        } catch (e: Exception) {
            Log.errorf(e, "<<< %s FAILED", method)
            throw e
        }
    }
}

// Step 3: Apply to any bean or method
@ApplicationScoped
@Logged  // Apply to all methods in class
class PaymentService {
    fun processPayment(amount: Double): String = "OK"
}

// ---- 4. @Produces — wrap third-party class as CDI bean ----
@ApplicationScoped
class InfrastructureProducer {

    @Produces
    @ApplicationScoped
    fun objectMapper(): com.fasterxml.jackson.databind.ObjectMapper =
        com.fasterxml.jackson.databind.ObjectMapper().apply {
            findAndRegisterModules()  // Register Kotlin module, JavaTime, etc.
        }
}

// Inject nó ở nơi khác như bean bình thường:
// @Inject lateinit var objectMapper: ObjectMapper
```

## Ứng Dụng Thực Tế

Trong thực tế, `@ApplicationScoped` được dùng cho service layer (stateless, singleton), `@RequestScoped` cho request context chứa auth info (user ID, tenant ID) để propagate xuyên suốt call stack mà không cần truyền parameter. Interceptor pattern được dùng cho cross-cutting concern như audit logging và rate limiting — sạch hơn nhiều so với dùng Spring AOP với `@Aspect` vì interceptor CDI standard, không cần proxy subclass generation phức tạp.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>@ApplicationScoped trong Quarkus vs @Service trong Spring Boot khác nhau như thế nào?</strong></summary>

**A:** Cả hai đều tạo singleton, nhưng khác ở khởi tạo và proxying. Spring `@Service` là **eager singleton** — được tạo khi ApplicationContext start. Quarkus `@ApplicationScoped` là **lazy-initialized client proxy** — Quarkus tạo một proxy wrapper; bean thực sự chỉ khởi tạo lần đầu tiên được gọi. Điều này cho phép circular dependency được xử lý và bean có thể "replaced" trong testing. Ngoài ra, Quarkus xử lý wiring tại build-time nên không có reflection scan lúc runtime như Spring.

</details>

<details>
<summary><strong>@Dependent scope trong CDI hoạt động thế nào và khi nào dùng?</strong></summary>

**A:** `@Dependent` là scope mặc định trong CDI — mỗi điểm inject nhận một **instance riêng biệt**, và instance đó có lifecycle gắn với bean sở hữu nó (nếu owner bị destroy, dependent cũng bị destroy). Dùng khi: bean là stateful và phải unique per injector (ví dụ: builder pattern, command object), hoặc khi bạn muốn bean không bị shared. Ngược lại với Spring không có concept này — Spring default là singleton, và để có behavior tương tự phải dùng `@Scope("prototype")`.

</details>

<details>
<summary><strong>Interceptor trong Quarkus CDI vs Spring AOP — khi nào dùng cái nào?</strong></summary>

**A:** CDI Interceptor trong Quarkus là **Jakarta EE standard** — portable, không cần Spring, hoạt động trong native image. Spring AOP dùng **dynamic proxy** hoặc **AspectJ weaving** — linh hoạt hơn (có thể target field, constructor) nhưng phức tạp hơn. Trong Quarkus, interceptor chỉ work trên CDI bean methods (không phải private method, không phải static), đây là constraint quan trọng. Best practice trong Quarkus: dùng `@Interceptor` cho cross-cutting concern như logging, metrics, caching; dùng `@Transactional` (đã là interceptor ngầm) cho transaction management. Không cần import Spring AOP dependency.

</details>
