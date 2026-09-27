---
key: "Core Data Structures"
title: "Cấu Trúc Dữ Liệu Cốt Lõi & Java Collections"
crumb: "24. Data Structures & Algorithms › Fundamentals"
---

Chọn đúng cấu trúc dữ liệu thường quan trọng hơn thuật toán thông minh. Bài này đi qua các cấu trúc nền tảng — mảng, linked list, hash table, stack/queue, heap, cây, đồ thị — và cài đặt tương ứng trong Java để bạn chọn đúng collection khi code thật.

## Điểm Chính

- **Mảng / `ArrayList`**: bộ nhớ liên tục → truy cập theo index O(1), duyệt rất nhanh nhờ CPU cache. Thêm cuối amortized O(1); chèn/xóa ở giữa O(n) vì phải dịch phần tử.
- **Linked list / `LinkedList`**: chèn/xóa O(1) **khi đã có node**, nhưng tìm tới vị trí là O(n); mỗi node là một object riêng → tốn bộ nhớ, duyệt chậm do không liên tục. Thực tế hiếm khi tốt hơn `ArrayList` hoặc `ArrayDeque`.
- **Hash table / `HashMap`, `HashSet`**: get/put/contains trung bình O(1), không giữ thứ tự. `LinkedHashMap` giữ thứ tự chèn (hoặc thứ tự truy cập → làm LRU cache).
- **Stack (LIFO) & Queue (FIFO)**: dùng **`ArrayDeque`** cho cả hai (`push/pop`, `offer/poll`) — Javadoc của `ArrayDeque`: *"likely to be faster than Stack when used as a stack, and faster than LinkedList when used as a queue"*. Tránh class `Stack` cũ (kế thừa `Vector`, đồng bộ không cần thiết).
- **Heap / `PriorityQueue`**: phần tử đầu luôn là **nhỏ nhất** theo thứ tự (min-heap; muốn max-heap truyền `Comparator.reverseOrder()`). `offer`/`poll` O(log n), `peek` O(1), `contains`/`remove(Object)` O(n). Không sắp xếp toàn bộ — duyệt bằng iterator không theo thứ tự.
- **Cây tìm kiếm cân bằng / `TreeMap`, `TreeSet`** (cây đỏ-đen): get/put/remove O(log n), key luôn có thứ tự → hỗ trợ `floorKey`, `ceilingKey`, `headMap`, `subMap` (truy vấn khoảng).
- **Đồ thị**: đỉnh + cạnh; lưu bằng *adjacency list* (`Map<Node, List<Node>>`, tiết kiệm cho đồ thị thưa) hoặc *adjacency matrix* (O(V²) bộ nhớ, tra cạnh O(1)). Duyệt bằng BFS (queue) / DFS (stack hoặc đệ quy).
- **Trie**: cây theo ký tự, tra prefix O(độ dài chuỗi) — autocomplete, lọc từ khóa.

## Ví Dụ Code

*Bảng độ phức tạp các collection hay dùng*

| Thao tác | ArrayList | LinkedList | ArrayDeque | HashMap/Set | TreeMap/Set | PriorityQueue |
|---|---|---|---|---|---|---|
| get theo index | O(1) | O(n) | — | — | — | — |
| thêm cuối / offer | O(1)* | O(1) | O(1)* | O(1)† | O(log n) | O(log n) |
| thêm/xóa đầu | O(n) | O(1) | O(1)* | — | — | poll: O(log n) |
| contains / get(key) | O(n) | O(n) | O(n) | O(1)† | O(log n) | O(n) |
| min / max | O(n) | O(n) | — | O(n) | O(log n) | peek: O(1) |

\* amortized · † trung bình; xấu nhất O(log n) khi bucket đã chuyển thành cây (Java 8+)

*Stack và Queue bằng ArrayDeque*

