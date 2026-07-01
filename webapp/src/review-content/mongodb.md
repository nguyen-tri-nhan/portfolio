---
key: "MongoDB"
title: "MongoDB"
crumb: "4. Database › NoSQL"
---

MongoDB là document database lưu BSON (binary JSON) document, cho phép schema linh hoạt, embedded document và horizontal sharding cho khối lượng ghi cao.

## Điểm Chính

- Collection (≈ bảng), Document (≈ hàng), Field (≈ cột) — nhưng schema linh hoạt.
- Embedded document vs reference: embed cho dữ liệu query cùng nhau; reference cho sub-document lớn hoặc chia sẻ.
- Indexing: cùng nền tảng B-tree; hỗ trợ compound, text, geospatial, TTL index.
- Aggregation pipeline: <code>$match</code>, <code>$group</code>, <code>$sort</code>, <code>$lookup</code> (join), <code>$project</code>.
- ACID transaction (v4.0+): multi-document, multi-collection transaction có sẵn.

## Ví Dụ Code

*MongoDB: @Document với embedded Review, Repository queries, Aggregation pipeline (group/unwind/lookup)*

```java
// ✅ MongoDB Document: product catalog with flexible schema per category
@Document(collection = "products")
public class Product {
    @Id
    private String id;
    private String name;
    private String category;
    private double price;
    private Map<String, Object> specs;         // flexible: different fields per category
    private List<String> tags;
    private List<Review> reviews;              // embedded: always queried with product

    // Nested class — embedded in same document (no JOIN needed)
    public static class Review {
        private String userId;
        private int rating;
        private String text;
        private LocalDateTime date;
    }
}

// ✅ Spring Data MongoDB Repository
public interface ProductRepository extends MongoRepository<Product, String> {
    // Query by field (Spring generates the MongoDB query)
    List<Product> findByCategoryAndPriceBetween(String category, double minPrice, double maxPrice);

    // Full-text search (requires text index: db.products.createIndex({name:"text",tags:"text"}))
    @TextIndexed
    List<Product> findByNameContaining(String keyword);
}

// ✅ MongoDB Aggregation Pipeline: revenue report by product category
@Repository
public class OrderReportRepository {
    @Autowired
    private MongoTemplate mongo;

    public List<CategoryRevenue> getRevenueByCategory(int topN) {
        Aggregation pipeline = Aggregation.newAggregation(
            // Stage 1: filter completed orders in last 30 days
            Aggregation.match(Criteria.where("status").is("COMPLETED")
                                      .and("createdAt").gte(LocalDateTime.now().minusDays(30))),
            // Stage 2: unwind items array — one document per order item
            Aggregation.unwind("items"),
            // Stage 3: group by product category
            Aggregation.group("items.category")
                .sum("items.subtotal").as("revenue")
                .count().as("orderCount")
                .avg("items.subtotal").as("avgItemValue"),
            // Stage 4: sort descending by revenue
            Aggregation.sort(Sort.by(Sort.Direction.DESC, "revenue")),
            // Stage 5: take top N
            Aggregation.limit(topN),
            // Stage 6: project final shape
            Aggregation.project("revenue", "orderCount", "avgItemValue")
                       .and("_id").as("category")
        );
        return mongo.aggregate(pipeline, "orders", CategoryRevenue.class).getMappedResults();
    }

    // ✅ $lookup: MongoDB JOIN (equivalent to SQL LEFT JOIN)
    public List<OrderWithUser> getOrdersWithUsers() {
        Aggregation pipeline = Aggregation.newAggregation(
            Aggregation.lookup("users", "customerId", "_id", "userInfo"),  // JOIN users collection
            Aggregation.unwind("userInfo"),
            Aggregation.project("status", "total", "createdAt")
                       .and("userInfo.email").as("customerEmail")
        );
        return mongo.aggregate(pipeline, "orders", OrderWithUser.class).getMappedResults();
    }
}
```

## Ứng Dụng Thực Tế

Dùng MongoDB khi dữ liệu tự nhiên là hierarchical/document-shaped và schema thay đổi thường xuyên. Cho analytics, aggregation pipeline mạnh nhưng cho reporting phức tạp, xem xét sync sang data warehouse. Luôn index field dùng trong $match và $sort.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào bạn embed vs reference document trong MongoDB?</strong></summary>

**A:** **Embed** (sub-document): khi data thường được truy cập cùng nhau, data ít thay đổi, quan hệ 1-1 hoặc 1-ít. Ví dụ: address trong user, items trong order. Ưu điểm: single read, atomic update. **Reference** (DBRef/manual): khi data được reuse bởi nhiều document, data lớn, quan hệ many-to-many, hoặc sub-document thay đổi thường xuyên. Ví dụ: user reference trong comment (user thông tin cần update một nơi). MongoDB không enforce referential integrity — phải handle trong app.

</details>

<details>
<summary><strong>MongoDB aggregation pipeline là gì?</strong></summary>

**A:** Pipeline là chuỗi **stage** xử lý document tuần tự: `$match` (filter), `$group` (aggregate), `$sort`, `$project` (reshape), `$lookup` (join), `$unwind` (flatten array), `$limit`, `$skip`. Ví dụ: `[{$match: {status:"A"}}, {$group: {_id:"$city", total:{$sum:"$amount"}}}, {$sort: {total:-1}}]` → sum amount by city cho active records. Mạnh hơn find() cho analytics — chạy trên server, không transfer raw data về client.

</details>

<details>
<summary><strong>MongoDB xử lý transaction thế nào?</strong></summary>

**A:** MongoDB 4.0+ hỗ trợ **multi-document ACID transaction** (trước đó chỉ single-document atomic). Cú pháp tương tự: `session.startTransaction()` → operation → `session.commitTransaction()`. Giới hạn: chỉ trong replica set hoặc sharded cluster; transaction duration tối đa 60s mặc định; overhead đáng kể — tránh transaction dài. Best practice: thiết kế schema để tận dụng single-document atomicity trước (embed); dùng multi-document transaction chỉ khi thực sự cần.

</details>
