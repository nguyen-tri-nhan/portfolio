---
key: "equals & hashCode"
title: "equals() & hashCode() Contract"
crumb: "1. Core Java › Java Language Essentials"
---

`equals` và `hashCode` quyết định hai object có được coi là "giống nhau" trong `HashMap`, `HashSet`, `List.contains`, `distinct()`... Viết sai không báo lỗi compile mà gây bug khó tìm: phần tử trùng lặp trong Set, `get()` trả về `null` dù vừa `put`, entity JPA biến mất khỏi collection.

## Điểm Chính

- **Mặc định** (`Object`): `equals` là so sánh tham chiếu (`==`); `hashCode` thường khác nhau cho mỗi object.
- **Hợp đồng của `equals`** (Javadoc `Object`), với mọi tham chiếu khác null:
  - **Reflexive** — `x.equals(x)` là `true`.
  - **Symmetric** — `x.equals(y)` ⇔ `y.equals(x)`.
  - **Transitive** — `x.equals(y)` và `y.equals(z)` ⇒ `x.equals(z)`.
  - **Consistent** — gọi nhiều lần cho cùng kết quả nếu các field dùng để so sánh không đổi.
  - `x.equals(null)` luôn là `false`.
- **Hợp đồng của `hashCode`**:
  - Gọi nhiều lần trong cùng một lần chạy ứng dụng cho cùng giá trị nếu field dùng trong `equals` không đổi (không cần giống nhau giữa các lần chạy).
  - **Hai object `equals` nhau bắt buộc có cùng `hashCode`.**
  - Hai object khác nhau **không bắt buộc** có hashCode khác nhau (collision được phép), nhưng hash phân tán tốt thì hash table nhanh hơn.
- **Quy tắc vàng**: override `equals` thì **phải** override `hashCode`, dùng cùng một tập field.
- **HashMap dùng thế nào**: `hashCode` → chọn bucket; trong bucket dùng `equals` để tìm đúng key. Sai `hashCode` → tìm nhầm bucket → không thấy key dù `equals` đúng.
- **Key phải bất biến**: sửa field tham gia `hashCode` sau khi đã `put` → entry nằm ở bucket cũ, không `get`/`remove` được nữa.
- **Record** (Java 16+) tự sinh `equals`/`hashCode`/`toString` theo tất cả component — cách ít lỗi nhất cho value object.

## Ví Dụ Code

*Bug kinh điển: override equals nhưng quên hashCode*

```java
class Money {
    private final long amount;
    private final String currency;
    Money(long amount, String currency) { this.amount = amount; this.currency = currency; }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money m)) return false;
        return amount == m.amount && currency.equals(m.currency);
    }
    // ❌ thiếu hashCode
}

Set<Money> set = new HashSet<>();
set.add(new Money(100, "USD"));
set.contains(new Money(100, "USD"));   // false (gần như chắc chắn) — hash khác → khác bucket
set.add(new Money(100, "USD"));        // Set giờ có 2 phần tử "bằng nhau"
```

*Cài đặt đúng*

```java
@Override public boolean equals(Object o) {
    if (this == o) return true;                          // nhanh cho cùng tham chiếu
    if (o == null || getClass() != o.getClass()) return false;
    Money m = (Money) o;
    return amount == m.amount && Objects.equals(currency, m.currency);   // null-safe
}

@Override public int hashCode() {
    return Objects.hash(amount, currency);               // cùng tập field với equals
}

// Hoặc đơn giản nhất: record
record Money(long amount, String currency) {}            // equals/hashCode/toString tự sinh
```

*Key mutable làm "mất" entry*

```java
class Sku {
    String code;
    Sku(String code) { this.code = code; }
    @Override public boolean equals(Object o) { return o instanceof Sku s && code.equals(s.code); }
    @Override public int hashCode() { return code.hashCode(); }
}

Map<Sku, Integer> stock = new HashMap<>();
Sku key = new Sku("A-1");
stock.put(key, 10);
key.code = "A-2";              // sửa field tham gia hashCode
stock.get(key);                // null — tìm ở bucket của "A-2", entry nằm ở bucket của "A-1"
stock.get(new Sku("A-1"));     // null — đúng bucket nhưng equals so với key đã bị đổi thành "A-2"
stock.size();                  // 1 — entry vẫn đó nhưng không truy cập được
```

*getClass() hay instanceof?*

```java
class Point { int x, y; /* equals dùng instanceof Point */ }
class ColorPoint extends Point { String color; /* equals dùng instanceof ColorPoint, so thêm color */ }

Point p = new Point(1, 2);
ColorPoint cp = new ColorPoint(1, 2, "red");
p.equals(cp);    // true  — cp là instanceof Point, x/y khớp
cp.equals(p);    // false — p không phải ColorPoint  → vi phạm symmetric

// getClass() != o.getClass(): lớp con và lớp cha không bao giờ equals nhau → giữ được symmetric,
// đổi lại một subclass không thêm field (ví dụ proxy) cũng không equals với lớp cha.
// instanceof: dùng được khi class là final hoặc lớp con không thêm trạng thái vào equals.
```

