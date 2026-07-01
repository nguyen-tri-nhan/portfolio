---
key: quarkus-native
title: Native Image & GraalVM
crumb: "8. Quarkus > Native & Performance"
---

GraalVM Native Image compile Java/Kotlin sang native binary thông qua AOT (Ahead-of-Time) compilation — không cần JVM lúc runtime, startup ~10ms, RSS ~50MB, lý tưởng cho serverless và ephemeral container.

## Điểm Chính

- **AOT compilation**: toàn bộ code compile sang machine code lúc build — không có JIT, không có JVM overhead lúc runtime
- **Closed-world assumption**: native image phải biết **tất cả** code được dùng lúc build-time — không thể load class dynamically lúc runtime
- **Reflection constraints**: reflection phải được đăng ký tường minh qua `@RegisterForReflection` hoặc `reflect-config.json`
- **`@RegisterForReflection`**: Quarkus annotation để đăng ký class/field/method cho native reflection
- **Build time**: native build mất 2–5 phút (tốn CPU và RAM ~8GB) — chậm hơn nhiều so với JVM jar
- **Startup**: native ~10ms, JVM ~300ms, Spring Boot ~2–5s — native nhanh hơn 200-500x
- **Memory RSS**: native ~50–80MB, JVM ~200MB, Spring Boot ~200–400MB
- **Container build**: `quarkus.native.container-build=true` build native trong Docker (không cần GraalVM local)

## Ví Dụ Code

*@RegisterForReflection, native build config, và containerization cho Quarkus native với Kotlin*

```kotlin
import io.quarkus.runtime.annotations.RegisterForReflection

// ---- 1. @RegisterForReflection — bắt buộc cho class dùng reflection trong native ----

// Trường hợp phổ biến nhất: DTO được serialize/deserialize bởi JSON library
@RegisterForReflection   // Jackson cần reflection để access field
data class UserDto(
    val id: Long,
    val email: String,
    val name: String,
    val roles: List<String>
)

// Third-party class không có annotation Quarkus — đăng ký từ bên ngoài
@RegisterForReflection(targets = [
    com.external.library.SomeClass::class,   // class từ dependency
    com.external.library.AnotherClass::class
])
class ReflectionRegistrar  // Dummy class chỉ để hold annotation

// ---- 2. Enum và class được pass qua reflection (e.g., GenericType) ----
@RegisterForReflection
enum class OrderStatus {
    PENDING, PROCESSING, COMPLETED, CANCELLED
}

// ---- 3. Native-safe service — avoid dynamic class loading ----
import jakarta.enterprise.context.ApplicationScoped

@ApplicationScoped
class NativeSafeMessageFactory {

    // AVOID trong native: Class.forName(), reflection không đăng ký
    // BAD: val handler = Class.forName("com.example.${type}Handler").getDeclaredConstructor().newInstance()

    // GOOD: sealed class + when expression — Kotlin-idiomatic, compile-time safe
    fun createHandler(type: MessageType): MessageHandler = when (type) {
        MessageType.EMAIL -> EmailHandler()
        MessageType.SMS   -> SmsHandler()
        MessageType.PUSH  -> PushHandler()
    }
}

sealed interface MessageHandler { fun handle(msg: String) }
class EmailHandler : MessageHandler { override fun handle(msg: String) { /* ... */ } }
class SmsHandler  : MessageHandler { override fun handle(msg: String) { /* ... */ } }
class PushHandler : MessageHandler { override fun handle(msg: String) { /* ... */ } }
enum class MessageType { EMAIL, SMS, PUSH }
```

```properties
# application.properties — native build config

# Build native trong Docker container (không cần GraalVM local)
quarkus.native.container-build=true
quarkus.native.builder-image=quay.io/quarkus/ubi-quarkus-mandrel-builder-image:jdk-21

# Additional build args cho GraalVM
quarkus.native.additional-build-args=\
  --initialize-at-build-time=org.slf4j.LoggerFactory,\
  -H:+AddAllCharsets

# Container image config (sau khi build native)
quarkus.container-image.build=true
quarkus.container-image.group=mycompany
quarkus.container-image.name=user-service
quarkus.container-image.tag=1.0.0-native
```

