---
key: quarkus-config
title: Quarkus Configuration
crumb: "8. Quarkus > Quarkus Cơ Bản"
---

Quarkus dùng MicroProfile Config chuẩn cho configuration — `@ConfigProperty` inject giá trị trực tiếp vào bean, `@ConfigMapping` cho typed config object, và profile-based override qua `%dev`, `%prod` prefix.

## Điểm Chính

- **`@ConfigProperty(name, defaultValue)`**: inject scalar value — String, Int, Boolean, Duration, List
- **`application.properties`** (mặc định) và **`application.yaml`** (thêm extension `quarkus-config-yaml`)
- **Profiles**: `%dev.*`, `%test.*`, `%prod.*` — tự động active theo môi trường; custom profile qua `-Dquarkus.profile=staging`
- **`@ConfigMapping`**: interface-based typed config — nhóm nhiều property, tự validate, immutable
- **Environment variable override**: `APP_GREETING_MESSAGE` override `app.greeting.message` (dot → underscore, uppercase)
- **Secrets**: dùng `quarkus-config-vault` (HashiCorp) hoặc `quarkus-kubernetes-config` cho K8s ConfigMap/Secret
- **Config sources priority** (cao → thấp): System property > env var > `application.properties` > default
- **`@io.smallrye.config.Trim`**, **`@io.smallrye.config.WithDefault`**: annotation bổ sung của SmallRye Config

## Ví Dụ Code

*@ConfigProperty, @ConfigMapping với validation, và profile-based config trong Kotlin*

```kotlin
import org.eclipse.microprofile.config.inject.ConfigProperty
import io.smallrye.config.ConfigMapping
import io.smallrye.config.WithDefault
import io.smallrye.config.WithName
import jakarta.enterprise.context.ApplicationScoped
import jakarta.validation.constraints.*
import java.time.Duration
import java.util.Optional

// ---- 1. @ConfigProperty — scalar injection ----
@ApplicationScoped
class AppConfigService {

    // String với default value
    @ConfigProperty(name = "app.name", defaultValue = "MyService")
    lateinit var appName: String

    // Số nguyên — Quarkus tự convert String → Int
    @ConfigProperty(name = "app.max-connections", defaultValue = "10")
    var maxConnections: Int = 0

    // Duration — support "PT30S", "30s", "1m" notation
    @ConfigProperty(name = "app.request-timeout", defaultValue = "PT30S")
    lateinit var requestTimeout: Duration

    // Optional — không fail nếu key không tồn tại
    @ConfigProperty(name = "app.feature.beta-users")
    var betaUsersFile: Optional<String> = Optional.empty()

    // List — comma-separated trong properties file
    // app.allowed-origins=http://localhost:3000,https://example.com
    @ConfigProperty(name = "app.allowed-origins")
    lateinit var allowedOrigins: List<String>
}

// ---- 2. @ConfigMapping — typed config interface (preferred for groups) ----
@ConfigMapping(prefix = "payment")   // maps payment.* properties
interface PaymentConfig {

    // payment.gateway.url
    fun gateway(): GatewayConfig

    // payment.retry.max-attempts (với default)
    @WithDefault("3")
    fun retryMaxAttempts(): Int

    // payment.enabled
    @WithDefault("true")
    fun enabled(): Boolean

    interface GatewayConfig {
        @WithName("url")               // payment.gateway.url
        @NotBlank                      // Bean Validation trên config!
        fun url(): String

        @WithName("api-key")           // payment.gateway.api-key
        fun apiKey(): String

        @WithDefault("PT10S")
        fun timeout(): Duration
    }
}

// Inject @ConfigMapping như CDI bean:
// @Inject lateinit var paymentConfig: PaymentConfig
// paymentConfig.gateway().url()  // type-safe, no string lookup

// ---- 3. application.properties với profiles ----
/*
# ========================================
# application.properties
# ========================================

# Shared (all profiles)
app.name=MyService
app.max-connections=50
app.allowed-origins=https://app.example.com,https://admin.example.com

# payment config — maps to PaymentConfig interface
payment.gateway.url=https://payment-svc:8080
payment.gateway.api-key=${PAYMENT_API_KEY}   # read from env var
payment.retry.max-attempts=3
payment.enabled=true

# ---- Dev profile override (%dev) ----
%dev.app.name=MyService-DEV
%dev.app.max-connections=5
%dev.payment.gateway.url=http://localhost:9090
%dev.payment.gateway.api-key=dev-fake-key
%dev.payment.enabled=false

# ---- Test profile (%test) ----
%test.payment.gateway.url=http://wiremock:8080
%test.payment.gateway.api-key=test-key

# ---- Production (%prod) — most values from env vars ----
%prod.app.max-connections=200
# payment.gateway.api-key comes from K8s Secret via env PAYMENT_GATEWAY_API__KEY
*/

// ---- 4. Programmatic config read (không cần injection) ----
import org.eclipse.microprofile.config.ConfigProvider

fun readConfigProgrammatically() {
    val config = ConfigProvider.getConfig()
    val timeout = config.getValue("app.request-timeout", Duration::class.java)
    val optional = config.getOptionalValue("feature.flag", Boolean::class.java)
}
```

