---
key: "Performance Testing"
title: "Performance Testing"
crumb: "9. Testing"
---

Performance testing kiểm tra yêu cầu latency và throughput dưới tải, dùng tool như k6, Gatling hoặc JMeter để tìm bottleneck trước khi production traffic làm điều đó.

## Điểm Chính

- <strong>Load test</strong>: tải production kỳ vọng — verify SLO được đáp ứng.
- <strong>Stress test</strong>: vượt quá tải kỳ vọng — tìm điểm gãy.
- <strong>Spike test</strong>: đột biến đột ngột — test auto-scaling và queue behavior.
- <strong>Soak test</strong>: tải duy trì trong giờ đồng hồ — tìm memory leak, degradation dần dần.
- Metric chính: latency p50/p95/p99, throughput (req/s), error rate, saturation.

## Ví Dụ Code

*Gatling simulation: browse → place order → verify, với ramp/spike load profile và assertions*

```java
// ── Gatling simulation: order checkout flow ──────────────────────────────────
// OrderCheckoutSimulation.scala
class OrderCheckoutSimulation extends Simulation {

  val httpConf = http
    .baseUrl("https://staging-api.example.com")
    .header("Content-Type", "application/json")
    .header("Authorization", "Bearer ${token}")

  // Feeder: parameterize with different users from CSV
  val users = csv("users.csv").circular   // columns: userId, token

  val checkoutScenario = scenario("Order Checkout Flow")
    .feed(users)
    .exec(
      http("GET /api/products — browse catalog")
        .get("/api/products?category=electronics&limit=20")
        .check(status.is(200))
        .check(jsonPath("$.items[0].productId").saveAs("productId"))
    )
    .pause(1, 3)   // think time: 1-3 seconds between steps
    .exec(
      http("POST /api/orders — place order")
        .post("/api/orders")
        .body(StringBody(
          """{"userId":"${userId}","items":[{"productId":"${productId}","quantity":1}]}"""
        ))
        .check(status.is(201))
        .check(jsonPath("$.orderId").saveAs("orderId"))
    )
    .pause(500.milliseconds)
    .exec(
      http("GET /api/orders/{id} — verify order")
        .get("/api/orders/${orderId}")
        .check(status.is(200))
        .check(jsonPath("$.status").is("CONFIRMED"))
    )

  // Load profile: ramp up → sustain → spike → ramp down
  setUp(
    checkoutScenario.inject(
      rampUsers(50).during(2.minutes),     // ramp up to 50 users
      constantUsersPerSec(50).during(5.minutes),  // sustain load
      atOnceUsers(200),                    // spike: sudden 200 users
      rampUsersPerSec(200).to(0).during(2.minutes)  // ramp down
    )
  ).protocols(httpConf)
   .assertions(
     global.responseTime.percentile(95).lt(500),  // p95 < 500ms
     global.failedRequests.percent.lt(1),         // error rate < 1%
     forAll.responseTime.percentile(99).lt(2000)  // p99 < 2s
   )
}
// Run: mvn gatling:test -Dgatling.simulationClass=OrderCheckoutSimulation
// Report: target/gatling/orderchechoutsimulation-*/index.html
```

## Ứng Dụng Thực Tế

Định nghĩa threshold như tiêu chí CI pass/fail dựa trên SLO. Chạy với staging trước mỗi release để bắt performance regression. k6 là lựa chọn hiện đại — JavaScript DSL, Go runtime (hiệu quả), tích hợp CI tốt.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa load test và stress test?</strong></summary>

**A:** **Load test**: test hệ thống tại **expected load** (hoặc vài lần expected) trong thời gian dài — verify behavior, latency, error rate tại normal + peak traffic. **Stress test**: tăng load **vượt capacity** cho đến khi hệ thống fail — tìm breaking point, behavior khi overload (graceful degradation hay crash). **Soak test**: load bình thường trong thời gian dài (24-72h) — phát hiện memory leak, resource exhaustion theo thời gian. **Spike test**: tăng load đột ngột — test autoscaler, circuit breaker.

</details>

<details>
<summary><strong>Percentile nào (p50/p95/p99) quan trọng nhất cho user experience?</strong></summary>

**A:** **p99** quan trọng nhất vì: user experience bị chi phối bởi **slowest requests**. Nếu p99 = 5s, 1% user chờ 5s mỗi operation — với 10K user, 100 người chờ 5s. SLO thường dùng p99. **p50** (median): response time typical, không đại diện cho tail latency — median 100ms không nói lên được nếu p99 = 10s. **p95** balance giữa representative và outlier. Rule: alert trên p99 cho real user impact; p50 cho overall throughput health. "99th percentile is the 1% that matters most" (Jeff Atwood).

</details>

<details>
<summary><strong>Làm thế nào để tích hợp performance test vào CI/CD?</strong></summary>

**A:** (1) Chạy lightweight load test (k6, Gatling) sau deploy lên staging environment. (2) Define **performance budget**: p95 latency < 500ms, error rate < 0.1%, RPS > 100. (3) CI pipeline fail nếu budget vi phạm. (4) Chạy full stress test định kỳ (nightly, weekly) thay vì mỗi commit (quá tốn thời gian). (5) Trend tracking: so sánh với baseline previous run — alert khi regression > 20%. Tools: k6 Cloud, Gatling Enterprise, GitHub Actions với threshold check.

</details>
