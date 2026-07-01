---
key: quarkus-basics
title: Quarkus Cơ Bản
crumb: "8. Quarkus > Quarkus Cơ Bản"
---

Quarkus là framework Java "supersonic subatomic" — tối ưu hoá toàn bộ framework stack tại build-time, cho phép khởi động trong mili-giây và chạy native binary với footprint cực thấp, lý tưởng cho serverless và Kubernetes.

## Điểm Chính

- **Supersonic subatomic Java**: startup ~10ms (native), ~300ms (JVM) — nhanh hơn Spring Boot 10–20x
- **Build-time optimization**: DI wiring, annotation processing, reflection metadata — tất cả xử lý lúc build thay vì runtime
- **Dev mode** (`./mvnw quarkus:dev`): hot reload tự động, continuous testing, không cần restart
- **Dev UI** (`localhost:8080/q/dev`): dashboard xem CDI bean, config, extension, health — không có trên Spring Boot
- **Extension ecosystem**: ~600+ extension tại quarkus.io/extensions — reactive, ORM, messaging, security, cloud
- **Dual mode**: JVM mode (JAR thông thường) và native mode (GraalVM binary, không cần JVM)
- **Reactive-first**: built trên Vert.x event loop + Mutiny — non-blocking từ core
- **Kotlin support**: first-class, dùng được tất cả extension, DSL thân thiện hơn Java trong nhiều trường hợp

## Ví Dụ Code

*Quarkus application cơ bản với Kotlin — REST endpoint, config injection, và health check*

```kotlin
// File: src/main/kotlin/com/example/GreetingResource.kt
import jakarta.ws.rs.GET
import jakarta.ws.rs.Path
import jakarta.ws.rs.Produces
import jakarta.ws.rs.core.MediaType
import jakarta.inject.Inject
import org.eclipse.microprofile.config.inject.ConfigProperty

@Path("/greeting")
class GreetingResource {

    // Inject config property — Quarkus wires này tại build-time
    @ConfigProperty(name = "greeting.message", defaultValue = "Hello from Quarkus!")
    lateinit var message: String

    @GET
    @Produces(MediaType.TEXT_PLAIN)
    fun hello(): String = message
}

// File: src/main/resources/application.properties
/*
  greeting.message=Xin chao tu Quarkus!

  # Dev mode only — override in %prod profile
  %dev.greeting.message=DEV: Hello!
*/

// File: build.gradle.kts (Quarkus Kotlin project)
/*
plugins {
    kotlin("jvm") version "2.0.0"
    kotlin("plugin.allopen") version "2.0.0"   // Quarkus requires open classes
    id("io.quarkus") version "3.11.0"
}

// Quarkus requires CDI beans to be non-final — allopen handles this
allOpen {
    annotation("jakarta.ws.rs.Path")
    annotation("jakarta.enterprise.context.ApplicationScoped")
    annotation("jakarta.enterprise.context.RequestScoped")
}

dependencies {
    implementation(enforcedPlatform("io.quarkus.platform:quarkus-bom:3.11.0"))
    implementation("io.quarkus:quarkus-rest")           // RESTEasy Reactive
    implementation("io.quarkus:quarkus-rest-kotlin-serialization")
    implementation("io.quarkus:quarkus-kotlin")
    implementation("io.quarkus:quarkus-smallrye-health") // /q/health endpoint
    implementation("io.quarkus:quarkus-arc")             // CDI engine
}
*/

// Chạy dev mode:
// ./gradlew quarkusDev   → hot reload bật, Dev UI tại localhost:8080/q/dev
// ./gradlew quarkusBuild → build JVM jar
// ./gradlew quarkusBuild -Dquarkus.native.enabled=true → native binary
```

## Ứng Dụng Thực Tế

Trong thực tế, Quarkus được dùng cho các microservice cần khởi động nhanh trong Kubernetes — khi pod scale up, service sẵn sàng nhận traffic trong vài trăm mili-giây thay vì chờ 5–10 giây như Spring Boot. Dev mode đặc biệt hiệu quả: save file là code hot reload ngay, continuous testing chạy test liên quan tự động — developer loop nhanh hơn đáng kể so với Spring DevTools vốn cần restart context.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Quarkus vs Spring Boot về startup time — tại sao lại khác biệt lớn như vậy?</strong></summary>

**A:** Spring Boot xử lý DI, annotation scanning, auto-configuration **tại runtime** mỗi lần khởi động — JVM phải load class, parse annotation, wire bean, khởi tạo ApplicationContext. Quarkus làm toàn bộ việc này **tại build-time**: annotation processor generate bytecode wiring sẵn, không cần reflection scan lúc start. Kết quả: Quarkus JVM ~300ms, native ~10ms; Spring Boot thường 2–5 giây. Trong Kubernetes nơi pod thường xuyên restart/scale, sự khác biệt này ảnh hưởng trực tiếp đến SLA.

</details>

<details>
<summary><strong>Build-time optimization trong Quarkus là gì và nó ảnh hưởng đến dev workflow thế nào?</strong></summary>

**A:** Build-time optimization nghĩa là Quarkus extension processor chạy lúc `mvn package` / `gradle build` để: (1) resolve và wire CDI bean, (2) pre-generate reflection metadata cho GraalVM, (3) tối ưu hoá classpath loại bỏ code không dùng. Trade-off: một số thứ linh hoạt lúc runtime của Spring không còn — ví dụ không thể tạo bean dynamically dựa trên runtime config. Đổi lại, nhờ dev mode với hot reload, developer vẫn có feedback loop nhanh mà không mất gì về trải nghiệm phát triển.

</details>

<details>
<summary><strong>Khi nào nên chọn Quarkus thay vì Spring Boot?</strong></summary>

**A:** Chọn Quarkus khi: (1) **serverless / FaaS** — Lambda, Cloud Run cần cold start nhanh; (2) **Kubernetes microservice** với nhiều pod cần startup sub-second; (3) **memory-constrained** environment — native binary dùng ~50MB RSS vs Spring ~200MB; (4) **reactive architecture** — Mutiny + Vert.x native thay vì Reactor được bolted on. Giữ Spring Boot khi: team đã quen Spring, cần Spring Data JPA/Security ecosystem đầy đủ, hoặc monolith enterprise truyền thống nơi startup time không quan trọng.

</details>
