---
key: "Sizing Thread Pool"
title: "Sizing Thread Pool"
crumb: "7. System Design › High Concurrency"
---

Kích thước thread pool ảnh hưởng trực tiếp đến throughput và latency. Quá ít thread lãng phí CPU core; quá nhiều gây context-switch overhead và OOM. Kích thước tối ưu phụ thuộc vào loại workload.

## Điểm Chính

- <strong>CPU-bound</strong> (tính toán, mã hóa, xử lý in-memory): <code>pool size = CPU cores + 1</code>. Thread thêm bù cho pause ngắn.
- <strong>I/O-bound</strong> (query DB, HTTP call, đọc file): <code>pool size = CPU cores × (1 + wait_ratio)</code>.
- wait_ratio = avg_wait_time / avg_compute_time. Ví dụ: 4 cores, DB 100ms, compute 10ms → 4 × 11 = 44 threads.
- <strong>Bulkhead</strong>: dùng thread pool riêng có tên cho mỗi concern (DB ops, email, report). Bão hòa pool bị cô lập.
- Bounded queue (<code>ArrayBlockingQueue</code>) ngăn OOM dưới load. Dùng <code>CallerRunsPolicy</code> cho natural backpressure.

## Ví Dụ Code

*Named thread pool với Bulkhead isolation*

```java
// Pool riêng theo concern — Bulkhead pattern
@Configuration
public class AsyncConfig {

    @Bean("dbPool")
    public ThreadPoolTaskExecutor dbPool() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        // 4 cores × (1 + 100ms wait / 10ms compute) = 44 → làm tròn 40
        ex.setCorePoolSize(40);
        ex.setMaxPoolSize(60);
        ex.setQueueCapacity(200);     // bounded — reject khi đầy
        ex.setThreadNamePrefix("db-");
        // CallerRunsPolicy: nếu queue đầy, caller thread tự thực thi task → natural backpressure
        ex.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        ex.initialize();
        return ex;
    }

    @Bean("emailPool")
    public ThreadPoolTaskExecutor emailPool() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(5);
        ex.setMaxPoolSize(10);
        ex.setQueueCapacity(5000);   // queue lớn OK — email không nhạy cảm latency
        ex.setThreadNamePrefix("email-");
        ex.initialize();
        return ex;
    }
}

@Service class OrderService {
    @Async("emailPool")
    CompletableFuture<Void> sendConfirmation(Long orderId) {
        emailClient.send(orderId); // chạy trên emailPool, không phải caller thread
        return CompletableFuture.completedFuture(null);
    }
}
```

## Ứng Dụng Thực Tế

Pool thread riêng cho từng downstream dependency là Bulkhead pattern — payment service chậm làm đầy pool của nó chứ không "cướp" pool DB. Dùng <code>CallerRunsPolicy</code> làm rejection handler: khi queue đầy, caller thread tự chạy task, tự nhiên làm chậm producer và tạo backpressure mà không drop công việc.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Công thức tính thread pool size là gì?</strong></summary>

**A:** **CPU-bound tasks**: `N_threads = N_cpus + 1` (một thread thêm để tận dụng khi thread khác tạm dừng). **I/O-bound tasks**: `N_threads = N_cpus × (1 + wait_time / service_time)`. Wait time/service time ratio: nếu task block 90% (9ms wait, 1ms compute) → ratio = 9 → `N_threads = N_cpus × 10`. **Thực tế**: đo bằng load testing, tìm throughput plateau — thêm thread không tăng throughput → đã đủ. Little's Law: `N = λ × W` (N = concurrent users, λ = request rate, W = response time). Virtual threads (Java 21): không cần size — JVM manage.

</details>

<details>
<summary><strong>Thread pool quá ít thread dẫn đến vấn đề gì?</strong></summary>

**A:** Quá ít thread: **thread starvation** — tất cả threads bận, request mới phải chờ trong queue. Hậu quả: latency tăng vọt, timeouts, queue overflow nếu bounded. Đặc biệt nguy hiểm: nếu thread A đang chờ kết quả từ task B (cũng trong cùng pool) → **deadlock** vì thread để execute B không có. Spring Boot default Tomcat: 200 threads — với blocking I/O và slow DB, 200 concurrent requests → thread exhaustion. Triệu chứng: high CPU idle (threads waiting on I/O) nhưng response time cao.

</details>

<details>
<summary><strong>Tại sao thread pool quá nhiều thread cũng là vấn đề?</strong></summary>

**A:** (1) **Memory**: mỗi platform thread có stack 512KB-1MB → 1000 threads = 500MB-1GB chỉ cho stack. (2) **Context switch overhead**: OS scheduler phải switch giữa nhiều threads — chi phí save/restore CPU state. Với CPU-bound: nhiều thread hơn CPU cores → thrashing (context switch nhiều hơn actual work). (3) **Thundering herd**: tất cả threads wake up cùng lúc cạnh tranh lock. Optimal: CPU-bound = N_cores+1, I/O-bound = measure và test. Virtual threads giải quyết vấn đề này cho I/O-bound — platform thread count = N_cores, virtual thread count = number of concurrent tasks.

</details>
