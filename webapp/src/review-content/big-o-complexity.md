---
key: "Big-O Complexity"
title: "Big-O: Phân Tích Độ Phức Tạp"
crumb: "24. Data Structures & Algorithms › Fundamentals"
---

Big-O mô tả **thời gian chạy (hoặc bộ nhớ) tăng thế nào khi input tăng**, bỏ qua hằng số và các số hạng nhỏ. Nó không cho biết code chạy mất bao nhiêu mili giây, nhưng cho biết code có "sập" khi dữ liệu tăng từ 1.000 lên 1.000.000 bản ghi hay không — câu hỏi quan trọng hơn nhiều trong production.

## Điểm Chính

- **Định nghĩa trực giác**: `f(n) = O(g(n))` nghĩa là khi `n` đủ lớn, `f(n)` không vượt quá `c·g(n)` với một hằng số `c`. Big-O là **cận trên**; trong phỏng vấn và thực tế thường dùng để nói trường hợp xấu nhất (worst case).
- **Quy tắc rút gọn**: bỏ hằng số (`O(2n)` → `O(n)`), giữ số hạng lớn nhất (`O(n² + n)` → `O(n²)`), các input khác nhau dùng biến khác nhau (`O(n + m)`, không gộp thành `O(n)`).
- **Các lớp thường gặp** (tăng dần):

| Big-O | Tên | Ví dụ | n = 1.000.000 |
|---|---|---|---|
| O(1) | hằng số | `HashMap.get`, truy cập mảng theo index | 1 |
| O(log n) | logarit | binary search, `TreeMap.get` | ~20 |
| O(n) | tuyến tính | duyệt list, `ArrayList.contains` | 10⁶ |
| O(n log n) | | sort tốt (`Arrays.sort`, merge sort) | ~2·10⁷ |
| O(n²) | bình phương | 2 vòng lặp lồng nhau trên cùng dữ liệu | 10¹² — không chạy nổi |
| O(2ⁿ) | lũy thừa | duyệt mọi tập con | — |
| O(n!) | giai thừa | duyệt mọi hoán vị | — |

- **Ước lượng nhanh**: máy tính xử lý khoảng 10⁸ thao tác đơn giản mỗi giây (con số ước lượng, không chính xác). `n = 10⁵` thì O(n²) = 10¹⁰ → quá chậm, cần O(n log n) hoặc O(n).
- **Amortized** (khấu hao): `ArrayList.add` đôi khi phải copy toàn bộ mảng khi đầy (O(n)), nhưng tính trung bình trên chuỗi thao tác vẫn là O(1) — Javadoc gọi là *amortized constant time*.
- **Space complexity**: bộ nhớ phụ ngoài input. Đệ quy tốn O(độ sâu) stack — đệ quy sâu 10⁵ tầng có thể gây `StackOverflowError`.
- **Best / average / worst**: quicksort trung bình O(n log n) nhưng xấu nhất O(n²); `HashMap.get` trung bình O(1), xấu nhất khi mọi key trùng bucket — trước Java 8 là O(n), từ Java 8 bucket lớn chuyển thành cây nên còn O(log n).

## Ví Dụ Code

*Nhận diện độ phức tạp*

```java
// O(1)
int first = arr[0];

// O(n)
for (int x : arr) sum += x;

// O(n²) — hai vòng lồng nhau trên cùng input
for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++)       // n(n-1)/2 lần → vẫn O(n²)
        if (arr[i] + arr[j] == target) return true;

// O(n + m), KHÔNG phải O(n²) — hai vòng nối tiếp, input khác nhau
for (Order o : orders) ...
for (Customer c : customers) ...

// O(log n) — mỗi bước chia đôi không gian tìm kiếm
int lo = 0, hi = n - 1;
while (lo <= hi) {
    int mid = lo + (hi - lo) / 2;          // tránh tràn số của (lo + hi) / 2
    if (arr[mid] == target) return mid;
    if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;
}

// O(n log n) — sort rồi duyệt
Arrays.sort(arr);                          // O(n log n)
for (int x : arr) ...                      // O(n) → tổng O(n log n)
```

*O(n²) ẩn trong code "trông như O(n)"*

```java
// ❌ contains trên List là O(n) → cả vòng lặp O(n·m)
List<Long> blockedIds = loadBlockedIds();          // m phần tử
for (Order o : orders) {                           // n phần tử
    if (blockedIds.contains(o.customerId())) ...   // O(m) mỗi lần
}

// ✅ Đổi sang HashSet: O(m) để dựng + O(1) mỗi lần tra → O(n + m)
Set<Long> blocked = new HashSet<>(loadBlockedIds());
for (Order o : orders) {
    if (blocked.contains(o.customerId())) ...
}

// ❌ remove(0) trên ArrayList dịch toàn bộ phần tử → O(n) mỗi lần, vòng lặp O(n²)
while (!list.isEmpty()) process(list.remove(0));

// ✅ ArrayDeque.poll() là O(1)
Deque<Task> queue = new ArrayDeque<>(list);
while (!queue.isEmpty()) process(queue.poll());

// ❌ Nối String trong vòng lặp — mỗi lần copy toàn bộ chuỗi cũ → O(n²) ký tự
// ✅ StringBuilder → O(n)
```

