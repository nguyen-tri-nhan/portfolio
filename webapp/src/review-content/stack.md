---
key: "Stack"
title: "JVM Stack"
crumb: "1. Core Java › JVM Internals"
---

Mỗi thread có JVM Stack riêng chứa các frame (một frame mỗi lần gọi method) lưu local variable, operand stack và địa chỉ return — tồn tại độc lập với heap.

## Điểm Chính

- Stack là per-thread; heap được chia sẻ. Stack variable mặc định thread-safe.
- Mỗi frame chứa: mảng local variable, operand stack, tham chiếu constant pool, return value.
- Gọi method push frame; return pop frame — cấu trúc LIFO.
- <code>StackOverflowError</code>: vượt quá độ sâu stack — thường do đệ quy sâu/vô hạn.
- <code>-Xss</code> đặt kích thước stack mỗi thread (mặc định ~512KB–1MB tùy platform).
- Kiểu nguyên thủy và tham chiếu sống trên stack; object chúng tham chiếu sống trên heap.

## Ví Dụ Code

*Stack frame lifecycle: recursive OOM vs iterative fix + stack vs heap ownership*

```java
// ---- Stack frame anatomy ----
// Each method call pushes ONE frame onto the current thread's stack.
// Frame holds: local variables array, operand stack, reference to constant pool.
// Frame is popped when the method returns (or throws).

public class OrderTreeProcessor {

    // BAD: recursive descent without depth guard → StackOverflowError on deep category trees
    public BigDecimal sumRecursive(CategoryNode node) {
        // Every call = 1 frame pushed; deep tree exhausts -Xss budget
        if (node == null) return BigDecimal.ZERO;
        BigDecimal subtotal = node.getProducts().stream()
            .map(Product::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        return node.getChildren().stream()
            .map(this::sumRecursive)          // each child = another frame
            .reduce(subtotal, BigDecimal::add);
    }

    // GOOD: iterative with explicit stack — O(depth) memory on heap, not JVM stack
    public BigDecimal sumIterative(CategoryNode root) {
        Deque<CategoryNode> stack = new ArrayDeque<>();
        stack.push(root);
        BigDecimal total = BigDecimal.ZERO;

        while (!stack.isEmpty()) {
            CategoryNode node = stack.pop();
            total = node.getProducts().stream()
                .map(Product::getPrice)
                .reduce(total, BigDecimal::add);
            node.getChildren().forEach(stack::push);  // children queued, not recursed
        }
        return total;
    }

    // Coexistence demo: stack vs heap ownership
    public Order buildOrder(String customerId) {
        // 'customerId' ref lives on stack (local variable in this frame)
        // The actual String object lives on HEAP
        String id = UUID.randomUUID().toString(); // id ref: stack; String: heap
        List<OrderItem> items = new ArrayList<>(); // items ref: stack; ArrayList: heap
        return new Order(id, customerId, items);   // Order object: heap; returned to caller
    }
}

// ---- Tune thread stack size ----
// Default ~512KB–1MB per thread; large thread pools → significant memory
// java -Xss256k MyApp   (reduce if threads are shallow; increase if deep recursion needed)
// 500 threads × 1MB stack = 500MB before a single heap byte is allocated!
```

## Ứng Dụng Thực Tế

Virtual thread (Java 21+) có stack rất nhỏ và được JVM quản lý, không phải OS — chúng có thể block mà không tốn platform thread stack. Điều này thay đổi mô hình kinh tế của thread-per-request.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>StackOverflowError xảy ra khi nào và fix thế nào?</strong></summary>

**A:** StackOverflowError xảy ra khi call stack vượt quá kích thước tối đa do đệ quy không có base case hoặc đệ quy quá sâu. Default stack size: 256KB-1MB tùy JVM. Fix: (1) Thêm base case hoặc kiểm tra điều kiện dừng đúng, (2) Chuyển đệ quy thành iterative với explicit Stack, (3) Tăng stack size bằng `-Xss2m` (dùng nhiều memory hơn), (4) Dùng tail-call optimization (Java không hỗ trợ native, nhưng có thể simulate). Spring Stack trace dài không gây StackOverflow — chỉ là log.

</details>

<details>
<summary><strong>Stack và Heap khác nhau thế nào về lifecycle và thread safety?</strong></summary>

**A:** Stack: per-thread (mỗi thread có stack riêng), thread-safe tự nhiên vì không shared, LIFO, tự động dealloc khi method return. Heap: shared giữa tất cả thread, cần synchronization khi access concurrent, GC-managed, linh hoạt hơn về lifetime. Local primitive variables (int, boolean...) và references lưu trên Stack. Object instances và arrays luôn trên Heap. "Stack vs Heap allocation" là thread-safety chứ không phải performance — cả hai đều nhanh với modern JVM.

</details>
