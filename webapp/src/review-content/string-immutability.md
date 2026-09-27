---
key: "String"
title: "String: Immutability, String Pool & StringBuilder"
crumb: "1. Core Java › Java Language Essentials"
---

`String` là class được dùng nhiều nhất trong Java và cũng là nguồn của nhiều câu hỏi phỏng vấn kinh điển: vì sao immutable, `==` khác `equals` thế nào, String Pool nằm đâu, khi nào dùng `StringBuilder`. Javadoc ghi rõ: *"Strings are constant; their values cannot be changed after they are created."*

## Điểm Chính

- **Immutable**: mọi method "sửa" (`concat`, `replace`, `toUpperCase`, `substring`...) đều trả về String **mới**, object cũ giữ nguyên. Class là `final` nên không ai kế thừa để phá vỡ điều này.
- **Lợi ích của immutable**:
  - Chia sẻ an toàn giữa các thread mà không cần đồng bộ.
  - Cho phép **String Pool** — nhiều biến cùng trỏ vào một object.
  - **Cache hashCode**: tính một lần, lưu trong field `hash` (thêm cờ `hashIsZero` cho trường hợp hash bằng 0) → rất hợp làm key của `HashMap`.
  - An toàn khi làm tham số: tên file, URL, tên class truyền vào class loader không bị đổi sau khi đã kiểm tra.
- **String Pool**: literal (`"abc"`) và hằng số compile-time được *intern* — dùng chung một object. `new String("abc")` luôn tạo object mới trên heap. `intern()` trả về bản chuẩn trong pool. Từ **Java 7**, pool nằm trong heap thường (trước đó ở PermGen) nên được GC dọn như object khác.
- **`==` vs `equals`**: `==` so sánh tham chiếu (cùng object?), `equals` so sánh nội dung. Luôn dùng `equals` cho String; so với literal viết `"ACTIVE".equals(status)` để tránh `NullPointerException`.
- **Nối chuỗi**: `+` trong vòng lặp tạo object trung gian mỗi lần lặp → dùng `StringBuilder`. Ngoài vòng lặp, `a + b + c` đã được compiler tối ưu (từ Java 9, JEP 280: `invokedynamic` + `StringConcatFactory`, trước đó là `StringBuilder`).
- **StringBuilder vs StringBuffer**: cùng API, mutable; `StringBuffer` có `synchronized` trên các method nên chậm hơn — gần như không còn lý do dùng. `StringBuilder` không thread-safe, dùng như biến cục bộ.
- **Bên trong (Java 9+, JEP 254 Compact Strings)**: lưu bằng `byte[] value` + `coder` — chuỗi chỉ gồm ký tự Latin-1 dùng 1 byte/ký tự, còn lại dùng UTF-16 (2 byte). Trước Java 9 là `char[]` (luôn 2 byte).

## Ví Dụ Code

*Immutable — method trả về object mới*

```java
String s = "hello";
s.toUpperCase();              // kết quả bị bỏ đi, s không đổi
System.out.println(s);        // hello

s = s.toUpperCase();          // gán lại biến → trỏ vào object mới
System.out.println(s);        // HELLO
```

*String Pool, `==` và `equals`*

```java
String a = "java";
String b = "java";
String c = new String("java");
String d = c.intern();

a == b;          // true  — cùng literal trong pool
a == c;          // false — c là object mới trên heap
a.equals(c);     // true  — cùng nội dung
a == d;          // true  — intern() trả về bản trong pool

// Hằng số compile-time được nối lúc compile và vào pool
final String prefix = "ja";
String e = prefix + "va";     // hằng số → "java" trong pool
a == e;          // true

String p = "ja";              // không final → không phải hằng số
String f = p + "va";          // nối lúc runtime → object mới
a == f;          // false
```

*Nối chuỗi trong vòng lặp*

```java
// ❌ Mỗi vòng lặp tạo String mới và copy toàn bộ nội dung cũ → O(n²) ký tự được copy
String csv = "";
for (Order o : orders) {
    csv += o.id() + ",";
}

// ✅ Một buffer mở rộng dần
StringBuilder sb = new StringBuilder(orders.size() * 8);   // ước lượng dung lượng nếu biết
for (Order o : orders) {
    sb.append(o.id()).append(',');
}
String result = sb.toString();

// ✅ Gọn hơn cho trường hợp nối với dấu phân cách
String joined = orders.stream()
        .map(o -> String.valueOf(o.id()))
        .collect(Collectors.joining(","));
```

*Các method hữu ích từ Java 11+*

