---
key: "Algorithm Patterns"
title: "Các Pattern Thuật Toán Phỏng Vấn"
crumb: "24. Data Structures & Algorithms › Patterns"
---

Phần lớn bài coding interview (và nhiều bài toán thật) là biến thể của khoảng chục pattern. Học pattern — nhận ra "đây là bài sliding window", "đây là bài hash map đếm" — hiệu quả hơn nhiều so với học thuộc từng bài. Mỗi pattern dưới đây có dấu hiệu nhận biết, code mẫu và độ phức tạp.

## Điểm Chính

| Pattern | Dấu hiệu nhận biết | Độ phức tạp điển hình |
|---|---|---|
| Hash map / set | "đã gặp chưa", đếm tần suất, tìm cặp | O(n) thời gian, O(n) bộ nhớ |
| Two pointers | mảng **đã sắp xếp**, tìm cặp, đảo ngược, loại trùng tại chỗ | O(n), O(1) bộ nhớ |
| Sliding window | mảng/chuỗi **liên tiếp** dài nhất/ngắn nhất thỏa điều kiện | O(n) |
| Binary search | dữ liệu có thứ tự, hoặc "tìm giá trị nhỏ nhất thỏa điều kiện đơn điệu" | O(log n) |
| Prefix sum | tổng đoạn con nhiều lần, "đoạn con có tổng = k" | O(n) dựng, O(1) truy vấn |
| Stack | ngoặc, "phần tử lớn hơn kế tiếp" (monotonic stack) | O(n) |
| Heap | top K, trộn K list đã sắp xếp, median luồng dữ liệu | O(n log k) |
| BFS / DFS | cây, lưới, đồ thị, đường ngắn nhất không trọng số | O(V + E) |
| Backtracking | liệt kê mọi tổ hợp/hoán vị/tập con | lũy thừa |
| Dynamic programming | bài toán con chồng lấp + đếm cách / tối ưu | thường O(n) – O(n²) |

## Ví Dụ Code

*Hash map — Two Sum*

```java
// Tìm hai chỉ số có tổng = target. Thay vòng lặp lồng O(n²) bằng tra cứu O(1)
int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();          // giá trị → chỉ số
    for (int i = 0; i < nums.length; i++) {
        Integer j = seen.get(target - nums[i]);
        if (j != null) return new int[]{j, i};
        seen.put(nums[i], i);
    }
    return new int[0];
}
```

*Two pointers — mảng đã sắp xếp*

```java
boolean hasPairWithSum(int[] sorted, int target) {
    int l = 0, r = sorted.length - 1;
    while (l < r) {
        int sum = sorted[l] + sorted[r];
        if (sum == target) return true;
        if (sum < target) l++; else r--;                    // cần lớn hơn → tăng l; nhỏ hơn → giảm r
    }
    return false;
}
```

*Sliding window — chuỗi con dài nhất không lặp ký tự*

```java
int lengthOfLongestSubstring(String s) {
    Map<Character, Integer> lastIndex = new HashMap<>();
    int best = 0, left = 0;
    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        Integer prev = lastIndex.get(c);
        if (prev != null && prev >= left) left = prev + 1;  // thu hẹp cửa sổ qua khỏi ký tự trùng
        lastIndex.put(c, right);
        best = Math.max(best, right - left + 1);
    }
    return best;   // O(n): left và right mỗi cái chỉ tiến, không lùi
}
```

*Binary search trên đáp án*

```java
// Số request/giây tối thiểu để xử lý hết jobs trong h giờ — điều kiện "đủ nhanh" là đơn điệu
int minRate(int[] jobs, int h) {
    int lo = 1, hi = Arrays.stream(jobs).max().orElse(1);
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        long hours = 0;
        for (int j : jobs) hours += (j + mid - 1) / mid;    // làm tròn lên
        if (hours <= h) hi = mid;                           // đủ nhanh → thử chậm hơn
        else lo = mid + 1;
    }
    return lo;   // O(n log max)
}
```

*Prefix sum + hash map — số đoạn con có tổng = k (có số âm)*

```java
int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> countOfPrefix = new HashMap<>(Map.of(0, 1));
    int prefix = 0, count = 0;
    for (int x : nums) {
        prefix += x;
        count += countOfPrefix.getOrDefault(prefix - k, 0); // đoạn (j, i] có tổng k ⇔ prefix[j] = prefix[i] - k
        countOfPrefix.merge(prefix, 1, Integer::sum);
    }
    return count;
}
```

*Monotonic stack — số ngày phải chờ để có nhiệt độ cao hơn*

```java
int[] dailyTemperatures(int[] t) {
    int[] answer = new int[t.length];
    Deque<Integer> stack = new ArrayDeque<>();              // chỉ số, nhiệt độ giảm dần từ đáy lên đỉnh
    for (int i = 0; i < t.length; i++) {
        while (!stack.isEmpty() && t[i] > t[stack.peek()]) {
            int j = stack.pop();
            answer[j] = i - j;
        }
        stack.push(i);
    }
    return answer;   // O(n): mỗi chỉ số push và pop tối đa một lần
}
```

*Backtracking — mọi tập con*

```java
List<List<Integer>> subsets(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    backtrack(nums, 0, new ArrayList<>(), result);
    return result;
}
void backtrack(int[] nums, int start, List<Integer> current, List<List<Integer>> result) {
    result.add(new ArrayList<>(current));                   // copy — current còn bị sửa tiếp
    for (int i = start; i < nums.length; i++) {
        current.add(nums[i]);                               // chọn
        backtrack(nums, i + 1, current, result);            // đi tiếp
        current.remove(current.size() - 1);                 // bỏ chọn
    }
}   // 2ⁿ tập con
```

