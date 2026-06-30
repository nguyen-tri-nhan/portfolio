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

1. Công thức sizing thread pool cho I/O-bound service?
1. Tại sao tạo thread pool riêng cho từng service?
1. CallerRunsPolicy khác AbortPolicy thế nào?