```java
"  ".isBlank();               // true  (Java 11) — chỉ có khoảng trắng
" hi ".strip();          // "hi"  (Java 11) — hiểu khoảng trắng Unicode, khác trim()
"ab".repeat(3);               // "ababab" (Java 11)
"a\nb\nc".lines().count();    // 3 (Java 11)

String json = """
        {"id": 1, "name": "Alice"}
        """;                  // Text block (Java 15)
```

*Vì sao không lưu mật khẩu trong String*

```java
// String immutable và có thể nằm trong pool → không xóa được nội dung khỏi bộ nhớ,
// sẽ còn đó đến khi GC dọn, và lộ ra nếu heap dump
char[] password = console.readPassword();
try {
    authenticate(password);
} finally {
    Arrays.fill(password, '\0');   // chủ động xóa sau khi dùng
}
```

## Ứng Dụng Thực Tế

**Key của HashMap/cache**: String là lựa chọn an toàn vì immutable và hashCode đã được cache. Nếu dùng object mutable làm key rồi sửa field tham gia `hashCode`, entry sẽ "mất tích" trong map.

**Log**: tránh nối chuỗi khi log level không bật — `log.debug("Order " + id + " state " + state)` vẫn tạo chuỗi dù DEBUG tắt. Dùng placeholder của SLF4J: `log.debug("Order {} state {}", id, state)`.

**Tiết kiệm bộ nhớ**: ứng dụng có nhiều chuỗi trùng lặp (ví dụ đọc CSV lớn) có thể bật `-XX:+UseStringDeduplication` với G1 (JEP 192) — GC gộp các mảng byte trùng nội dung. Tránh gọi `intern()` hàng loạt với dữ liệu người dùng vì pool phình to.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao String trong Java là immutable?</strong></summary>

**A:** (1) **String Pool**: literal được chia sẻ giữa nhiều biến — nếu mutable, sửa ở một chỗ sẽ ảnh hưởng mọi chỗ khác. (2) **Thread-safe** tự nhiên, không cần đồng bộ. (3) **Cache hashCode**: nội dung không đổi nên hash tính một lần là dùng mãi → làm key HashMap nhanh. (4) **Bảo mật**: tên file, URL, tên class, thông tin kết nối truyền vào dưới dạng String không thể bị đổi giữa lúc kiểm tra và lúc dùng. Class được khai báo `final` và field `value` là `private final` để đảm bảo điều này.

</details>

<details>
<summary><strong>`String s = new String("abc")` tạo ra bao nhiêu object?</strong></summary>

**A:** Tối đa 2: literal `"abc"` trong pool (tạo lúc class được load/literal được resolve lần đầu, nếu pool chưa có) và một object String mới trên heap do `new` tạo ra. Nếu `"abc"` đã có trong pool thì chỉ 1 object mới. Đó là lý do không nên viết `new String("...")` — không có lợi gì mà tốn thêm object.

</details>

<details>
<summary><strong>Có nên dùng `+` để nối chuỗi không?</strong></summary>

**A:** Nối trong một biểu thức (`"Hello " + name + "!"`) thì được — compiler tối ưu: từ Java 9 dùng `invokedynamic`/`StringConcatFactory` (JEP 280), trước đó sinh `StringBuilder`. Vấn đề là nối trong **vòng lặp**: mỗi vòng tạo một String mới và copy toàn bộ nội dung cũ, tổng chi phí O(n²). Khi đó dùng một `StringBuilder` bên ngoài vòng lặp, hoặc `String.join`/`Collectors.joining`.

</details>

<details>
<summary><strong>StringBuilder và StringBuffer khác nhau thế nào?</strong></summary>

**A:** Cả hai đều mutable, API gần như giống hệt. `StringBuffer` (có từ Java 1.0) đồng bộ mọi method bằng `synchronized` → thread-safe nhưng chậm hơn. `StringBuilder` (Java 5) không đồng bộ → nhanh hơn. Trong thực tế builder hầu như luôn là biến cục bộ trong một thread, nên dùng `StringBuilder`. Việc nhiều thread cùng ghi vào một buffer hiếm khi là thiết kế tốt.

</details>

<details>
<summary><strong>Tại sao nên dùng char[] thay cho String để giữ mật khẩu?</strong></summary>

**A:** String immutable nên không thể xóa nội dung sau khi dùng; object tồn tại đến khi GC dọn (và nếu bị intern thì lâu hơn), có thể lộ qua heap dump hoặc memory dump. `char[]` thì có thể ghi đè bằng `Arrays.fill(arr, '\0')` ngay sau khi dùng. Vì vậy `Console.readPassword()` và `JPasswordField.getPassword()` trả về `char[]`. Đây là giảm thiểu rủi ro, không phải bảo vệ tuyệt đối.

</details>
