---
key: "Generics"
title: "Java Generics: Type Erasure, Wildcards & PECS"
crumb: "1. Core Java › Java Language Essentials"
---

Generics cho phép viết code dùng lại cho nhiều kiểu mà vẫn được compiler kiểm tra kiểu. Điểm khiến nhiều người vấp: generics trong Java chỉ tồn tại lúc **compile** — lúc runtime thông tin kiểu bị xóa (type erasure). Hiểu erasure và wildcard là đủ để đọc được hầu hết API của JDK và Spring.

## Điểm Chính

- **Mục đích**: bắt lỗi kiểu lúc compile thay vì `ClassCastException` lúc runtime, và bỏ được cast thủ công.
- **Type erasure**: compiler thay type parameter không có bound bằng `Object`, có bound thì thay bằng bound (`<T extends Number>` → `Number`), chèn cast ở chỗ cần, và sinh **bridge method** để giữ đa hình. Bytecode không có `List<String>`, chỉ có `List`.
- **Hệ quả của erasure** — những thứ không làm được:
  - `new T()`, `new T[10]`
  - `obj instanceof List<String>` (chỉ được `instanceof List<?>`)
  - `new List<String>[10]` (mảng kiểu tham số hóa)
  - `List<int>` — không dùng được primitive, phải dùng `Integer`
  - Overload `void f(List<String>)` và `void f(List<Integer>)` — sau erasure trùng chữ ký
  - Field `static T`
- **Invariance**: `List<Integer>` **không** phải là `List<Number>` dù `Integer` là `Number`. Ngược lại, mảng thì covariant (`Integer[]` là `Number[]`) — và vì vậy có `ArrayStoreException` lúc runtime.
- **Wildcard**:
  - `? extends T` — đọc được ra `T`, không thêm vào được (trừ `null`) → **producer**.
  - `? super T` — thêm `T` vào được, đọc ra chỉ là `Object` → **consumer**.
  - `?` — không biết kiểu gì, chỉ đọc ra `Object`.
- **PECS** — *Producer Extends, Consumer Super* (Joshua Bloch, *Effective Java*): tham số chỉ để đọc dùng `extends`, chỉ để ghi dùng `super`. Ví dụ trong JDK: `Collections.copy(List<? super T> dest, List<? extends T> src)`.
- **Raw type** (`List` không có `<>`) chỉ để tương thích code trước Java 5 — dùng thì mất kiểm tra kiểu, compiler cảnh báo *unchecked*.

## Ví Dụ Code

*Tại sao cần generics*

```java
// Trước Java 5 — lỗi chỉ lộ ra lúc runtime
List list = new ArrayList();
list.add("hello");
list.add(42);                           // compile OK
String s = (String) list.get(1);        // ClassCastException lúc runtime

// Có generics — lỗi bị chặn lúc compile
List<String> names = new ArrayList<>();
names.add(42);                          // ❌ compile error
String first = names.get(0);            // không cần cast
```

*Generic method và bounded type*

```java
// <T extends Comparable<? super T>>: T so sánh được với chính nó hoặc với lớp cha của nó
public static <T extends Comparable<? super T>> T max(List<? extends T> items) {
    T best = items.get(0);
    for (T item : items) {
        if (item.compareTo(best) > 0) best = item;
    }
    return best;
}

Integer m = max(List.of(3, 9, 4));      // T được suy ra là Integer
```

*Invariance và wildcard*

```java
List<Integer> ints = List.of(1, 2, 3);
List<Number> nums = ints;               // ❌ compile error — generics là invariant

double sum(List<? extends Number> xs) { // ✅ nhận List<Integer>, List<Double>...
    double total = 0;
    for (Number n : xs) total += n.doubleValue();   // đọc ra Number: OK
    // xs.add(1);                       // ❌ không biết list thật là List<Integer> hay List<Double>
    return total;
}

void fillDefaults(List<? super Integer> target) {   // nhận List<Integer>, List<Number>, List<Object>
    target.add(0);                      // ✅ Integer luôn chèn được
    Object o = target.get(0);           // đọc ra chỉ biết là Object
}

// Mảng covariant → lỗi runtime mà generics tránh được
Object[] arr = new Integer[1];
arr[0] = "text";                        // ArrayStoreException lúc runtime
```

*PECS trong thực tế*

```java
// src là producer (đọc) → extends; dest là consumer (ghi) → super
public static <T> void copy(List<? super T> dest, List<? extends T> src) {
    for (int i = 0; i < src.size(); i++) dest.set(i, src.get(i));
}

List<Number> dest = new ArrayList<>(List.of(0, 0));
List<Integer> src  = List.of(7, 8);
copy(dest, src);                        // T = Integer
```

*Erasure và cách vượt qua: truyền Class&lt;T&gt;*

```java
public class Repository<T> {
    private final Class<T> type;        // giữ lại thông tin kiểu mà erasure đã xóa
    public Repository(Class<T> type) { this.type = type; }

    public T newInstance() throws ReflectiveOperationException {
        return type.getDeclaredConstructor().newInstance();   // thay cho new T()
    }
}

// Kiểu generic lồng nhau (List<Order>) không biểu diễn được bằng Class<T>
// → thư viện dùng "super type token": lớp con ẩn danh giữ lại kiểu trong chữ ký lớp cha
// Jackson:  new TypeReference<List<Order>>() {}
// Spring:   new ParameterizedTypeReference<List<Order>>() {}
```

