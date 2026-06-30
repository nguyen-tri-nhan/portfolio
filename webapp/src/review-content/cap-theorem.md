---
key: "CAP Theorem"
title: "CAP Theorem"
crumb: "7. System Design"
---

CAP Theorem phát biểu rằng hệ thống phân tán có thể đảm bảo tối đa hai trong ba: Consistency (tất cả node thấy cùng dữ liệu), Availability (mọi request nhận response) và Partition Tolerance (tồn tại khi network chia cắt).

## Điểm Chính

- <strong>Consistency</strong>: mọi read thấy write gần nhất (hoặc lỗi).
- <strong>Availability</strong>: mọi request nhận response không lỗi (có thể stale).
- <strong>Partition Tolerance</strong>: hệ thống hoạt động dù network partition (mất message giữa node).
- Thực tế: network partition SẼ xảy ra, vì vậy bạn phải chọn giữa C và A.
- <strong>CP</strong>: HBase, Zookeeper, MongoDB (w:majority). Nhất quán nhưng có thể từ chối request khi partition.
- <strong>AP</strong>: Cassandra, CouchDB, DynamoDB (eventually consistent). Available nhưng có thể trả stale data.
- PACELC: mở rộng CAP — cũng xem xét trade-off Latency vs Consistency ngay cả khi không có partition.

## Ví Dụ Code

*CAP: CP vs AP examples per-operation; Cassandra ConsistencyLevel tuning; PACELC extension*

```java
// CAP Theorem: during network partition, choose Consistency OR Availability
// In practice: partition WILL happen → design for C or A, not both

// CP System (ZooKeeper, etcd): consistency over availability
// During partition: minority partition REJECTS writes → returns error
// Use case: distributed lock, leader election, config management
// → Correctness critical; brief unavailability acceptable

// AP System (Cassandra, DynamoDB): availability over consistency
// During partition: BOTH sides accept writes → stale/conflicting reads possible
// After partition heals: conflict resolution (last-write-wins, CRDTs)
// Use case: shopping cart, social media feed, user profile

// Cassandra: tune C vs A PER OPERATION using ConsistencyLevel
// ONE:    fastest, AP-like — 1 replica responds (may be stale)
// QUORUM: balanced — majority (N/2+1) replicas agree
// ALL:    CP-like — all replicas must respond (highest latency, lowest availability)

// Real system examples for your domain:
// order-events Kafka topic:        AP → message loss impossible, duplicates OK
// payment-events (charge):         CP → consistency critical, brief unavailability OK
// product catalog:                 AP → stale price for 1s is fine
// inventory reservation:           CP → oversell must be prevented
// user session:                    AP → stale session data fine
// distributed lock (order dedup):  CP → must be correct to prevent double-charge

// PostgreSQL (single node): not subject to partition — provides strong consistency
// PostgreSQL + streaming replication: CP → replica may lag, primary is source of truth
// CockroachDB / Google Spanner: CP with global distribution (Paxos/TrueTime)

// PACELC extension: even without partition, trade Latency vs Consistency
// DynamoDB (EL=L): optimizes for low latency → may return stale data
// CockroachDB (EC=C): optimizes for consistency → slightly higher latency
```

## Ứng Dụng Thực Tế

CAP là framework để suy luận về trade-off, không phải checklist nghiêm ngặt. Hệ thống hiện đại (Spanner, CockroachDB) đạt "external consistency" trong thực tế bằng cách giả định partition hiếm và giảm thiểu tác động. Biết DB của bạn cung cấp đảm bảo nào và thiết kế phù hợp.

## Câu Hỏi Phỏng Vấn

1. Hệ thống có thể CA (consistent và available nhưng không partition-tolerant) không?
1. Đưa ví dụ về hệ thống CP và AP và giải thích lựa chọn.
1. PACELC là gì và mở rộng CAP thế nào?
