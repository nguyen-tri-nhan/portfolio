---
key: kotlin-collections
title: "Collections & Sequences trong Kotlin"
crumb: "13. Kotlin > Collections & DSL"
---

Kotlin phân biệt rõ immutable (`List`, `Set`, `Map`) và mutable (`MutableList`, `MutableSet`, `MutableMap`) collections, đồng thời cung cấp `Sequence` cho xử lý lazy evaluation hiệu quả trên tập dữ liệu lớn.

## Điểm Chính

- **`listOf()`** trả về `List` immutable (read-only view); **`mutableListOf()`** trả về `MutableList`.
- `List` trong Kotlin vẫn có thể là `ArrayList` bên dưới — "immutable" nghĩa là không có write operations trên interface, không phải truly immutable.
- **`Sequence`**: lazy evaluation — mỗi element qua tất cả operators trước khi đến operator tiếp theo, không tạo intermediate collections.
- **`Collection`**: eager evaluation — mỗi operator tạo intermediate list đầy đủ.
- Dùng `asSequence()` khi: tập dữ liệu lớn, có nhiều chaining operators, hoặc khi muốn short-circuit với `first()` / `take()`.
- **`groupBy`**: `List<T>` → `Map<K, List<T>>`; **`associateBy`**: `List<T>` → `Map<K, T>` (một value per key).
- **`fold` vs `reduce`**: fold có initial value, reduce dùng phần tử đầu làm accumulator — fold an toàn hơn với empty list.
- **`partition`**: tách list thành `Pair<List<T>, List<T>>` theo điều kiện.

## Ví Dụ Code

*Immutable vs mutable, Sequence vs Collection, và key operators*

```kotlin
data class Product(val id: Int, val name: String, val category: String, val price: Double)

val products = listOf(
    Product(1, "Laptop", "Electronics", 999.0),
    Product(2, "Phone", "Electronics", 699.0),
    Product(3, "Desk", "Furniture", 299.0),
    Product(4, "Chair", "Furniture", 199.0),
    Product(5, "Tablet", "Electronics", 499.0),
)

// 1. Collection (eager) — tạo intermediate list tại mỗi bước
fun collectionEager(): List<String> {
    return products                          // [5 products]
        .filter { it.price > 400 }          // intermediate list: [3 products]
        .map { it.name.uppercase() }        // intermediate list: [3 names]
        .sortedBy { it }                    // final list
}

// 2. Sequence (lazy) — không tạo intermediate collections
fun sequenceLazy(): List<String> {
    return products
        .asSequence()                        // Chuyển sang lazy sequence
        .filter { it.price > 400 }           // Không compute ngay
        .map { it.name.uppercase() }         // Không compute ngay
        .sortedBy { it }                     // Terminal — kích hoạt tính toán
        .toList()
}

// 3. Short-circuit với Sequence
fun findFirstExpensiveProduct(): Product? {
    return products
        .asSequence()
        .filter { it.price > 500 }
        .first()  // Dừng ngay khi tìm thấy — không duyệt hết list
}

// 4. groupBy — List<T> → Map<K, List<T>>
fun groupByCategory(): Map<String, List<Product>> {
    return products.groupBy { it.category }
    // { "Electronics": [Laptop, Phone, Tablet], "Furniture": [Desk, Chair] }
}

// groupBy với transform
fun groupedNames(): Map<String, List<String>> {
    return products.groupBy({ it.category }, { it.name })
}

// 5. associateBy — Map<K, T> (last value wins nếu trùng key)
fun productById(): Map<Int, Product> {
    return products.associateBy { it.id }
    // { 1: Laptop, 2: Phone, 3: Desk, ... }
}

// associate — Map<K, V> tùy chỉnh cả key và value
fun priceMap(): Map<String, Double> {
    return products.associate { it.name to it.price }
}

// 6. fold và reduce
fun totalPrice(): Double {
    return products.fold(0.0) { acc, product -> acc + product.price }
}

fun sumWithReduce(): Double {
    return products.map { it.price }.reduce { acc, price -> acc + price }
    // Cẩn thận: reduce throw exception nếu list empty
}

// fold an toàn hơn cho empty list
fun safeTotal(items: List<Product>): Double =
    items.fold(0.0) { acc, p -> acc + p.price }  // Trả về 0.0 nếu empty

// 7. flatMap — flatten nested collections
fun allTags(): List<String> {
    data class Item(val name: String, val tags: List<String>)
    val items = listOf(
        Item("A", listOf("kotlin", "jvm")),
        Item("B", listOf("java", "jvm", "spring"))
    )
    return items.flatMap { it.tags }  // ["kotlin", "jvm", "java", "jvm", "spring"]
}

// 8. partition — tách list theo điều kiện
fun partitionProducts(): Pair<List<Product>, List<Product>> {
    val (expensive, affordable) = products.partition { it.price > 500 }
    println("Expensive: ${expensive.map { it.name }}")
    println("Affordable: ${affordable.map { it.name }}")
    return expensive to affordable
}

// 9. zip, zipWithNext
fun zipExample() {
    val names = listOf("Alice", "Bob", "Charlie")
    val scores = listOf(85, 92, 78)

    val pairs = names.zip(scores)  // [(Alice, 85), (Bob, 92), (Charlie, 78)]
    val combined = names.zip(scores) { name, score -> "$name: $score" }
}

// 10. Mutable vs immutable
fun mutabilityDemo() {
    val readOnly: List<Int> = listOf(1, 2, 3)
    // readOnly.add(4) // Compile error — không có add()

    val mutable: MutableList<Int> = mutableListOf(1, 2, 3)
    mutable.add(4)
    mutable.removeAt(0)

    // Convert
    val fromMutable: List<Int> = mutable.toList()      // snapshot
    val toMutable: MutableList<Int> = readOnly.toMutableList()  // copy
}
```

