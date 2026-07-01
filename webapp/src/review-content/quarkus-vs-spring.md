---
key: quarkus-vs-spring
title: Quarkus vs Spring Boot
crumb: "8. Quarkus > Quarkus Cơ Bản"
---

Quarkus và Spring Boot là hai framework Java backend phổ biến nhất hiện nay — Quarkus tối ưu cho cloud-native và serverless với startup cực nhanh, trong khi Spring Boot dẫn đầu về ecosystem và enterprise adoption.

## Điểm Chính

- **Startup time**: Quarkus native ~10ms, JVM ~300ms vs Spring Boot ~2–5s — nhờ build-time DI và AOT
- **Memory footprint**: Quarkus native ~50MB RSS, JVM ~200MB vs Spring Boot ~200–400MB
- **DI model**: Quarkus dùng **CDI** (Jakarta EE standard, build-time wiring) vs Spring **proprietary IoC** (runtime reflection)
- **Developer experience**: Quarkus dev mode + Dev UI + continuous testing vs Spring DevTools (restart-based reload)
- **Reactive**: Quarkus reactive-first (Mutiny + Vert.x native) vs Spring WebFlux (Reactor, bolted onto Spring MVC)
- **Ecosystem maturity**: Spring ecosystem (~20 năm, Spring Data, Security, Cloud rất mature) vs Quarkus (~2019, growing fast)
- **Kotlin support**: cả hai đều first-class; Quarkus cần `allOpen` plugin; Spring cần `kotlin-spring` compiler plugin
- **Production use case**: Quarkus cho serverless/k8s/edge computing; Spring Boot cho enterprise monolith và broad ecosystem needs

## Ví Dụ Code

*Side-by-side comparison: cùng một REST endpoint trong Quarkus (Kotlin) vs Spring Boot (Kotlin)*

```kotlin
// ============================================================
// QUARKUS APPROACH (Kotlin + RESTEasy Reactive + Panache)
// ============================================================
import jakarta.ws.rs.*
import jakarta.ws.rs.core.*
import jakarta.enterprise.context.ApplicationScoped
import io.smallrye.mutiny.Uni
import io.quarkus.hibernate.reactive.panache.PanacheRepository
import jakarta.transaction.Transactional
import org.eclipse.microprofile.config.inject.ConfigProperty

@Path("/api/products")
@Produces(MediaType.APPLICATION_JSON)
@ApplicationScoped
class ProductResource(
    private val productRepository: ProductRepository
) {

    @GET
    fun listAll(): Uni<List<Product>> =
        productRepository.listAll()                // Non-blocking, Vert.x I/O thread

    @POST
    @Transactional
    fun create(product: Product): Uni<Response> =
        productRepository.persist(product)
            .map { saved ->
                Response.status(201).entity(saved).build()
            }
}

@ApplicationScoped
class ProductRepository : PanacheRepository<Product> {
    fun findByCategoryActive(category: String): Uni<List<Product>> =
        list("category = ?1 AND active = ?2", category, true)
}
```

```kotlin
// ============================================================
// SPRING BOOT APPROACH (Kotlin + Spring MVC + Spring Data JPA)
// ============================================================
import org.springframework.web.bind.annotation.*
import org.springframework.http.ResponseEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

@RestController
@RequestMapping("/api/products")
class ProductController(private val productRepository: ProductRepository) {

    @GetMapping
    fun listAll(): List<Product> =
        productRepository.findAll()                // Blocking, Tomcat thread

    @PostMapping
    @Transactional
    fun create(@RequestBody product: Product): ResponseEntity<Product> {
        val saved = productRepository.save(product)
        return ResponseEntity.status(201).body(saved)
    }
}

@Repository
interface ProductRepository : JpaRepository<Product, Long> {
    @Query("SELECT p FROM Product p WHERE p.category = :category AND p.active = true")
    fun findByCategoryActive(category: String): List<Product>
    // Method name convention: findByCategoryAndActiveTrue(category) cũng work
}

// Key differences trong code:
// Quarkus: @Path + JAX-RS, Uni<T> reactive, Panache query DSL
// Spring:  @RestController + Spring MVC, blocking return, Spring Data JPA @Query
// Annotation set hoàn toàn khác nhau — không portable giữa 2 framework
```

