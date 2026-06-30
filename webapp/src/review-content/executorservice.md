---
key: "ExecutorService"
title: "ExecutorService"
crumb: "2. Concurrency › Thread Pool"
---

<code>ExecutorService</code> là API cấp cao để submit task vào thread pool, trả về đối tượng <code>Future</code> để lấy kết quả và hủy.

## Điểm Chính

- <code>submit(Callable)</code>: trả về <code>Future&lt;T&gt;</code>. <code>submit(Runnable)</code>: trả về <code>Future&lt;?&gt;</code>.
- <code>invokeAll(tasks)</code>: submit tất cả, chờ tất cả. <code>invokeAny(tasks)</code>: trả về cái thành công đầu tiên.
- <code>shutdown()</code>: ngừng nhận task mới, chờ in-flight. <code>shutdownNow()</code>: gửi interrupt.
- Luôn shutdown trong <code>finally</code> hoặc đăng ký shutdown hook.
- <code>Future.get()</code> block; <code>get(timeout, unit)</code> block với timeout; <code>cancel(true)</code> interrupt.

## Ví Dụ Code

*ExecutorService: invokeAll với partial failure, invokeAny cho replicas, Future timeout*

```java
import java.util.concurrent.*;
import java.util.*;
import java.util.stream.*;

// ---- ExecutorService patterns in Order / Reporting domain ----
public class OrderReportService {

    private final ExecutorService executor = Executors.newFixedThreadPool(
        Runtime.getRuntime().availableProcessors(),
        r -> new Thread(r, "report-worker")
    );

    // ---- Pattern 1: invokeAll — run all tasks, wait for ALL to complete ----
    public List<RegionReport> generateAllRegionReports(List<String> regionIds) throws InterruptedException {
        List<Callable<RegionReport>> tasks = regionIds.stream()
            .<Callable<RegionReport>>map(regionId -> () -> buildRegionReport(regionId))
            .toList();

        List<Future<RegionReport>> futures = executor.invokeAll(tasks, 60, TimeUnit.SECONDS);

        List<RegionReport> results = new ArrayList<>();
        for (Future<RegionReport> f : futures) {
            try {
                results.add(f.get());   // blocks until this task's result is ready
            } catch (ExecutionException e) {
                log.error("Report task failed", e.getCause());
                results.add(RegionReport.empty());  // partial failure: return empty report
            } catch (CancellationException e) {
                log.warn("Report task timed out and was cancelled");
                results.add(RegionReport.empty());
            }
        }
        return results;
    }

    // ---- Pattern 2: invokeAny — return the FIRST successful result ----
    // Use case: query multiple read replicas, return fastest response
    public Order fetchOrderFast(long orderId, List<String> replicaUrls) throws Exception {
        List<Callable<Order>> queries = replicaUrls.stream()
            .<Callable<Order>>map(url -> () -> replicaClient.fetch(url, orderId))
            .toList();

        // invokeAny: submits all, cancels remaining when first succeeds
        return executor.invokeAny(queries, 5, TimeUnit.SECONDS);
    }

    // ---- Pattern 3: submit + Future with timeout ----
    public Optional<PricingResult> getPricingWithTimeout(Order order) {
        Future<PricingResult> future = executor.submit(() -> pricingEngine.calculate(order));
        try {
            return Optional.of(future.get(2, TimeUnit.SECONDS));
        } catch (TimeoutException e) {
            future.cancel(true);    // interrupt the pricing thread
            log.warn("Pricing timed out for order {}", order.getId());
            return Optional.empty();
        } catch (ExecutionException e) {
            log.error("Pricing failed", e.getCause());
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }

    // ---- Proper shutdown ----
    @PreDestroy
    public void shutdown() throws InterruptedException {
        executor.shutdown();
        if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
            executor.shutdownNow();
        }
    }
}
```

## Ứng Dụng Thực Tế

Trong Spring app hiện đại, ưu tiên <code>CompletableFuture</code> thay vì raw <code>Future</code> — nó hỗ trợ chaining, combining và non-blocking callback. Dùng <code>ExecutorService</code> trực tiếp cho batch parallel processing khi muốn block và thu thập tất cả kết quả.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa execute() và submit() trong ExecutorService là gì?
1. Làm thế nào để xử lý exception từ Future.get()?
1. Sự khác biệt giữa shutdown() và shutdownNow() là gì?
