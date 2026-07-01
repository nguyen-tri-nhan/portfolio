---
key: quarkus-testing
title: Quarkus Testing
crumb: "8. Quarkus > Testing"
---

Quarkus cung cấp `@QuarkusTest` khởi động full application context cho integration test, tích hợp sẵn RestAssured cho HTTP testing, và `@InjectMock` để mock CDI bean — không cần config phức tạp như Spring Boot.

## Điểm Chính

- **`@QuarkusTest`**: annotation trên test class — khởi động full Quarkus app, giống `@SpringBootTest` nhưng startup nhanh hơn
- **RestAssured**: tích hợp sẵn, test HTTP endpoint không cần MockMvc setup — `given().when().get("/api/users").then().statusCode(200)`
- **`@TestHTTPEndpoint`**: inject URL endpoint tự động — không hardcode path string trong test
- **`@TestHTTPResource`**: inject `URL` object của resource
- **`@InjectMock`**: mock CDI bean trong context — tương đương `@MockBean` trong Spring Boot, dùng Mockito
- **`@QuarkusMock`**: programmatic CDI mock replacement — dùng trong `@BeforeEach` để setup per-test mock
- **`@QuarkusIntegrationTest`**: test native binary hoặc packaged JAR — test chạy trên built artifact
- **Continuous testing**: `quarkus:dev` tự chạy test liên quan khi file thay đổi — zero test runner overhead

## Ví Dụ Code

*@QuarkusTest với RestAssured, @InjectMock, và @TestProfile trong Kotlin*

```kotlin
import io.quarkus.test.junit.QuarkusTest
import io.quarkus.test.junit.mockito.InjectMock
import io.quarkus.test.junit.TestProfile
import io.quarkus.test.common.QuarkusTestResource
import io.restassured.RestAssured.given
import io.restassured.http.ContentType
import org.junit.jupiter.api.*
import org.mockito.Mockito.*
import org.hamcrest.CoreMatchers.*
import io.smallrye.mutiny.Uni

// ---- 1. Basic integration test với RestAssured ----
@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class UserResourceTest {

    // @InjectMock thay thế real bean bằng Mockito mock trong CDI context
    @InjectMock
    lateinit var userService: UserService

    @InjectMock
    lateinit var notificationClient: NotificationClient

    @BeforeEach
    fun setup() {
        // Setup default mock behavior trước mỗi test
        `when`(notificationClient.sendWelcomeEmail(anyString()))
            .thenReturn(Uni.createFrom().voidItem())
    }

    @Test
    @Order(1)
    fun `GET user by id - returns 200 with user data`() {
        val mockUser = User(id = 1L, email = "test@example.com", name = "Test User")
        `when`(userService.findById(1L)).thenReturn(Uni.createFrom().item(mockUser))

        given()
            .`when`().get("/api/v1/users/1")
            .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("email", equalTo("test@example.com"))
                .body("name", equalTo("Test User"))
    }

    @Test
    @Order(2)
    fun `GET user by id - returns 404 when not found`() {
        `when`(userService.findById(999L)).thenReturn(Uni.createFrom().item(null))

        given()
            .`when`().get("/api/v1/users/999")
            .then()
                .statusCode(404)
    }

    @Test
    @Order(3)
    fun `POST create user - returns 201 with location header`() {
        val newUser = User(id = 2L, email = "new@example.com", name = "New User")
        `when`(userService.create(any())).thenReturn(newUser)

        given()
            .contentType(ContentType.JSON)
            .body("""{"email": "new@example.com", "name": "New User"}""")
            .`when`().post("/api/v1/users")
            .then()
                .statusCode(201)
                .header("Location", containsString("/api/v1/users/2"))

        // Verify side effect
        verify(notificationClient, times(1)).sendWelcomeEmail("new@example.com")
    }
}

// ---- 2. Database integration test với @QuarkusTest + real DB ----
@QuarkusTest
class UserRepositoryTest {

    @Inject
    lateinit var userRepository: UserRepository

    @Test
    @io.quarkus.test.vertx.RunOnVertxContext  // Required cho Panache Reactive test
    fun `findByEmail - returns user when exists`(context: io.quarkus.test.vertx.UniAsserter) {
        context.assertThat(
            { userRepository.findByEmail("admin@example.com") },
            { user -> Assertions.assertNotNull(user) }
        )
    }
}

// ---- 3. Test Profile — override config cho test ----
class TestConfig : io.quarkus.test.junit.QuarkusTestProfile {
    override fun getConfigOverrides(): Map<String, String> = mapOf(
        "payment.gateway.url" to "http://localhost:9090",   // WireMock
        "payment.enabled" to "false",
        "quarkus.log.level" to "WARN"   // Giảm noise trong test output
    )

    // Tag để chỉ một số test dùng profile này
    override fun tags(): Set<String> = setOf("payment-test")
}

@QuarkusTest
@TestProfile(TestConfig::class)
class PaymentServiceTest {
    // Test với config override — payment gateway trỏ về WireMock
}
```

