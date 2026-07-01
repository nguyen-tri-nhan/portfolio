---
key: "Collections"
title: "Java Collections Framework"
crumb: "1. Core Java"
---

Java Collections cung cấp các cấu trúc dữ liệu chuẩn (List, Set, Map, Queue) với đặc điểm hiệu năng khác nhau — chọn đúng loại là chủ đề phỏng vấn cốt lõi.

## Điểm Chính

- <strong>List</strong>: có thứ tự, cho phép trùng lặp. <code>ArrayList</code> (truy cập ngẫu nhiên O(1)), <code>LinkedList</code> (insert/delete O(1) tại vị trí).
- <strong>Set</strong>: không trùng lặp. <code>HashSet</code> O(1), <code>TreeSet</code> O(log n) có thứ tự, <code>LinkedHashSet</code> thứ tự insertion.
- <strong>Map</strong>: key-value. <code>HashMap</code> O(1), <code>TreeMap</code> O(log n) có thứ tự, <code>LinkedHashMap</code> thứ tự insertion.
- <strong>Queue/Deque</strong>: <code>ArrayDeque</code> được ưu tiên hơn <code>Stack</code> và <code>LinkedList</code>.
- Thread-safe wrapper: <code>Collections.synchronizedList()</code> nhưng ưu tiên <code>ConcurrentHashMap</code>, <code>CopyOnWriteArrayList</code>.

## Ví Dụ Code

*Collections: List/Set/Map/Queue trong Order domain với grouping và Collectors*

```java
import java.util.*;
import java.util.stream.*;

public class OrderCollectionsDemo {

    // ----- List: ordered, allows duplicates -----
    public List<Order> getPendingOrders(List<Order> all) {
        // ArrayList: O(1) random access — ideal for filter + iterate
        List<Order> pending = new ArrayList<>();
        for (Order o : all) {
            if (o.getStatus() == OrderStatus.PENDING) pending.add(o);
        }
        return Collections.unmodifiableList(pending);  // safe return
    }

    // ----- Set: no duplicates — track unique customers -----
    public Set<String> uniqueCustomers(List<Order> orders) {
        Set<String> customers = new LinkedHashSet<>();  // insertion-order preserved
        orders.forEach(o -> customers.add(o.getCustomerId()));
        return customers;
    }

    // ----- Map: grouping orders by status -----
    public Map<OrderStatus, List<Order>> groupByStatus(List<Order> orders) {
        // computeIfAbsent — atomic "create list if absent, then add"
        Map<OrderStatus, List<Order>> grouped = new EnumMap<>(OrderStatus.class);
        orders.forEach(o -> grouped
            .computeIfAbsent(o.getStatus(), k -> new ArrayList<>())
            .add(o));
        return grouped;
    }

    // ----- Queue: processing order queue (FIFO) -----
    public void processQueue(Deque<Order> queue) {
        // ArrayDeque: preferred over LinkedList for queue/stack use
        while (!queue.isEmpty()) {
            Order order = queue.poll();  // null-safe (returns null if empty)
            processOrder(order);
        }
    }

    // ----- Stream + Collectors grouping (concise alternative) -----
    public Map<String, DoubleSummaryStatistics> revenueByProduct(List<Order> orders) {
        return orders.stream()
            .flatMap(o -> o.getItems().stream())
            .collect(Collectors.groupingBy(
                OrderItem::getProductId,
                Collectors.summarizingDouble(i -> i.totalPrice().doubleValue())
            ));
        // Result: { "P-001" → {count=42, sum=54321.0, min=99.9, max=1299.9} }
    }
}
```

## Ứng Dụng Thực Tế

Dùng <code>List.of()</code> và <code>Map.of()</code> cho immutable collection. Dùng <code>computeIfAbsent</code> thay vì pattern null-check+put. Với truy cập đồng thời, <code>ConcurrentHashMap</code> với <code>merge()</code> hoặc <code>compute()</code> cho thao tác atomic.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa ArrayList và LinkedList là gì?</strong></summary>

**A:** **ArrayList**: dynamic array, O(1) random access (`get(i)`), O(n) insert/delete giữa list (shift elements), cache-friendly vì contiguous memory. **LinkedList**: doubly linked, O(1) insert/delete ở head/tail, O(n) random access (traverse), pointer overhead per node. Thực tế: ArrayList tốt hơn cho hầu hết use case vì cache locality. LinkedList chỉ tốt khi cần O(1) add/remove đầu cuối và không cần random access.

</details>

<details>
<summary><strong>HashMap xử lý hash collision như thế nào?</strong></summary>

**A:** Java HashMap dùng **chaining**: mỗi bucket là một linked list (Java 7-) hoặc TreeMap khi chain dài ≥ 8 (Java 8+ — `TREEIFY_THRESHOLD`). Khi put: tính `hashCode()`, find bucket, traverse chain tìm key equal; nếu không có → add node. Load factor (default 0.75): khi 75% capacity → resize gấp đôi và rehash. TreeMap trong bucket: O(log n) thay vì O(n) khi nhiều collision — tránh worst case hash DoS.

</details>

<details>
<summary><strong>Khi nào bạn dùng CopyOnWriteArrayList?</strong></summary>

**A:** Dùng khi **read cực nhiều, write rất ít**: mỗi write tạo một bản copy mới của array → read concurrent không bao giờ block (lock-free read), không cần synchronize khi đọc. Use case điển hình: danh sách listener/subscriber đăng ký một lần rồi ít thay đổi; cache immutable data. Không dùng khi write thường xuyên — copy O(n) mỗi write cực tốn. `ConcurrentHashMap` cho map use case tương tự.

</details>
