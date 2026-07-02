---
key: fallback-degradation
title: Fallback & Graceful Degradation
crumb: 13. System Design > Resilience Patterns
---

Graceful degradation giữ hệ thống hoạt động một phần khi có component bị lỗi, thay vì fail hoàn toàn — ưu tiên core functionality và tắt non-critical features dưới load cao.

## Điểm Chính

- **Fallback strategy 1 — Stale cache**: trả về dữ liệu cache đã hết hạn khi origin fail — "stale-while-revalidate" pattern; phù hợp cho dữ liệu ít thay đổi (product catalog, pricing)
- **Fallback strategy 2 — Default value**: trả về giá trị mặc định hợp lý — ví dụ trả empty list thay vì error cho recommendations, assume in-stock cho inventory check
- **Fallback strategy 3 — Alternative service**: gọi service thay thế — secondary provider, read replica, hoặc simplified version
- **Fallback strategy 4 — Feature disabled**: tắt non-critical feature và thông báo cho user — recommendation engine down không nên block checkout
- **Feature flags**: kiểm soát feature availability runtime mà không cần deploy — `LaunchDarkly`, `Unleash`, hoặc Redis-backed flag; dùng để tắt nhanh feature gặp sự cố
- **Resilience4j fallback**: `fallbackMethod` parameter trong `@CircuitBreaker`, `@Retry`, `@Bulkhead` — fallback method nhận cùng params + `Throwable`
- **Health check endpoint**: `/actuator/health` expose partial health status — load balancer route traffic dựa trên health; downstream caller biết service đang degrade
- **Testing fallback path**: inject failure với mock hoặc chaos engineering (Chaos Monkey) — fallback path ít được test nhất, thường fail trong production khi cần nhất

## Ví Dụ Code

*Kotlin service với multiple fallback layers: live data → stale cache → static default, kết hợp feature flag*

```kotlin
// Fallback hierarchy: live → stale cache → static default
@Service
class ProductCatalogService(
    private val productClient: ProductClient,
    private val productCache: RedisProductCache,
    private val staticProductLoader: StaticProductLoader,
    private val featureFlagService: FeatureFlagService
) {

    // Layer 1: Circuit Breaker bảo vệ live call
    @CircuitBreaker(name = "productService", fallbackMethod = "getFromCacheFallback")
    fun getProductDetails(productId: String): ProductDetails {
        return productClient.fetch(productId).also { product ->
            // Cập nhật cache với TTL bình thường
            productCache.set(productId, product, ttl = Duration.ofMinutes(10))
        }
    }

    // Fallback Layer 2: Stale cache (serve expired data)
    // Called khi Circuit Breaker OPEN hoặc live call fail
    private fun getFromCacheFallback(productId: String, ex: Throwable): ProductDetails {
        log.warn("Product service unavailable for {}, trying stale cache: {}", productId, ex.message)

        val staleProduct = productCache.getIgnoringTtl(productId)
        if (staleProduct != null) {
            log.info("Serving stale cache for product={}, age={}s", productId, staleProduct.ageSeconds())
            return staleProduct.value.copy(dataQuality = DataQuality.STALE)
        }

        // Fallback Layer 3: static default từ file được pre-baked
        return getStaticFallback(productId, ex)
    }

    // Fallback Layer 3: Static default
    private fun getStaticFallback(productId: String, ex: Throwable): ProductDetails {
        log.warn("No cache available for {}, using static fallback", productId)

        val staticProduct = staticProductLoader.load(productId)
        if (staticProduct != null) {
            return staticProduct.copy(dataQuality = DataQuality.STATIC_FALLBACK)
        }

        // Cuối cùng: throw meaningful exception với context
        throw ProductServiceUnavailableException(
            "Product $productId temporarily unavailable — all fallback layers exhausted",
            cause = ex
        )
    }

    // Feature flag: tắt recommendation engine khi gặp vấn đề
    fun getRecommendations(userId: String, context: RecommendationContext): List<ProductSummary> {
        // Check feature flag trước khi call expensive recommendation service
        if (!featureFlagService.isEnabled("recommendation-engine", userId)) {
            log.debug("Recommendation engine disabled via feature flag for user={}", userId)
            return getPopularProductsFallback(context.category)
        }

        return try {
            recommendationClient.fetch(userId, context)
        } catch (ex: Exception) {
            log.warn("Recommendation engine failed for user={}: {}", userId, ex.message)
            // Degrade gracefully: popular products không cần ML model
            getPopularProductsFallback(context.category)
        }
    }

    private fun getPopularProductsFallback(category: String): List<ProductSummary> =
        productCache.getPopularByCategory(category, limit = 10)
            ?: staticProductLoader.getDefaultRecommendations(category)

    companion object {
        private val log = LoggerFactory.getLogger(ProductCatalogService::class.java)
    }
}

// Health endpoint với partial status
@Component
class ProductServiceHealthIndicator(
    private val productClient: ProductClient,
    private val productCache: RedisProductCache
) : HealthIndicator {

    override fun health(): Health {
        val liveAvailable = checkLiveService()
        val cacheAvailable = productCache.isAvailable()

        return when {
            liveAvailable -> Health.up()
                .withDetail("mode", "live")
                .build()
            cacheAvailable -> Health.status(Status("DEGRADED"))
                .withDetail("mode", "stale-cache")
                .withDetail("warning", "Product data may be up to 10 minutes old")
                .build()
            else -> Health.down()
                .withDetail("mode", "static-fallback")
                .withDetail("error", "Both live service and cache unavailable")
                .build()
        }
    }

    private fun checkLiveService(): Boolean = try {
        productClient.ping()
        true
    } catch (ex: Exception) {
        false
    }
}
```