## Ứng Dụng Thực Tế

Trong thực tế, `@ConfigMapping` được dùng cho toàn bộ external service config (payment gateway, S3, notification service) — nhóm related property lại với nhau, tự validate khi startup, và immutable nên thread-safe. Profile switching trong CI/CD: `%test` profile khi chạy unit test (mock external service URL), `%prod` profile trong K8s với giá trị sensitive lấy từ Secret. So sánh với Spring `@ConfigurationProperties`: tương tự về concept nhưng `@ConfigMapping` là interface (không phải class), không cần `@EnableConfigurationProperties`, và validate tự động không cần `@Validated` riêng.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>@ConfigProperty vs Spring @Value — khác nhau như thế nào?</strong></summary>

**A:** Cả hai đều inject config value, nhưng khác về chuẩn và type safety. Spring `@Value("${app.timeout}")` dùng Spring Expression Language (SpEL), chỉ inject vào Spring bean, và conversion phải configure thêm cho complex type. Quarkus `@ConfigProperty(name="app.timeout")` là **MicroProfile Config chuẩn** — portable, tự động convert sang nhiều type (Duration, List, Optional), và work với CDI bean. Quan trọng hơn: Quarkus khuyến khích dùng `@ConfigMapping` (interface-based) thay vì `@ConfigProperty` rải rác — giúp validate tập trung, refactor dễ hơn, và không bị typo property name scattered khắp codebase.

</details>

<details>
<summary><strong>Profile switching trong Quarkus hoạt động thế nào trong CI/CD pipeline?</strong></summary>

**A:** Quarkus active profile được xác định qua (theo priority): `quarkus.profile` system property, `QUARKUS_PROFILE` env var, hoặc mặc định (`dev` khi `quarkus:dev`, `test` khi test, `prod` khi package). Trong CI/CD: build JAR/native binary một lần, runtime inject config qua env var — ví dụ K8s deployment set `QUARKUS_PROFILE=prod` và `PAYMENT_GATEWAY_API__KEY=xxx` (double underscore vì `.` → `_` trong env var). `%test` profile tự active khi chạy `@QuarkusTest` — không cần set gì thêm. Best practice: sensitive config không bao giờ để trong properties file, luôn dùng env var hoặc Vault.

</details>

<details>
<summary><strong>@ConfigMapping có ưu điểm gì so với inject @ConfigProperty riêng lẻ?</strong></summary>

**A:** `@ConfigMapping` có 4 ưu điểm lớn: (1) **Validation tại startup** — nếu config sai (URL rỗng, giá trị ngoài range), app fail-fast thay vì fail lúc runtime; (2) **Type-safe grouping** — `paymentConfig.gateway().url()` thay vì nhớ string key `payment.gateway.url`; (3) **Refactoring** — rename prefix ở một chỗ (`@ConfigMapping(prefix="payment-v2")`), IDE tự cập nhật; (4) **Immutable** — interface return value, không thể bị modify sau injection (thread-safe). Trade-off: cần tạo interface file riêng. Với Spring: tương đương `@ConfigurationProperties` class nhưng nhẹ hơn vì interface, không cần `@EnableConfigurationProperties`.

</details>
