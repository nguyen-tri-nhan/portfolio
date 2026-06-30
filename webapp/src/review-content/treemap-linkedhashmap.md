---
key: "TreeMap / LinkedHashMap"
title: "TreeMap & LinkedHashMap"
crumb: "1. Core Java › Collections"
---

TreeMap duy trì thứ tự key đã sắp xếp (qua red-black tree, O(log n)); LinkedHashMap duy trì thứ tự insertion hoặc access (qua doubly-linked list chồng lên hash table, O(1)).

## Điểm Chính

- <code>TreeMap</code>: key phải là <code>Comparable</code> hoặc cung cấp <code>Comparator</code>. <code>firstKey()</code>, <code>lastKey()</code>, <code>headMap()</code>, <code>tailMap()</code> cho range query.
- <code>LinkedHashMap</code>: tham số constructor <code>accessOrder=true</code> cho LRU order (truy cập cuối cùng đứng cuối).
- LRU cache trong 5 dòng: extend <code>LinkedHashMap</code>, override <code>removeEldestEntry</code>.
- <code>TreeMap</code> không thread-safe; dùng <code>ConcurrentSkipListMap</code> cho sorted map đồng thời.
- Cả hai iterate theo thứ tự xác định, không giống <code>HashMap</code> là không có thứ tự.

## Ví Dụ Code

*TreeMap: range queries cho order scheduler; LinkedHashMap: LRU + ordered JSON*

```java
import java.util.*;
import java.util.concurrent.*;

// ---- TreeMap: sorted by key — red-black tree, O(log n) ops ----
public class OrderScheduler {
    // Keys are scheduled timestamps; TreeMap keeps them sorted automatically
    private final TreeMap<Long, List<Order>> schedule = new TreeMap<>();

    public void scheduleOrder(Order order, long scheduledTimeMs) {
        schedule.computeIfAbsent(scheduledTimeMs, k -> new ArrayList<>()).add(order);
    }

    // Get all orders due NOW or earlier (range query — only possible with TreeMap)
    public List<Order> getDueOrders() {
        long now = System.currentTimeMillis();
        // headMap: all entries with key <= now (exclusive upper bound)
        NavigableMap<Long, List<Order>> due = schedule.headMap(now, true);
        List<Order> result = due.values().stream()
            .flatMap(Collection::stream).toList();
        due.clear();  // remove processed entries
        return result;
    }

    // O(log n) lookups: firstKey(), lastKey(), floorKey(), ceilingKey()
    public long nextScheduledTime() {
        return schedule.isEmpty() ? -1 : schedule.firstKey();
    }
}

// ---- LinkedHashMap: preserves insertion order (or access order) ----
// Use case 1: maintain ordered display of recently viewed products
public class RecentlyViewedProducts {
    // accessOrder=true: get() moves entry to tail → tail = most recently accessed
    private final int MAX_SIZE = 10;

    private final LinkedHashMap<String, Product> viewed = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Product> eldest) {
            return size() > MAX_SIZE;  // evict least-recently-accessed when over limit
        }
    };

    public synchronized void view(Product product) {
        viewed.put(product.getId(), product);    // access-order: moved to tail
    }

    // Returns products oldest-viewed first, newest last
    public synchronized List<Product> getRecentlyViewed() {
        return new ArrayList<>(viewed.values());
    }
}

// Use case 2: response field order for JSON serialization (insertion-order map)
public Map<String, Object> buildOrderSummary(Order order) {
    Map<String, Object> summary = new LinkedHashMap<>();  // preserves insertion order
    summary.put("orderId",    order.getId());       // appears first in JSON
    summary.put("customerId", order.getCustomerId());
    summary.put("total",      order.totalAmount());
    summary.put("status",     order.getStatus());
    return summary;
    // JSON: {"orderId":"...", "customerId":"...", "total":99.9, "status":"PENDING"}
    // HashMap would produce random field order — unreliable for consumers
}
```

## Ứng Dụng Thực Tế

Dùng <code>TreeMap</code> cho rate-limiting window (sắp xếp theo timestamp), lập lịch (sắp xếp theo thời gian thực thi), hoặc xếp hạng. Dùng <code>LinkedHashMap</code> cho LRU cache đơn giản trước khi dùng Caffeine hoặc Redis.

## Câu Hỏi Phỏng Vấn

1. Độ phức tạp thời gian của get/put trong TreeMap vs HashMap là gì?
1. Bạn implement LRU cache trong Java như thế nào?
1. Khi nào bạn dùng ConcurrentSkipListMap thay vì TreeMap?