*Đệ quy: thời gian và bộ nhớ*

```java
// Fibonacci đệ quy thô: O(2ⁿ) thời gian — fib(50) không chạy xong trong thời gian hợp lý
long fib(int n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }

// Nhớ kết quả (memoization): O(n) thời gian, O(n) bộ nhớ
long fibMemo(int n, long[] memo) {
    if (n < 2) return n;
    if (memo[n] != 0) return memo[n];
    return memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
}

// Lặp: O(n) thời gian, O(1) bộ nhớ
long fibIter(int n) {
    long a = 0, b = 1;
    for (int i = 0; i < n; i++) { long t = a + b; a = b; b = t; }
    return a;
}
```

## Ứng Dụng Thực Tế

**N+1 query là vấn đề độ phức tạp**: 1 query lấy n đơn hàng + n query lấy khách hàng = O(n) lần gọi mạng, mỗi lần tốn cả mili giây. Dùng `JOIN FETCH`/batch fetch để về O(1) query.

**Database cũng có Big-O**: không có index → full table scan O(n); B-Tree index → O(log n). Query chạy nhanh trên máy dev với 100 dòng có thể chết trên production với 10 triệu dòng — luôn nghĩ theo `n` thật.

**Big-O không phải tất cả**: với `n` nhỏ, hằng số và cache CPU quyết định. `ArrayList` duyệt tuần tự thường nhanh hơn `LinkedList` dù cùng O(n) vì dữ liệu nằm liên tục trong bộ nhớ. Đo bằng profiler/JMH trước khi tối ưu.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Độ phức tạp của đoạn code có hai vòng lặp lồng nhau luôn là O(n²)?</strong></summary>

**A:** Không. Phụ thuộc số lần lặp thực tế. Vòng ngoài n lần, vòng trong m lần (input khác) → O(n·m). Vòng trong chạy cố định 26 lần (bảng chữ cái) → O(n). Vòng trong nhân đôi biến chạy (`for (j = 1; j < n; j *= 2)`) → O(n log n). Hai con trỏ cùng tiến trên một mảng (sliding window) dù viết lồng nhau vẫn là O(n) vì mỗi con trỏ đi qua mỗi phần tử tối đa một lần.

</details>

<details>
<summary><strong>Amortized O(1) nghĩa là gì? Ví dụ.</strong></summary>

**A:** Một thao tác riêng lẻ có thể tốn kém, nhưng tổng chi phí của chuỗi n thao tác là O(n), nên trung bình mỗi thao tác O(1). Ví dụ `ArrayList.add`: khi mảng đầy thì cấp phát mảng mới lớn hơn khoảng 1,5 lần và copy (O(n)), nhưng vì dung lượng tăng theo cấp số nhân, số lần copy rất thưa — tổng số phần tử được copy qua n lần add là O(n). Tương tự với `HashMap` khi resize. Khác với average-case: amortized là đảm bảo cho cả chuỗi thao tác, không phụ thuộc phân phối input.

</details>

<details>
<summary><strong>Tại sao binary search là O(log n)?</strong></summary>

**A:** Mỗi bước so sánh loại bỏ một nửa phần còn lại: n → n/2 → n/4 → ... → 1. Số bước k thỏa n/2ᵏ = 1 → k = log₂ n. Với 1 tỷ phần tử chỉ cần khoảng 30 bước. Điều kiện: dữ liệu đã sắp xếp và truy cập ngẫu nhiên O(1) (mảng, không phải linked list). Lưu ý tính `mid = lo + (hi - lo) / 2` để tránh tràn `int`.

</details>

<details>
<summary><strong>Đệ quy ảnh hưởng thế nào đến space complexity?</strong></summary>

**A:** Mỗi lời gọi đệ quy chiếm một stack frame cho tới khi trả về, nên bộ nhớ phụ ≥ O(độ sâu đệ quy). Duyệt cây cân bằng: O(log n); cây lệch hoặc đệ quy trên list: O(n) — với n lớn gây `StackOverflowError` (stack mặc định của thread thường vài trăm KB tới 1 MB). Java không tối ưu tail-call, nên đệ quy sâu cần viết lại bằng vòng lặp với stack tường minh (`ArrayDeque`).

</details>
