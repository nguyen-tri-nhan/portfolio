---
key: quarkus-mutiny
title: Mutiny Reactive Programming
crumb: "8. Quarkus > RESTEasy Reactive"
---

Mutiny là reactive programming library của Quarkus — thiết kế event-driven và lazy, với API trực quan hơn Reactor (Spring WebFlux), tập trung vào `Uni` (0-1 item) và `Multi` (0-N items).

## Điểm Chính

- **`Uni<T>`**: đại diện cho 0 hoặc 1 item async — tương đương `Mono<T>` trong Reactor, nhưng **lazy** (không execute cho đến khi có subscriber)
- **`Multi<T>`**: stream 0-N item async — tương đương `Flux<T>`, dùng cho streaming response, event stream
- **`Uni` operators chính**: `.map()`, `.flatMap()` (gọi là `.chain()`), `.onItem()`, `.onFailure()`, `.replaceWith()`
- **`Multi` operators**: `.select().first(n)`, `.transform().byFilteringItemsWith()`, `.group().by()`
- **`Uni.createFrom()`**: `item()`, `failure()`, `emitter()`, `completionStage()`, `voidItem()`
- **`Uni.combine().all()`**: chạy nhiều Uni song song, chờ tất cả hoàn thành — tương đương `Mono.zip()`
- **Failure handling**: `.onFailure().recoverWithItem()`, `.onFailure().retry().atMost(n)`, `.onFailure().transform()`
- **Context propagation**: Mutiny tích hợp với Vert.x context — request-scoped bean hoạt động đúng trong async chain

## Ví Dụ Code

*Uni operators, parallel execution, failure handling, và Multi streaming trong Kotlin*

```kotlin
import io.smallrye.mutiny.Uni
import io.smallrye.mutiny.Multi
import io.smallrye.mutiny.groups.UniCombine
import jakarta.enterprise.context.ApplicationScoped
import java.time.Duration

@ApplicationScoped
class OrderService(
    private val userRepo: UserRepository,
    private val productRepo: ProductRepository,
    private val paymentService: PaymentService
) {

    // ---- 1. Basic Uni chain — flatMap để gọi async sequential ----
    fun createOrder(userId: Long, productId: Long, quantity: Int): Uni<Order> =
        userRepo.findById(userId)                    // Uni<User?>
            .onItem().ifNull().failWith { NotFoundException("User $userId not found") }
            .chain { user ->                         // .chain() = flatMap, returns Uni
                productRepo.findById(productId)
                    .map { product -> Pair(user, product) }
            }
            .chain { (user, product) ->
                paymentService.charge(user, product.price * quantity)
                    .map { paymentResult -> Triple(user, product, paymentResult) }
            }
            .map { (user, product, payment) ->
                Order(userId = user.id, productId = product.id, paymentId = payment.id)
            }

    // ---- 2. Parallel execution — combine multiple Uni ----
    fun getOrderDashboard(userId: Long): Uni<DashboardData> {
        val userUni   = userRepo.findById(userId)
        val ordersUni = orderRepo.findByUserId(userId)
        val statsUni  = statsService.getUserStats(userId)

        // Chạy 3 request song song, chờ tất cả xong rồi combine
        // Tương đương Mono.zip() trong Reactor
        return Uni.combine().all()
            .unis(userUni, ordersUni, statsUni)
            .asTuple()
            .map { (user, orders, stats) ->
                DashboardData(user = user, orders = orders, stats = stats)
            }
    }

    // ---- 3. Failure handling — retry và fallback ----
    fun fetchExternalData(url: String): Uni<ExternalData> =
        externalClient.fetch(url)
            .onFailure(java.net.ConnectException::class.java)
                .retry()
                .withBackOff(Duration.ofMillis(100), Duration.ofSeconds(1))
                .atMost(3)                           // retry tối đa 3 lần với backoff
            .onFailure()
                .recoverWithItem { ex ->
                    // Fallback value nếu tất cả retry đều fail
                    ExternalData.empty().also {
                        Log.warnf(ex, "External fetch failed, using fallback")
                    }
                }

    // ---- 4. Multi — stream xử lý từng item ----
    fun processLargeDataset(datasetId: Long): Multi<ProcessedRecord> =
        dataRepo.streamById(datasetId)               // Multi<RawRecord> — không load hết vào memory
            .select().where { record -> record.isValid() }   // filter
            .onItem().transform { record ->
                // Transform mỗi item — chạy tuần tự trên từng item
                ProcessedRecord(
                    id = record.id,
                    value = record.value.uppercase(),
                    processedAt = java.time.Instant.now()
                )
            }
            .onItem().transformToUniAndMerge { processed ->
                // Mỗi item spawn một Uni, merge kết quả (concurrent, không ordered)
                enrichmentService.enrich(processed)
            }
            .select().first(1000)                    // lấy tối đa 1000 record
}
```