## Ứng Dụng Thực Tế

Trong thực tế, `@QuarkusTest` + RestAssured là combo chính cho integration test API layer — không cần Spring Test Context, MockMvc setup, hay `@AutoConfigureMockMvc`. `@InjectMock` dùng để isolate business logic khỏi external dependency (payment service, notification client) trong integration test, còn unit test thuần (không cần `@QuarkusTest`) dùng cho Kotlin business logic đơn giản. So sánh với Spring Boot: `@QuarkusTest` context startup nhanh hơn (~1s vs ~5s), và continuous testing trong dev mode chạy test tự động mà không cần terminal riêng.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>@QuarkusTest vs @SpringBootTest — khác nhau như thế nào?</strong></summary>

**A:** Cả hai đều khởi động full application context cho integration test. Khác biệt chính: (1) **Startup speed** — `@QuarkusTest` khởi động ~1s (build-time DI wiring), `@SpringBootTest` thường ~5–10s; (2) **HTTP testing** — `@QuarkusTest` tích hợp sẵn RestAssured, `@SpringBootTest` dùng TestRestTemplate hoặc cần thêm `@AutoConfigureMockMvc`; (3) **Mock CDI bean** — `@InjectMock` (Quarkus) vs `@MockBean` (Spring) — cả hai dùng Mockito nhưng inject mechanism khác; (4) **Native testing** — Quarkus có `@QuarkusIntegrationTest` test native binary, Spring không có equivalent.

</details>

<details>
<summary><strong>@InjectMock trong Quarkus hoạt động thế nào và khi nào dùng thay vì @QuarkusMock?</strong></summary>

**A:** `@InjectMock` là Mockito-based — Quarkus tạo Mockito mock và replace CDI bean trong application context. Dùng trong field của test class, Mockito spy/verify work bình thường. `@QuarkusMock` là programmatic replacement — `QuarkusMock.installMockForType(myMock, ServiceClass::class.java)` trong `@BeforeEach`, cho phép dùng bất kỳ mock framework nào (không chỉ Mockito). Dùng `@InjectMock` cho 95% trường hợp — simple và familiar. Dùng `@QuarkusMock` khi: cần replace mock per-test dynamically, dùng mock framework khác (MockK trong Kotlin), hoặc cần replace bean trong `@BeforeAll` static context.

</details>

<details>
<summary><strong>Làm thế nào để test native binary trong Quarkus?</strong></summary>

**A:** Dùng `@QuarkusIntegrationTest` thay vì `@QuarkusTest` — annotation này test **built artifact** (native binary hoặc JAR) thay vì start app trong test process. Workflow: (1) Build native: `./gradlew build -Dquarkus.native.enabled=true`; (2) Chạy integration test: `./gradlew quarkusIntTest` — test launch binary và test qua HTTP. Cùng test code (RestAssured, v.v.) work cho cả JVM và native — chỉ cần swap annotation. Lưu ý: `@InjectMock` không work trong `@QuarkusIntegrationTest` (binary đã built, không inject được) — integration test phải test từ outside qua HTTP; dùng Testcontainers hoặc WireMock cho external dependency.

</details>