## Ứng Dụng Thực Tế

Trong Spring Boot, collection operators thay thế nhiều database queries phức tạp khi data đã được load: `groupBy` để group entities thành DTOs, `associateBy` để tạo lookup map từ list, `filter + map` để transform response. Với Sequence, nên dùng khi xử lý streaming data từ file hoặc kết quả lớn từ DB — tránh tạo intermediate list tốn bộ nhớ. Tuy nhiên, Sequence không phải lúc nào cũng nhanh hơn — với collection nhỏ (<1000 items) và ít operators, Collection eager có thể nhanh hơn do JVM optimization.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sequence và Collection khác nhau như thế nào? Khi nào dùng Sequence?</strong></summary>

**A:** **Collection** (eager): mỗi operator (`filter`, `map`) tạo một intermediate list đầy đủ rồi pass sang operator tiếp theo. Với 1M items và 3 operators → 3 intermediate lists. **Sequence** (lazy): mỗi element đi qua tất cả operators trước khi element tiếp theo được xử lý — không tạo intermediate collections. Dùng Sequence khi: (1) tập dữ liệu lớn (>10K items); (2) có nhiều chaining operators; (3) muốn short-circuit với `first()`, `find()`, `take()`. Không dùng Sequence cho tập nhỏ — setup overhead không đáng.

</details>

<details>
<summary><strong>groupBy và associateBy khác nhau như thế nào?</strong></summary>

**A:** **`groupBy(keySelector)`** tạo `Map<K, List<T>>` — nhiều values per key, không mất dữ liệu. Dùng khi một key có thể có nhiều elements (vd: group products by category). **`associateBy(keySelector)`** tạo `Map<K, T>` — một value per key, nếu trùng key thì value sau đè lên. Dùng khi key là unique identifier (vd: products by ID). Nhầm lẫn phổ biến: dùng `associateBy` khi key không unique → mất data. Rule: unique key → `associateBy`; non-unique key → `groupBy`.

</details>

<details>
<summary><strong>asSequence() có phải lúc nào cũng nhanh hơn không?</strong></summary>

**A:** Không. Với **collection nhỏ** (<1000 items) và **ít operators**, eager Collection thường nhanh hơn vì JVM optimize tốt intermediate lists và Sequence có overhead cho lazy wrapper. Sequence thực sự có lợi khi: (1) tập dữ liệu lớn giảm memory pressure; (2) short-circuit — `products.asSequence().filter { expensive }.first()` dừng ngay khi tìm thấy phần tử đầu tiên, không duyệt hết; (3) nhiều operators (3+) trên tập lớn. Benchmark trước khi optimize — đừng thêm `asSequence()` vào tất cả code vì "tưởng" nhanh hơn.

</details>