```java
Deque<Character> stack = new ArrayDeque<>();
stack.push('(');          // thêm vào đầu
stack.peek();             // xem đầu
stack.pop();              // lấy ra đầu

Deque<Integer> queue = new ArrayDeque<>();
queue.offer(1);           // thêm vào cuối
queue.poll();             // lấy ra đầu (null nếu rỗng)

// Kiểm tra ngoặc hợp lệ — bài stack kinh điển, O(n)
boolean isValid(String s) {
    Deque<Character> st = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
        switch (c) {
            case '(' -> st.push(')');
            case '[' -> st.push(']');
            case '{' -> st.push('}');
            default  -> { if (st.isEmpty() || st.pop() != c) return false; }
        }
    }
    return st.isEmpty();
}
```

*PriorityQueue — top K phần tử lớn nhất trong O(n log k)*

```java
// Giữ min-heap kích thước k: phần tử nhỏ nhất trong top-k nằm ở đầu, dễ loại bỏ
List<Integer> topK(int[] nums, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>();      // min-heap
    for (int x : nums) {
        heap.offer(x);
        if (heap.size() > k) heap.poll();                     // loại phần tử nhỏ nhất
    }
    return new ArrayList<>(heap);                              // chưa sắp xếp
}

// Max-heap theo field
PriorityQueue<Order> byTotalDesc =
        new PriorityQueue<>(Comparator.comparing(Order::total).reversed());
```

*TreeMap — truy vấn khoảng và "giá trị gần nhất"*

```java
// Bảng giá theo bậc: tìm mức giá áp dụng cho số lượng q
TreeMap<Integer, BigDecimal> tiers = new TreeMap<>(Map.of(
        1, new BigDecimal("10.00"),
        100, new BigDecimal("8.50"),
        1000, new BigDecimal("7.00")));

tiers.floorEntry(250).getValue();      // 8.50 — key lớn nhất ≤ 250
tiers.ceilingKey(101);                 // 1000 — key nhỏ nhất ≥ 101
tiers.headMap(1000);                   // {1=10.00, 100=8.50} — các key < 1000
```

*LinkedHashMap làm LRU cache*

```java
class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;
    LruCache(int capacity) {
        super(16, 0.75f, true);          // accessOrder = true: get() đưa entry xuống cuối
        this.capacity = capacity;
    }
    @Override protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;        // tự xóa entry ít dùng gần đây nhất
    }
}
// Không thread-safe — production dùng Caffeine
```

*Đồ thị: BFS tìm đường ngắn nhất (không trọng số)*

```java
int shortestPath(Map<String, List<String>> graph, String start, String target) {
    Deque<String> queue = new ArrayDeque<>(List.of(start));
    Map<String, Integer> dist = new HashMap<>(Map.of(start, 0));
    while (!queue.isEmpty()) {
        String node = queue.poll();
        if (node.equals(target)) return dist.get(node);
        for (String next : graph.getOrDefault(node, List.of())) {
            if (!dist.containsKey(next)) {           // đánh dấu khi đưa vào queue, tránh thêm trùng
                dist.put(next, dist.get(node) + 1);
                queue.offer(next);
            }
        }
    }
    return -1;   // O(V + E)
}
```

## Ứng Dụng Thực Tế

**Chọn collection theo câu hỏi bạn hỏi nó**:
- "Có chứa X không?" → `HashSet`.
- "Tra theo key" → `HashMap`.
- "Theo thứ tự / trong khoảng / gần nhất" → `TreeMap`.
- "Lấy phần tử ưu tiên nhất liên tục" → `PriorityQueue`.
- "Xử lý theo thứ tự đến" → `ArrayDeque`.
- Còn lại hầu hết → `ArrayList`.

**Hệ thống thật dùng đúng những cấu trúc này**: B-Tree (index database), hash table (Redis, cache), heap (scheduler, `DelayQueue`, timer), queue (message broker, thread pool), đồ thị (phụ thuộc giữa các bean trong Spring, phát hiện vòng lặp; định tuyến), trie (autocomplete), skip list (Redis sorted set, `ConcurrentSkipListMap`).

