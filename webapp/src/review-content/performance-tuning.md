---
key: "Performance Tuning"
title: "Tuning Hiệu Năng JVM"
crumb: "1. Core Java"
---

Tuning hiệu năng là xác định đúng bottleneck (CPU, bộ nhớ, I/O, lock) bằng công cụ profiling, rồi áp dụng fix chính xác. Không bao giờ optimize mà không đo trước.

## Điểm Chính

- <strong>Đo trước, optimize sau</strong>: hầu hết vấn đề hiệu năng nằm ở query DB, không phải code Java.
- <strong>CPU bottleneck</strong>: method nóng (flame graph), vòng lặp dày, tạo nhiều object gây GC pressure.
- <strong>Memory bottleneck</strong>: heap leak (tăng dần đến OOM), live set lớn gây GC pause dài.
- <strong>I/O bottleneck</strong>: query DB chậm (slow query log + EXPLAIN), network latency, thiếu connection pool.
- <strong>Lock contention</strong>: thread dump thấy nhiều thread BLOCKED chờ cùng một monitor.
- Công cụ: <code>jstack</code>, <code>jmap</code>, <code>jcmd</code>, <code>jstat</code>, <strong>async-profiler</strong> (an toàn production), <strong>Arthas</strong> (Alibaba).

## Ứng Dụng Thực Tế

Trong phỏng vấn, mô tả quy trình hệ thống: 1) Quan sát triệu chứng (CPU cao? bộ nhớ tăng? latency?), 2) Thu thập dữ liệu (thread dump / heap dump / GC log), 3) Xác định root cause, 4) Apply fix có mục tiêu, 5) Đo lại để xác nhận. Đừng chỉ nói "tôi tune JVM" mà không nói đã thay đổi gì và cải thiện bao nhiêu.

## Câu Hỏi Phỏng Vấn

1. Mô tả cách chẩn đoán CPU cao trong ứng dụng Java.
1. Heap dump và thread dump khác nhau thế nào?
1. Làm sao xác định method nào đang ngốn CPU nhất?
