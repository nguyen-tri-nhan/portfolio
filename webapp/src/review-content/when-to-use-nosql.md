---
key: "When to Use NoSQL"
title: "Khi Nào Dùng NoSQL"
crumb: "4. Database › NoSQL"
---

Chọn NoSQL khi cần horizontal scale lớn, schema linh hoạt hay data model chuyên biệt (graph, time-series) mà bảng quan hệ model kém.

## Điểm Chính

- Dùng NoSQL khi: ghi volume cao (Cassandra), schema thay đổi thường (MongoDB), access pattern luôn theo key (Redis), relationship là query chính (Neo4j).
- Dùng SQL khi: ACID transaction quan trọng, multi-table join phức tạp phổ biến, cần reporting/analytics, team quen SQL.
- Polyglot persistence: dùng cả hai trong một hệ thống — PostgreSQL cho transactional data, Redis cho cache, Elasticsearch cho search.
- Đừng chọn NoSQL để tránh học SQL — hầu hết vấn đề hiệu năng là vấn đề index/query.

## Ví Dụ Code

*SQL vs NoSQL decision matrix: PostgreSQL, Redis, MongoDB, Elasticsearch, Cassandra — khi nào dùng mỗi loại*

```java
// ✅ Decision framework: SQL vs NoSQL per use case in e-commerce

// ─────────────────────────────────────────────────────────────────
// Use POSTGRESQL (SQL) when:                    REASON
// ─────────────────────────────────────────────────────────────────
// orders, payments, users                 → ACID transactions required
// inventory stock updates                 → concurrent writes need locking
// financial reporting (SUM, GROUP BY)     → complex joins + aggregations
// referential integrity (FK constraints)  → data consistency guaranteed by DB
// ─────────────────────────────────────────────────────────────────
// Use REDIS when:                               REASON
// ─────────────────────────────────────────────────────────────────
// user session tokens                     → sub-ms reads, TTL auto-expiry
// shopping cart state                     → Hash structure, user-scoped TTL
// product detail cache                    → reduce DB load, 10min TTL
// rate limiting per API key               → atomic INCR per time window
// distributed lock (checkout slot)        → SETNX with expiry
// ─────────────────────────────────────────────────────────────────
// Use MONGODB when:                             REASON
// ─────────────────────────────────────────────────────────────────
// product catalog                         → specs vary per category (electronics
//                                           vs clothing vs food — no fixed schema)
// user-generated content (reviews, Q&A)   → embedded in product doc, no JOIN
// CMS / blog posts                        → rich nested content, schema evolves
// ─────────────────────────────────────────────────────────────────
// Use ELASTICSEARCH when:                       REASON
// ─────────────────────────────────────────────────────────────────
// product search by keyword               → full-text, fuzzy match, relevance scoring
// faceted filtering (brand, price range)  → aggregation buckets at query time
// autocomplete / type-ahead               → completion suggester index
// ─────────────────────────────────────────────────────────────────
// Use CASSANDRA when:                           REASON
// ─────────────────────────────────────────────────────────────────
// order event log / audit trail           → high write throughput, time-series
// clickstream / user activity             → millions of events/sec, append-only
// IoT sensor readings                     → wide-column per device per time window

// ✅ Polyglot persistence wiring in Spring Boot:
// @Repository + JpaRepository         → PostgreSQL (via Spring Data JPA)
// @Autowired RedisTemplate            → Redis (via Spring Data Redis)
// @Autowired MongoTemplate            → MongoDB (via Spring Data MongoDB)
// @Autowired ElasticsearchOperations  → Elasticsearch (via Spring Data ES)

// ✅ Starting strategy: PostgreSQL first
// → add Redis cache when read latency becomes a bottleneck
// → add Elasticsearch when LIKE '%keyword%' queries are too slow
// → add MongoDB ONLY when schema flexibility is genuinely needed
```

## Ứng Dụng Thực Tế

Bắt đầu với PostgreSQL — ACID, hỗ trợ JSON xuất sắc và scale tốt với indexing đúng. Thêm Redis cho caching và Elasticsearch cho search. Chỉ thêm Cassandra/MongoDB khi có nhu cầu cụ thể, được validate.

## Câu Hỏi Phỏng Vấn

1. Trade-off giữa SQL và NoSQL cho financial application là gì?
1. Mô tả tình huống bạn dùng cả SQL và NoSQL trong cùng hệ thống.
1. Eventual consistency có nghĩa gì và khi nào chấp nhận được?
