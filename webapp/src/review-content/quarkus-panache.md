---
key: quarkus-panache
title: Hibernate ORM với Panache
crumb: "8. Quarkus > Persistence"
---

Panache là layer trên Hibernate ORM trong Quarkus, cung cấp hai pattern: Active Record (entity tự có method CRUD) và Repository, loại bỏ boilerplate code so với JPA thuần hay Spring Data JPA.

## Điểm Chính

- **Active Record pattern**: entity extend `PanacheEntity` / `PanacheEntityBase` — có sẵn `persist()`, `findById()`, `listAll()`, `delete()`
- **Repository pattern**: class implement `PanacheRepository<T>` — inject vào service, tách logic CRUD khỏi entity
- **`PanacheEntity`**: auto-generate `id` field (Long, `@GeneratedValue`); `PanacheEntityBase` khi muốn custom ID
- **Query DSL**: `find("email", email)`, `list("status = ?1", Status.ACTIVE)`, `stream()` cho large dataset
- **HQL và native query**: `find("FROM User WHERE email = :email", Parameters.with("email", e))`, `nativeQuery()`
- **Panache Reactive**: `PanacheEntity` có reactive variant `ReactivePanacheEntity` trả `Uni<T>` / `Multi<T>`
- **`@SoftDelete`**: Quarkus Panache 3.x support soft delete annotation tự động filter
- **Sorting & Pagination**: `find().page(Page.of(0, 20)).list()`, `Sort.by("name").ascending()`

## Ví Dụ Code

*Active Record và Repository pattern cùng trong một project — Kotlin với Panache Reactive*

```kotlin
import io.quarkus.hibernate.reactive.panache.PanacheEntity
import io.quarkus.hibernate.reactive.panache.PanacheRepository
import io.smallrye.mutiny.Uni
import jakarta.enterprise.context.ApplicationScoped
import jakarta.persistence.*
import io.quarkus.panache.common.Sort
import io.quarkus.panache.common.Page

// ---- 1. Active Record Pattern — entity tự quản lý CRUD ----
@Entity
@Table(name = "users")
class User : PanacheEntity() {   // id field được generate tự động

    @Column(nullable = false, unique = true)
    lateinit var email: String

    @Column(nullable = false)
    lateinit var name: String

    @Enumerated(EnumType.STRING)
    var status: UserStatus = UserStatus.ACTIVE

    @Column(name = "created_at")
    var createdAt: java.time.Instant = java.time.Instant.now()

    // Custom finder methods — static-like, nhưng trong Kotlin là companion object
    companion object {
        fun findByEmail(email: String): Uni<User?> =
            find("email", email).firstResult()

        fun findAllActive(): Uni<List<User>> =
            list("status", UserStatus.ACTIVE)

        fun findPaged(page: Int, size: Int): Uni<List<User>> =
            findAll(Sort.by("name").ascending())
                .page(Page.of(page, size))
                .list()

        fun countByStatus(status: UserStatus): Uni<Long> =
            count("status", status)
    }
}

enum class UserStatus { ACTIVE, INACTIVE, SUSPENDED }

// ---- 2. Repository Pattern — tách concern, dễ test hơn ----
@ApplicationScoped
class UserRepository : PanacheRepository<User> {

    // Panache tự generate: findById, listAll, persist, delete, count, etc.

    fun findActiveByEmailDomain(domain: String): Uni<List<User>> =
        list("email LIKE ?1 AND status = ?2", "%@$domain", UserStatus.ACTIVE)

    fun searchByName(keyword: String): Uni<List<User>> =
        find("LOWER(name) LIKE LOWER(?1)", "%$keyword%")
            .list()

    // HQL với named parameters
    fun findRecentUsers(since: java.time.Instant): Uni<List<User>> =
        find("FROM User u WHERE u.createdAt > :since ORDER BY u.createdAt DESC",
            mapOf("since" to since))
            .list()

    // Native SQL khi HQL không đủ
    fun findUsersWithComplexCriteria(tenantId: Long): Uni<List<User>> =
        find("#User.findByTenant", mapOf("tenantId" to tenantId))
            .list()
}

// ---- 3. Service dùng Repository — @Transactional required cho write ops ----
@ApplicationScoped
class UserService(private val userRepository: UserRepository) {

    @jakarta.transaction.Transactional
    fun createUser(email: String, name: String): Uni<User> {
        val user = User().apply {
            this.email = email
            this.name = name
        }
        return userRepository.persist(user)  // returns Uni<User> với id được set
    }

    fun getUserPage(page: Int, size: Int): Uni<List<User>> =
        userRepository.findAll(Sort.by("createdAt").descending())
            .page(Page.of(page, size))
            .list()
}
```

## Ứng Dụng Thực Tế

Trong thực tế, Panache Repository pattern được ưu tiên hơn Active Record vì dễ mock trong unit test — inject `UserRepository` vào service, test có thể mock repository mà không cần DB. So sánh với Spring Data JPA: cả hai đều giảm boilerplate, nhưng Panache có API ngắn gọn hơn cho query DSL (`list("status", ACTIVE)` thay vì phải viết `@Query("SELECT u FROM User u WHERE u.status = :status")`). Panache Reactive tích hợp tự nhiên với RESTEasy Reactive — toàn bộ stack non-blocking từ HTTP layer xuống DB.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Panache vs Spring Data JPA — khác nhau ở đâu và khi nào chọn cái nào?</strong></summary>

**A:** Spring Data JPA dùng **interface-based repository** với method name convention (`findByEmailAndStatus`) — cực kỳ quen thuộc và mature. Panache dùng **class-based** extend `PanacheRepository` hoặc Active Record — ít boilerplate hơn, query DSL trực quan hơn. Điểm khác biệt lớn: Spring Data JPA chỉ support blocking (dùng R2DBC nếu muốn reactive, nhưng tách biệt); Panache có sẵn **reactive variant** (`ReactivePanacheRepository`) dùng cùng API. Chọn Panache khi đang dùng Quarkus; Spring Data JPA khi đang dùng Spring Boot hoặc team cần familiar API.

</details>

<details>
<summary><strong>Active Record vs Repository pattern trong Panache — nên dùng cái nào?</strong></summary>

**A:** **Active Record** (`PanacheEntity`) tiện cho prototyping và CRUD đơn giản — gọi thẳng `user.persist()`, `User.findByEmail(email)`. **Repository** (`PanacheRepository`) phù hợp production vì: (1) dễ mock trong unit test (inject interface, không cần DB); (2) tách business logic khỏi persistence concern; (3) dễ thêm caching layer. Best practice: dùng Repository pattern cho tất cả service production, Active Record chỉ trong prototype hoặc migration script. Nếu domain model phức tạp (nhiều aggregate), Domain-Driven Design thường require Repository pattern để quản lý aggregate boundary rõ ràng.

</details>

<details>
<summary><strong>Panache query DSL hoạt động thế nào — viết query phức tạp ra sao?</strong></summary>

**A:** Panache support 3 query style: (1) **Simplified HQL** — `find("status = ?1 AND email LIKE ?2", ACTIVE, "%@example.com")` với positional parameter; (2) **Full HQL** — `find("FROM User u JOIN u.roles r WHERE r.name = :role", mapOf("role" to "admin"))` cho complex join; (3) **Native SQL** — `find("#User.complexQuery", params)` với `@NamedNativeQuery` trên entity. Với Panache, `?1` là positional (1-indexed), `:name` là named parameter. Streaming large result: `stream("status", ACTIVE)` trả `Multi<User>` để xử lý từng record không load hết vào memory — quan trọng cho batch processing.

</details>