**Đa luồng**: các collection trên không thread-safe. Dùng `ConcurrentHashMap`, `ConcurrentLinkedQueue`, `BlockingQueue` (`ArrayBlockingQueue`, `LinkedBlockingQueue`) cho producer–consumer, `ConcurrentSkipListMap` thay `TreeMap`.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>ArrayList và LinkedList: chọn cái nào?</strong></summary>

**A:** Gần như luôn chọn `ArrayList`. Nó truy cập index O(1), thêm cuối amortized O(1), và duyệt nhanh vì dữ liệu liên tục trong bộ nhớ (thân thiện CPU cache). `LinkedList` chỉ nhanh khi chèn/xóa tại vị trí **đã có sẵn node** (qua `ListIterator`) — nhưng để tới được vị trí đó đã tốn O(n); mỗi phần tử tốn thêm một object node với 2 con trỏ. Cần thêm/xóa ở cả hai đầu thì dùng `ArrayDeque`.

</details>

<details>
<summary><strong>PriorityQueue hoạt động thế nào? Duyệt nó có ra thứ tự đã sắp xếp không?</strong></summary>

**A:** Là binary heap lưu trong mảng: phần tử ở vị trí i có con tại 2i+1 và 2i+2, mỗi node ≤ các con (min-heap). `offer` thêm vào cuối rồi "nổi lên" (O(log n)); `poll` lấy gốc, đưa phần tử cuối lên gốc rồi "chìm xuống" (O(log n)); `peek` O(1). Chỉ đảm bảo phần tử đầu là nhỏ nhất — iterator và `toString` **không** theo thứ tự. Muốn lấy theo thứ tự thì `poll` liên tục (heap sort, O(n log n)).

</details>

<details>
<summary><strong>HashMap và TreeMap khác nhau thế nào?</strong></summary>

**A:** `HashMap`: bảng băm, get/put trung bình O(1), không có thứ tự, key cần `hashCode`/`equals` đúng, cho phép một key `null`. `TreeMap`: cây đỏ-đen, O(log n), key luôn được sắp xếp theo `Comparable` hoặc `Comparator` (và dùng `compareTo`, không dùng `equals`, để xác định trùng key), hỗ trợ `firstKey`, `floorKey`, `subMap`... Dùng `TreeMap` khi cần thứ tự hoặc truy vấn khoảng; còn lại dùng `HashMap`.

</details>

<details>
<summary><strong>Cài đặt LRU cache thế nào?</strong></summary>

**A:** Cần get/put O(1) và biết phần tử ít dùng gần đây nhất: kết hợp hash map (key → node) với doubly linked list (thứ tự sử dụng). Get: tra map, chuyển node về đầu list. Put: thêm/cập nhật node ở đầu; vượt dung lượng thì xóa node cuối và key tương ứng trong map. Trong Java có sẵn: `LinkedHashMap` với `accessOrder = true` và override `removeEldestEntry`. Production đa luồng dùng Caffeine (thuật toán W-TinyLFU, tỉ lệ hit tốt hơn LRU thuần).

</details>

<details>
<summary><strong>BFS và DFS khác nhau thế nào, khi nào dùng cái nào?</strong></summary>

**A:** BFS duyệt theo từng lớp khoảng cách bằng queue → tìm được **đường ngắn nhất** trong đồ thị không trọng số; tốn bộ nhớ bằng độ rộng lớn nhất của một lớp. DFS đi sâu hết một nhánh rồi quay lui, dùng stack hoặc đệ quy → hợp với phát hiện chu trình, sắp xếp topo, tìm thành phần liên thông, duyệt mọi đường đi; bộ nhớ theo độ sâu. Cả hai O(V + E). Đồ thị có trọng số dương dùng Dijkstra (BFS với `PriorityQueue`).

</details>