*Dynamic programming — số cách leo cầu thang, rồi tối ưu bộ nhớ*

```java
// dp[i] = số cách tới bậc i = dp[i-1] + dp[i-2]
int climbStairs(int n) {
    if (n <= 2) return n;
    int prev2 = 1, prev1 = 2;
    for (int i = 3; i <= n; i++) {
        int cur = prev1 + prev2;
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;   // O(n) thời gian, O(1) bộ nhớ
}

// Knapsack 0/1: giá trị lớn nhất với sức chứa W
int knapsack(int[] weight, int[] value, int W) {
    int[] dp = new int[W + 1];
    for (int i = 0; i < weight.length; i++)
        for (int w = W; w >= weight[i]; w--)                // duyệt ngược để mỗi món chỉ dùng một lần
            dp[w] = Math.max(dp[w], dp[w - weight[i]] + value[i]);
    return dp[W];   // O(n·W)
}
```

## Ứng Dụng Thực Tế

**Pattern xuất hiện trong code hằng ngày**:
- Sliding window → rate limiter (đếm request trong 60 giây gần nhất), moving average cho metrics.
- Hash map → loại trùng, gom nhóm (`Collectors.groupingBy`), join hai danh sách trong bộ nhớ thay cho vòng lặp lồng nhau.
- Heap → scheduler lấy job đến hạn sớm nhất, trộn nhiều file log đã sắp xếp theo thời gian.
- Binary search → `git bisect`, tìm cấu hình (batch size, pool size) lớn nhất chưa gây lỗi.
- Topological sort (DFS/BFS) → thứ tự khởi tạo bean, build dependency, DAG của pipeline.
- DP → diff giữa hai file (longest common subsequence), tính chi phí tối ưu.

**Cách tiếp cận một bài trong phỏng vấn**:
1. Hỏi lại ràng buộc: kích thước n, có số âm, có trùng lặp, đã sắp xếp chưa.
2. Nói giải pháp brute force và độ phức tạp của nó.
3. Tìm pattern để tối ưu.
4. Code.
5. Tự chạy tay với ví dụ và các trường hợp biên: rỗng, 1 phần tử, tất cả giống nhau, tràn số.
6. Nêu độ phức tạp thời gian và bộ nhớ.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào dùng sliding window thay cho two pointers thông thường?</strong></summary>

**A:** Sliding window là một dạng two pointers mà hai con trỏ cùng đi một chiều và xác định một **đoạn liên tiếp** — dùng cho câu hỏi về subarray/substring: dài nhất, ngắn nhất, hoặc đếm đoạn thỏa điều kiện, khi điều kiện có tính đơn điệu (mở rộng cửa sổ chỉ làm "tệ hơn" hoặc "tốt hơn" theo một chiều). Two pointers hai đầu (một từ trái, một từ phải) dùng cho mảng đã sắp xếp: tìm cặp có tổng cho trước, kiểm tra palindrome. Nếu mảng có số âm và cần tổng chính xác, sliding window không còn đúng → dùng prefix sum + hash map.

</details>

<details>
<summary><strong>Làm sao nhận ra một bài có thể giải bằng dynamic programming?</strong></summary>

**A:** Hai dấu hiệu: (1) **cấu trúc con tối ưu** — lời giải tối ưu được xây từ lời giải tối ưu của bài toán nhỏ hơn; (2) **bài toán con chồng lấp** — đệ quy thô tính lại cùng một bài toán con nhiều lần. Câu hỏi thường là "có bao nhiêu cách", "giá trị lớn nhất/nhỏ nhất", "có thể đạt được không". Quy trình: định nghĩa trạng thái `dp[i]` nghĩa là gì, công thức chuyển trạng thái, giá trị khởi đầu, thứ tự tính; sau đó tối ưu bộ nhớ nếu chỉ phụ thuộc vài trạng thái trước.

</details>

<details>
<summary><strong>Backtracking khác brute force thế nào?</strong></summary>

**A:** Backtracking vẫn là duyệt toàn bộ không gian lời giải, nhưng xây lời giải từng bước (chọn → đệ quy → bỏ chọn) và **cắt nhánh** ngay khi lời giải dở dang đã vi phạm ràng buộc, thay vì sinh hết mọi tổ hợp rồi mới kiểm tra. Ví dụ N-Queens: đặt quân theo từng hàng, bỏ ngay cột/đường chéo bị tấn công. Độ phức tạp xấu nhất vẫn lũy thừa, nhưng thực tế nhanh hơn nhiều nhờ cắt nhánh.

</details>

<details>
<summary><strong>Tìm phần tử lớn thứ K trong mảng thế nào cho hiệu quả?</strong></summary>

**A:** (1) Sort rồi lấy: O(n log n) — đơn giản, đủ dùng khi n nhỏ. (2) Min-heap kích thước K: duyệt mảng, giữ K phần tử lớn nhất, đầu heap là đáp án — O(n log K), hợp với dữ liệu dạng luồng. (3) Quickselect (phân hoạch như quicksort nhưng chỉ đi vào một phía): trung bình O(n), xấu nhất O(n²) — giảm rủi ro bằng chọn pivot ngẫu nhiên. Trong phỏng vấn thường trình bày heap trước, sau đó nhắc quickselect như tối ưu.

</details>
