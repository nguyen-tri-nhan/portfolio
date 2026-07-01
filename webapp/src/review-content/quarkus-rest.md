---
key: quarkus-rest
title: RESTEasy Reactive
crumb: "8. Quarkus > RESTEasy Reactive"
---

RESTEasy Reactive là JAX-RS implementation non-blocking của Quarkus, chạy trên Vert.x event loop — hỗ trợ cả `Uni<T>` reactive và plain blocking return type, linh hoạt và performant hơn Spring MVC.

## Điểm Chính

- **RESTEasy Reactive** (extension `quarkus-rest`) chạy trên Vert.x I/O thread — không block event loop
- Standard JAX-RS annotations: `@Path`, `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`, `@Produces`, `@Consumes`
- **Return `Uni<T>`** cho async operation; plain `T` hoặc `Response` tự động chạy trên **worker thread** (blocking-safe)
- **`@Blocking`**: annotation tường minh để chạy method trên worker thread khi cần blocking I/O
- **`@RestClient`** (MicroProfile REST Client): type-safe HTTP client, interface-based — tương đương Feign/WebClient
- **`@ServerExceptionMapper`**: map exception thành HTTP response — tương đương `@ControllerAdvice` + `@ExceptionHandler`
- **`@BeanParam`**: gom nhiều `@QueryParam`, `@PathParam`, `@HeaderParam` vào một DTO class
- Path parameter validation: `@PathParam` + Bean Validation (`@NotNull`, `@Min`, v.v.) tích hợp sẵn

## Ví Dụ Code

*RESTful CRUD với Kotlin: Uni return type, REST client, exception mapper*

```kotlin
import jakarta.ws.rs.*
import jakarta.ws.rs.core.*
import jakarta.inject.Inject
import io.smallrye.mutiny.Uni
import org.eclipse.microprofile.rest.client.inject.RestClient
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient
import jakarta.enterprise.context.ApplicationScoped
import jakarta.ws.rs.ext.Provider

// ---- 1. Resource class — RESTEasy Reactive ----
@Path("/api/v1/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@ApplicationScoped  // CDI scope required for injection to work
class UserResource(
    private val userService: UserService,
    @RestClient private val notificationClient: NotificationClient
) {

    // Non-blocking: Uni — runs on Vert.x event loop
    @GET
    @Path("/{id}")
    fun getUser(@PathParam("id") id: Long): Uni<Response> =
        userService.findById(id)
            .map { user ->
                if (user != null) Response.ok(user).build()
                else Response.status(Response.Status.NOT_FOUND).build()
            }

    // Returning plain type → Quarkus assumes blocking, runs on worker thread automatically
    @POST
    fun createUser(request: CreateUserRequest): Response {
        val user = userService.create(request)  // JPA call — blocking OK here
        notificationClient.sendWelcomeEmail(user.email)  // fire-and-forget pattern
        return Response.status(Response.Status.CREATED)
            .entity(user)
            .header("Location", "/api/v1/users/${user.id}")
            .build()
    }

    @PUT
    @Path("/{id}")
    fun updateUser(@PathParam("id") id: Long, request: UpdateUserRequest): Uni<Response> =
        userService.update(id, request)
            .map { updated -> Response.ok(updated).build() }
            .onFailure(NotFoundException::class.java)
            .recoverWithItem { Response.status(404).build() }

    @DELETE
    @Path("/{id}")
    @io.quarkus.vertx.http.runtime.security.annotation.RolesAllowed("admin")
    fun deleteUser(@PathParam("id") id: Long): Response {
        userService.delete(id)
        return Response.noContent().build()
    }
}

// ---- 2. MicroProfile REST Client — type-safe HTTP client ----
@RegisterRestClient(configKey = "notification-service")
@Path("/internal/notifications")
interface NotificationClient {

    @POST
    @Path("/welcome")
    @Consumes(MediaType.APPLICATION_JSON)
    fun sendWelcomeEmail(email: String): Uni<Void>
}
// application.properties:
// quarkus.rest-client.notification-service.url=http://notification-svc:8080
// quarkus.rest-client.notification-service.scope=jakarta.inject.Singleton

// ---- 3. Global exception mapper — replaces @ControllerAdvice ----
@Provider
class GlobalExceptionMapper {

    @ServerExceptionMapper
    fun mapNotFoundException(ex: NotFoundException): Response =
        Response.status(Response.Status.NOT_FOUND)
            .entity(mapOf("error" to "Resource not found", "message" to ex.message))
            .build()

    @ServerExceptionMapper
    fun mapValidationException(ex: jakarta.validation.ConstraintViolationException): Response {
        val errors = ex.constraintViolations.map { "${it.propertyPath}: ${it.message}" }
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(mapOf("errors" to errors))
            .build()
    }
}
```

## Ứng Dụng Thực Tế

Trong microservice production, RESTEasy Reactive cho phép một Quarkus instance xử lý hàng nghìn concurrent request trên số lượng thread nhỏ nhờ non-blocking I/O — so sánh với Spring MVC mặc định dùng thread-per-request model (Tomcat). `@RestClient` đặc biệt hữu ích khi giao tiếp giữa các service nội bộ: định nghĩa interface một lần, Quarkus generate HTTP client tự động, không cần config WebClient hay RestTemplate thủ công.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>RESTEasy Reactive khác Spring MVC như thế nào về thread model?</strong></summary>

**A:** Spring MVC dùng **thread-per-request** model (Tomcat/Jetty thread pool) — mỗi HTTP request chiếm một OS thread cho toàn bộ lifecycle. RESTEasy Reactive dùng **event loop** của Vert.x — một số ít I/O thread xử lý hàng nghìn request concurrently, blocking operation được offload sang worker thread pool. Kết quả: Quarkus reactive có throughput cao hơn đáng kể ở high concurrency với ít thread hơn. Tuy nhiên, nếu method accidentally block I/O thread (không có `@Blocking`), Quarkus sẽ warn hoặc throw exception — đây là điều Spring MVC không enforce.

</details>

<details>
<summary><strong>Tại sao nên return Uni&lt;T&gt; thay vì return T trực tiếp trong RESTEasy Reactive?</strong></summary>

**A:** Return `Uni<T>` nghĩa là operation chạy **non-blocking trên Vert.x I/O thread** — không chiếm thread trong khi chờ DB hay external service. Return plain `T` vẫn work nhưng Quarkus tự động offload sang **worker thread pool** (blocking-safe nhưng tốn thread). Với `Uni<T>`, bạn có thể chain reactive operators (`map`, `flatMap`, `onFailure`) để compose complex async logic mà không callback hell. Best practice: dùng `Uni<T>` khi upstream là reactive (Panache reactive, reactive messaging); dùng plain `T` với `@Blocking` khi cần JPA blocking hoặc legacy code.

</details>

<details>
<summary><strong>@RestClient trong Quarkus hoạt động thế nào và khác Feign/WebClient ra sao?</strong></summary>

**A:** `@RestClient` là MicroProfile REST Client — bạn định nghĩa **interface với JAX-RS annotation**, Quarkus generate implementation tự động lúc build-time. Config URL qua `application.properties` (`quarkus.rest-client.[key].url`). So với Feign (Spring Cloud): cả hai đều interface-based nhưng `@RestClient` là chuẩn MicroProfile, portable hơn. So với WebClient (Spring WebFlux): WebClient là fluent builder API, cần code nhiều hơn; `@RestClient` declarative hơn và integrate tốt với Quarkus CDI, fault tolerance (MicroProfile Fault Tolerance `@Retry`, `@CircuitBreaker`).

</details>