```dockerfile
# Dockerfile.native — multi-stage build (Quarkus auto-generate)
# Stage 1: Build native binary
FROM quay.io/quarkus/ubi-quarkus-mandrel-builder-image:jdk-21 AS build
COPY --chown=quarkus:quarkus . /code
USER quarkus
WORKDIR /code
RUN ./gradlew build -Dquarkus.native.enabled=true -Dquarkus.native.container-build=false

# Stage 2: Minimal runtime image — không cần JVM
FROM registry.access.redhat.com/ubi8/ubi-minimal:8.9
WORKDIR /work/
COPY --from=build /code/build/quarkus-app/*-runner /work/application
RUN chmod 775 /work/application
EXPOSE 8080
ENTRYPOINT ["./application", "-Dquarkus.http.host=0.0.0.0"]
# Final image size: ~150MB (vs ~500MB JVM image)
```

## Ứng Dụng Thực Tế

Native image phù hợp nhất cho **Quarkus Lambda function** hoặc **short-lived K8s Job** — nơi cold start và memory footprint quyết định chi phí trực tiếp. Trong thực tế, các worker service xử lý webhook (startup khi có event, idle xuống 0 pod) được build native — mỗi cold start chỉ tốn 10–50ms thay vì 3–5 giây. Constraint quan trọng: một số library Java cũ dùng reflection nhiều (e.g., Apache POI) khó làm native — cần cân nhắc giữa native performance và effort tuning reflection config.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Native image vs JVM mode trong Quarkus — trade-off khi nào dùng cái nào?</strong></summary>

**A:** Native image: startup ~10ms, RSS ~50MB, không có JIT warmup — tốt cho **serverless, FaaS, ephemeral workload**. Trade-off: build chậm (2–5 phút), throughput thấp hơn JVM sau warmup (vì không có JIT), và reflection phải configure thủ công. JVM mode: startup ~300ms, RSS ~200MB nhưng **throughput cao hơn sau warmup** vì JIT optimize hot path. Dùng native khi: Lambda/Cloud Run với cold start SLA, K8s với nhiều pod scale up/down thường xuyên, memory-constrained environment. Dùng JVM khi: long-running service cần peak throughput, team không muốn deal với native reflection issue, hoặc library phức tạp khó native-ify.

</details>

<details>
<summary><strong>Reflection issue trong native image là gì và cách fix?</strong></summary>

**A:** GraalVM native image dùng **closed-world assumption** — tất cả code reachable phải được phân tích lúc build-time. Reflection (`Class.forName()`, `getDeclaredFields()`) là runtime operation, native image không biết những class nào sẽ được reflect. Fix: (1) `@RegisterForReflection` trên class của bạn — Quarkus tự thêm vào reflection config; (2) `reflect-config.json` trong `src/main/resources/META-INF/native-image/` cho third-party class; (3) Một số Quarkus extension tự xử lý (Jackson, RESTEasy) — chỉ cần register DTO class. Debug: build với `-Dquarkus.native.enable-reports=true` để xem missing reflection report.

</details>

<details>
<summary><strong>Khi nào nên dùng native image trong môi trường production thực tế?</strong></summary>

**A:** Native image production-ready khi: (1) **AWS Lambda / Google Cloud Run** — billing per ms, cold start giảm chi phí và user experience; (2) **K8s horizontal scaling** — pod startup sub-second, HPA có thể scale aggressively; (3) **Memory-sensitive environment** — nhiều tenant trên ít node, native RSS nhỏ hơn JVM 3–4x; (4) Service stateless, request/response đơn giản, không có heavy computation. Chưa nên dùng native khi: service dùng library phức tạp chưa native-ready (certain XML parsers, scripting engines), team chưa quen với native debugging workflow, hoặc cần JVM profiler (VisualVM, JFR) — những tool này không work với native binary.

</details>