## Ứng Dụng Thực Tế

Trang homepage của e-commerce thường implement 3 layer fallback cho product catalog: live API → Redis stale cache → pre-generated static JSON file. Stale cache có thể serve data hàng giờ trong khi team fix upstream service mà user gần như không nhận ra. Feature flags (LaunchDarkly hoặc Redis-backed) cho phép tắt recommendation engine, A/B test features, hoặc gradual rollout mà không cần redeploy.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Stale cache fallback có những rủi ro gì?</strong></summary>

**A:** Rủi ro chính: (1) **Data staleness** — giá sản phẩm hoặc stock status thay đổi mà user thấy thông tin cũ, có thể gây oversell hoặc nhầm giá; (2) **Stale write amplification** — nhiều client cùng serve stale data và cùng trigger refresh khi live service recover, tạo stampede; (3) **Infinite staleness** — không set max stale age, cache cứ serve mãi dù data lỗi thời nhiều ngày. Mitigation: đánh dấu response có `dataQuality: STALE` cho client biết, set max stale age (ví dụ 1 giờ), và dùng background refresh để cập nhật cache trước khi TTL hết hạn (stale-while-revalidate pattern).

</details>

<details>
<summary><strong>Feature flag vs Circuit Breaker fallback — khác nhau và khi nào dùng cái nào?</strong></summary>

**A:** **Circuit Breaker fallback** phản ứng tự động khi failure rate vượt threshold — không cần human intervention, phù hợp cho technical failures (service down, timeout). **Feature flag** là deliberate human decision — engineer hoặc ops bật/tắt feature runtime; phù hợp cho: tắt feature non-critical dưới high load, gradual rollout (10% → 50% → 100%), kill switch cho feature mới có bug, A/B testing. Kết hợp: Circuit Breaker tự động degrade khi service fail; feature flag cho phép ops chủ động tắt feature trước khi nó fail (proactive) hoặc khi CB không trip đủ nhanh (manual override).

</details>

<details>
<summary><strong>Làm thế nào test fallback path hiệu quả?</strong></summary>

**A:** Fallback path thường không được test vì khó inject failure trong integration test. Approaches: (1) **Unit test với mock**: mock downstream service throw exception, verify fallback method được gọi và return đúng. (2) **Integration test**: dùng WireMock để simulate 500/503 responses, verify service degrade đúng. (3) **Contract test**: test fallback response format khớp với consumer expectations. (4) **Chaos Engineering**: Chaos Monkey inject latency/failure vào production (canary environment trước), verify system degrade gracefully. (5) **Feature flag test**: toggle flag và verify behavior — dễ test nhất. Critical: monitor fallback metrics trong production để biết fallback có đang được gọi không và khi nào.

</details>