```
# Performance benchmark comparison (approximate, Spring Boot 3 vs Quarkus 3):
#
# Metric              | Quarkus Native | Quarkus JVM | Spring Boot 3 (JVM)
# --------------------|----------------|-------------|--------------------
# Startup time        | ~10ms          | ~300ms      | ~2,000ms
# RSS memory          | ~50MB          | ~200MB      | ~250MB
# Throughput (steady) | ~90% of JVM    | ~100%       | ~100%
# Build time          | 3–5 min        | ~30s        | ~30s
# Docker image size   | ~150MB         | ~400MB      | ~500MB
# Developer hot reload| <1s (dev mode) | <1s         | ~5s (DevTools)
```

## Ứng Dụng Thực Tế

Trong thực tế, Quarkus được dùng cho các **microservice stateless** (webhook handler, report processor, notification sender) chạy trên Kubernetes với autoscaling — startup nhanh giúp scale event đáp ứng burst traffic. Spring Boot vẫn được dùng cho core monolith và service cần Spring Security OAuth2, Spring Batch — nơi Spring ecosystem depth là lợi thế lớn. Thực tế nhiều team dùng **cả hai**: Quarkus cho service mới cloud-native, Spring Boot cho legacy service cần migrate dần dần.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào nên chọn Quarkus, khi nào chọn Spring Boot trong một dự án mới?</strong></summary>

**A:** Chọn **Quarkus** khi: serverless/FaaS cần cold start nhanh, Kubernetes microservice với aggressive autoscaling, memory-constrained environment (nhiều service trên ít node), team muốn reactive-first architecture với Mutiny/Vert.x, hoặc cần native binary. Chọn **Spring Boot** khi: team đã có Spring expertise và muốn đi nhanh, cần Spring ecosystem depth (Security OAuth2, Spring Batch, Spring Data JDBC), enterprise integration pattern (Spring Integration), hoặc monolith lớn nơi startup time không quan trọng. Rule of thumb: **new microservice trên K8s → Quarkus; enterprise app với phức tạp business logic → Spring Boot**.

</details>

<details>
<summary><strong>Migration từ Spring Boot sang Quarkus — những thách thức nào cần lưu ý?</strong></summary>

**A:** Thách thức chính: (1) **Annotation migration** — `@RestController` → `@Path`, `@Service` → `@ApplicationScoped`, `@Repository` → `PanacheRepository` — không 1:1 mapping; (2) **Spring Data JPA** → Panache — query method naming convention khác; (3) **Spring Security** → Quarkus Security/OIDC — config khác hoàn toàn; (4) **Spring AOP** → CDI Interceptor — limitation về private method, proxy; (5) **Testing** — `@MockBean` → `@InjectMock`, TestRestTemplate → RestAssured. Approach tốt nhất: migrate service-by-service, không migrate monolith một lần. Bắt đầu với service stateless đơn giản để team làm quen trước khi tackle service phức tạp.

</details>

<details>
<summary><strong>Quarkus + Kotlin có ưu điểm gì so với Quarkus + Java hoặc Spring Boot + Kotlin?</strong></summary>

**A:** Quarkus + Kotlin là combo mạnh vì: (1) **Data class** thay DTO boilerplate — `data class UserDto(val id: Long, val email: String)` thay vì Java class với getter/setter/builder; (2) **Extension function** để enrich Panache entity mà không modify entity class; (3) **Sealed class + when** thay Pattern Factory với reflection — native-image safe; (4) **Coroutine** support (experimental) với Mutiny bridge — `Uni.await().indefinitely()` trong test context; (5) **Null safety** tích hợp tốt với Quarkus CDI (dùng `lateinit var` cho inject). So với Spring Boot + Kotlin: trải nghiệm tương đương nhưng Quarkus dev mode nhanh hơn và startup production nhanh hơn đáng kể — Kotlin + Quarkus là lựa chọn tốt cho team muốn modern JVM stack.

</details>