*Bridge method*

```java
class Box<T> { void set(T value) { } }
class IntBox extends Box<Integer> {
    @Override void set(Integer value) { }
}
// Sau erasure Box có set(Object). Để IntBox vẫn override đúng, compiler sinh thêm:
//   void set(Object value) { set((Integer) value); }   ← bridge method
```

## Ứng Dụng Thực Tế

**Đọc API của framework**: `Function<? super T, ? extends R>` trong `Stream.map`, `Comparator<? super T>` trong `sort` — đều là PECS. Hàm nhận vào (consumer của T) dùng `super`, kết quả trả ra (producer của R) dùng `extends`, nhờ vậy bạn truyền được lambda/comparator viết cho lớp cha.

**Deserialize JSON thành collection**: `objectMapper.readValue(json, List.class)` trả về `List<LinkedHashMap>` vì erasure. Phải dùng `TypeReference<List<Order>>` (Jackson) hoặc `ParameterizedTypeReference` với `RestClient`/`WebClient` của Spring.

**Generic repository/service**: `JpaRepository<Order, Long>` — Spring Data đọc type argument từ chữ ký interface lúc khởi động (thông tin này nằm trong metadata của class, không bị xóa), nhờ vậy biết entity nào cần tạo query.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Type erasure là gì và gây ra những hạn chế nào?</strong></summary>

**A:** Compiler dùng thông tin generic để kiểm tra kiểu rồi xóa nó khỏi bytecode: type parameter không bound → `Object`, có bound → bound đó; chèn cast ở chỗ cần; sinh bridge method để giữ đa hình. Lý do: tương thích ngược với code và JVM trước Java 5, không phải tạo class mới cho mỗi kiểu tham số. Hệ quả: không `new T()`, không tạo mảng `T[]` hay `List<String>[]`, không `instanceof List<String>`, không dùng primitive làm type argument, không overload hai method chỉ khác type argument, không có `static T`. Lưu ý: thông tin generic trong **khai báo** (chữ ký field, method, lớp cha) vẫn được giữ trong metadata và đọc được bằng reflection — đó là cách `TypeReference` hoạt động.

</details>

<details>
<summary><strong>Tại sao List&lt;Integer&gt; không gán được cho List&lt;Number&gt;?</strong></summary>

**A:** Nếu cho phép, ta có thể gọi `nums.add(3.14)` trên một list thực chất là `List<Integer>` → phá vỡ an toàn kiểu. Vì vậy generics là *invariant*. Mảng Java là covariant nên lỗi tương tự chỉ bị phát hiện lúc runtime (`ArrayStoreException`). Khi cần chấp nhận "list của bất kỳ subtype nào của Number" thì dùng `List<? extends Number>` — đổi lại chỉ được đọc.

</details>

<details>
<summary><strong>Giải thích PECS và cho ví dụ.</strong></summary>

**A:** Producer Extends, Consumer Super. Tham số mà method **đọc** dữ liệu ra (producer) khai báo `? extends T` để nhận được collection của mọi subtype. Tham số mà method **ghi** dữ liệu vào (consumer) khai báo `? super T` để nhận được collection của mọi supertype. Ví dụ `Collections.copy(List<? super T> dest, List<? extends T> src)`: có thể copy `List<Integer>` vào `List<Number>`. Tham số vừa đọc vừa ghi thì dùng đúng `T`, không wildcard.

</details>

<details>
<summary><strong>List&lt;?&gt;, List&lt;Object&gt; và raw List khác nhau thế nào?</strong></summary>

**A:** `List<Object>` là list chứa Object — thêm gì cũng được, nhưng không nhận `List<String>` (invariance). `List<?>` là list của một kiểu cụ thể nào đó chưa biết — nhận được `List<String>`, `List<Integer>`..., đọc ra Object, không thêm được gì trừ `null`; an toàn kiểu. Raw `List` tắt kiểm tra kiểu hoàn toàn: nhận mọi list và thêm gì cũng được, compiler chỉ cảnh báo unchecked → có thể gây `ClassCastException` ở chỗ khác. Chỉ dùng raw type khi bắt buộc (ví dụ class literal `List.class`).

</details>

<details>
<summary><strong>Làm sao lấy được kiểu generic lúc runtime?</strong></summary>

**A:** Với biến cục bộ `List<String> x` thì không thể — đã bị xóa. Có hai cách: (1) truyền `Class<T>` vào constructor/method (type token); (2) với kiểu lồng nhau, tạo lớp con ẩn danh của một lớp generic (`new TypeReference<List<Order>>() {}`) — kiểu lớp cha của lớp ẩn danh được lưu trong metadata, đọc bằng `getClass().getGenericSuperclass()` rồi ép sang `ParameterizedType`. Jackson (`TypeReference`) và Spring (`ParameterizedTypeReference`, `ResolvableType`) dùng kỹ thuật này.

</details>
