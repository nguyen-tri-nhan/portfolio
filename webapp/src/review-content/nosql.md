---
key: "NoSQL"
title: "Cơ Sở Dữ Liệu NoSQL"
crumb: "4. Database"
---

DB NoSQL đánh đổi relational consistency/SQL để lấy schema linh hoạt, horizontal scalability và data model chuyên biệt (document, key-value, wide-column, graph).

## Điểm Chính

- <strong>Key-Value</strong>: Redis, DynamoDB — O(1) lookup theo key. Tốt cho caching, session.
- <strong>Document</strong>: MongoDB, Firestore — document giống JSON, schema linh hoạt, dữ liệu lồng nhau.
- <strong>Wide-Column</strong>: Cassandra, HBase — hàng với cột động; xuất sắc cho time-series, IoT.
- <strong>Graph</strong>: Neo4j — node và edge; query duyệt relationship hiệu quả.
- CAP: hầu hết NoSQL chọn Availability + Partition Tolerance (AP) thay vì Consistency.

## Ví Dụ Code

*NoSQL type decision matrix: Redis (key-value), MongoDB (document), Cassandra (wide-column), Neo4j (graph)*

```java
// ✅ NoSQL decision matrix for an e-commerce platform

// Key-Value (Redis): O(1) lookup — perfect for session, cart cache, rate limiting
// String: GET/SET user session token
// Hash:   HGETALL cart:user:42 → {productId: qty, ...}
// ZSet:   ZADD leaderboard score userId → sorted rankings
// TTL:    EXPIRE session:abc123 1800 → auto-expire in 30 min

// Document (MongoDB): schema-flexible product catalog
// Products have wildly different attributes per category:
{
  "_id": "prod_001",
  "name": "iPhone 15 Pro",
  "category": "Electronics",
  "price": 999.00,
  "specs": {                         // ← Electronics-specific nested object
    "storage": "256GB", "color": "Titanium", "chip": "A17 Pro"
  },
  "reviews": [                       // ← Embedded reviews (co-located with product)
    { "userId": "u42", "rating": 5, "text": "Great phone!", "date": "2024-01-10" }
  ],
  "tags": ["smartphone", "5G", "apple"]
}
// Relational equivalent: product + product_specs + reviews tables + EAV anti-pattern

// Wide-Column (Cassandra): high-write time-series / event logs
// Designed for: millions of order_events/sec across distributed nodes
// Row key = order_id (partition key), column = event_timestamp
// No joins; query pattern must be defined at schema design time

// Graph (Neo4j): relationship traversal — "customers who bought X also bought Y"
// MATCH (u:User)-[:PURCHASED]->(p:Product)<-[:PURCHASED]-(other:User)
//       -[:PURCHASED]->(rec:Product)
// WHERE u.id = 42 AND NOT (u)-[:PURCHASED]->(rec)
// RETURN rec, COUNT(*) AS frequency ORDER BY frequency DESC LIMIT 5

// ✅ When to choose each:
// Redis:     session store, distributed cache, pub/sub, rate limiting, leaderboard
// MongoDB:   catalog with variable schema, content management, user-generated content
// Cassandra: IoT sensor data, activity logs, time-series analytics
// Neo4j:     social graph, fraud detection, recommendation engine
```

## Ứng Dụng Thực Tế

Chọn NoSQL khi: cần horizontal scale qua nhiều node, dữ liệu tự nhiên là document/graph, hoặc cần schema evolution linh hoạt. Đừng chọn NoSQL để tránh SQL — hầu hết vấn đề scalability được giải quyết với SQL indexing đúng đắn.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào bạn chọn MongoDB thay vì PostgreSQL?</strong></summary>

**A:** Chọn **MongoDB** khi: (1) Schema thay đổi thường xuyên, không muốn migration. (2) Data là hierarchical JSON tự nhiên (document fits domain model). (3) Cần horizontal scale writes (sharding). (4) Read pattern là load whole document. Chọn **PostgreSQL** khi: (1) ACID transaction nhiều table. (2) Complex JOIN. (3) Strong consistency bắt buộc. (4) SQL là chuẩn của team. MongoDB 4.0+ có transaction nhưng overhead cao hơn PostgreSQL. PostgreSQL jsonb cũng support semi-structured data — không nhất thiết phải dùng Mongo.

</details>

<details>
<summary><strong>BASE có nghĩa gì trong ngữ cảnh NoSQL?</strong></summary>

**A:** **B**asically Available: system luôn available, dù có thể trả về stale/partial data khi partition. **S**oft state: system state có thể thay đổi theo thời gian kể cả không có input mới — do replication propagation. **E**ventually consistent: sau khoảng thời gian không có update mới, tất cả replica sẽ hội tụ về cùng giá trị. BASE là trade-off để đạt được high availability và partition tolerance (AP trong CAP). NoSQL theo BASE: Cassandra, DynamoDB, Couchbase.

</details>

<details>
<summary><strong>Cassandra đạt write throughput cao thế nào?</strong></summary>

**A:** Cassandra write path: (1) Write vào **commit log** (sequential disk write — nhanh). (2) Write vào in-memory **MemTable**. (3) Ack client ngay — không cần block chờ disk. (4) Khi MemTable đầy → flush xuống **SSTable** (immutable file). Background: **compaction** merge SSTable. Đặc điểm: (1) Sequential write (không random write) → disk I/O hiệu quả. (2) **Masterless** (peer-to-peer): write đến bất kỳ node nào → no write bottleneck. (3) Multi-datacenter replication. Kết quả: hàng triệu write/s linear scalable.

</details>