*equals không nhất quán với compareTo*

```java
BigDecimal a = new BigDecimal("2.0");
BigDecimal b = new BigDecimal("2.00");
a.equals(b);         // false — BigDecimal.equals so cả scale
a.compareTo(b);      // 0

new HashSet<>(List.of(a, b)).size();   // 2 — HashSet dùng equals
new TreeSet<>(List.of(a, b)).size();   // 1 — TreeSet dùng compareTo
```

## Ứng Dụng Thực Tế

**Entity JPA/Hibernate**: không dùng mặc định của Lombok `@EqualsAndHashCode`/`@Data` trên entity — nó dùng mọi field (kể cả quan hệ lazy → có thể kích hoạt load hoặc đệ quy vô hạn). Id tự sinh (`@GeneratedValue`) là `null` trước khi persist, nên nếu `hashCode` dựa vào id thì giá trị đổi sau `persist` → entity đã nằm trong `HashSet` bị "mất". Hai cách phổ biến: (1) so sánh theo business key bất biến (mã SKU, email); (2) so sánh theo id khi id khác null, và `hashCode` trả về hằng số theo class (`getClass().hashCode()`) để không đổi theo vòng đời entity. Hibernate proxy là lớp con của entity, nên với entity cẩn thận khi dùng `getClass()` so sánh trực tiếp.

**Value object trong DDD**: `Money`, `Address`, `OrderId` là record — equals theo giá trị, bất biến, dùng làm key an toàn.

**`distinct()` và `Collectors.toSet()`** đều dựa vào `equals`/`hashCode`. Nếu kết quả "không loại trùng", kiểm tra hai method này trước tiên.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Điều gì xảy ra nếu override equals mà không override hashCode?</strong></summary>

**A:** Vi phạm hợp đồng "equal thì cùng hashCode". Hai object bằng nhau theo `equals` nhưng có hashCode mặc định khác nhau → rơi vào hai bucket khác nhau trong `HashMap`/`HashSet`. Kết quả: `contains`/`get` trả về false/null dù đã thêm object bằng nhau, và `HashSet` chứa phần tử trùng lặp. Collection dựa trên `equals` thuần (`ArrayList.contains`) vẫn chạy đúng, nên bug chỉ lộ ra khi dùng cấu trúc hash.

</details>

<details>
<summary><strong>Hai object có cùng hashCode thì có equals nhau không?</strong></summary>

**A:** Không nhất thiết. Hợp đồng chỉ một chiều: equals ⇒ cùng hashCode. Cùng hashCode (collision) là bình thường vì `int` chỉ có 2³² giá trị. Ví dụ: `"Aa".hashCode() == "BB".hashCode()` (cùng bằng 2112). HashMap xử lý collision bằng cách lưu nhiều entry trong một bucket và phân biệt bằng `equals`; từ Java 8, bucket có hơn 8 entry (và table ≥ 64) chuyển thành cây đỏ-đen.

</details>

<details>
<summary><strong>Tại sao key của HashMap nên là immutable?</strong></summary>

**A:** Vị trí bucket được tính từ hashCode lúc `put`. Nếu sau đó sửa field tham gia hashCode, key vẫn nằm ở bucket cũ nhưng mọi lần `get`/`remove`/`containsKey` đều tính hash mới → tìm sai bucket → không thấy. Entry thành rác không truy cập được, gây sai logic và rò rỉ bộ nhớ. String, Integer, record với field immutable là key an toàn.

</details>

<details>
<summary><strong>Nên dùng getClass() hay instanceof trong equals?</strong></summary>

**A:** `instanceof` cho phép so sánh lớp cha với lớp con; nếu lớp con thêm field vào equals thì phá vỡ tính symmetric (`p.equals(cp)` true nhưng `cp.equals(p)` false) hoặc transitive. `getClass()` giữ hợp đồng chặt nhưng làm lớp con không có thêm trạng thái (kể cả proxy của Hibernate/Spring) không bao giờ bằng lớp cha. Khuyến nghị: class dùng làm value object nên `final` (hoặc là record) rồi dùng `instanceof`; khi cho phép kế thừa thì cân nhắc `getClass()`. *Effective Java* kết luận không có cách nào vừa kế thừa class có thể khởi tạo, vừa thêm field giá trị, mà vẫn giữ được hợp đồng equals — nên ưu tiên composition.

</details>

<details>
<summary><strong>Viết equals/hashCode cho JPA entity thế nào?</strong></summary>

**A:** Tránh dùng mọi field (Lombok `@Data`) — có thể kích hoạt lazy loading, đệ quy qua quan hệ hai chiều và thay đổi hash khi field đổi. Nếu entity có business key bất biến và unique (email, mã sản phẩm) thì dùng nó. Nếu chỉ có id tự sinh: `equals` trả true khi id khác null và bằng nhau; `hashCode` trả về giá trị cố định theo class để không đổi khi id được gán sau `persist`. Đổi lại, các entity cùng class nằm chung một bucket — chấp nhận được vì collection quan hệ trong entity thường nhỏ.

</details>