## Ứng Dụng Thực Tế

Trong thực tế, Mutiny được dùng cho các pipeline xử lý test report: đọc file từ S3 (async), parse, enrich với metadata từ DB, rồi write ra Elasticsearch — tất cả là `Multi` pipeline non-blocking, không cần giữ toàn bộ dataset trong memory. So sánh với Spring WebFlux/Reactor: Mutiny có learning curve thấp hơn do tên operator trực quan hơn (`chain` thay vì `flatMap`, `transform` thay vì `map` trong một số context) — đặc biệt thuận lợi cho team chuyển từ imperative sang reactive.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Uni trong Mutiny vs Mono trong Project Reactor — khác nhau ở đâu?</strong></summary>

**A:** Cả `Uni<T>` và `Mono<T>` đều đại diện cho 0-1 async item, nhưng khác về API design philosophy. `Uni` có API **event-oriented** rõ ràng hơn: `.onItem()`, `.onFailure()`, `.onSubscription()` — bạn biết đang handle event nào. `Mono` dùng operator chung như `.flatMap()`, `.map()` — mạnh hơn nhưng ít explicit. Quan trọng: cả hai đều **lazy** — không execute cho đến khi `subscribe()`. Mutiny cũng có `Uni.combine().all()` tương đương `Mono.zip()`. Về performance: tương đương, cả hai đều build trên Reactive Streams spec. Chuyển đổi: `Uni.createFrom().completionStage(mono.toFuture())` để interop.

</details>

<details>
<summary><strong>Uni.combine().all() hoạt động thế nào và khi nào dùng?</strong></summary>

**A:** `Uni.combine().all().unis(u1, u2, u3).asTuple()` subscribe tất cả Uni **đồng thời**, chờ tất cả emit item rồi combine thành Tuple. Nếu bất kỳ Uni nào fail, toàn bộ combine fail ngay (fail-fast). Dùng khi cần **parallel fetch** độc lập nhau: lấy user info, order history, account balance cùng lúc thay vì sequential (giảm total latency từ T1+T2+T3 xuống max(T1,T2,T3)). Lưu ý: `asTuple()` giữ type-safe; `collectFailures()` cho phép collect tất cả failure thay vì fail ngay — dùng khi muốn biết tất cả lỗi cùng lúc.

</details>

<details>
<summary><strong>Failure handling trong Mutiny như thế nào — so sánh với try-catch thông thường?</strong></summary>

**A:** Trong reactive pipeline, exception không thể bubble up qua call stack như synchronous code vì execution có thể xảy ra trên thread khác. Mutiny propagate failure qua **failure event** trong pipeline. `.onFailure().recoverWithItem(fallback)` = catch và return giá trị default. `.onFailure().transform(ex -> newEx)` = catch và rethrow với exception khác. `.onFailure().retry().atMost(3)` = retry logic không cần try-catch loop thủ công. Quan trọng: nếu không handle failure, nó propagate lên caller (RESTEasy Reactive tự map thành HTTP 500 nếu không có `@ServerExceptionMapper`). Best practice: handle failure gần nguồn gốc, không để bubble lên tầng controller.

</details>
