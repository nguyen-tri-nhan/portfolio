---
key: "Clean Code & Code Review"
title: "Clean Code & Code Review"
crumb: "9. Design Patterns › Design Principles"
---

Code được đọc nhiều hơn được viết rất nhiều lần. "Clean code" không phải thẩm mỹ cá nhân mà là chi phí: đồng nghiệp (và chính bạn 6 tháng sau) mất bao lâu để hiểu và sửa an toàn. Code review là nơi những tiêu chuẩn này được thực thi — và cũng là kỹ năng mà fresher cần học sớm, cả vai trò người viết lẫn người review.

## Điểm Chính

- **Đặt tên** mang ý nghĩa và ý định: `elapsedDays` thay cho `d`, `isEligibleForRefund()` thay cho `check()`. Tên dài vừa đủ theo phạm vi — biến vòng lặp 3 dòng tên `i` là ổn; field của class thì không.
- **Hàm nhỏ, một mức trừu tượng**: một hàm hoặc điều phối các bước cấp cao, hoặc làm chi tiết một bước — không trộn lẫn. Tham số boolean (`send(order, true)`) thường là dấu hiệu hàm làm hai việc.
- **Guard clause** thay cho `if` lồng nhiều tầng: xử lý trường hợp lỗi/đặc biệt và `return` sớm.
- **Comment giải thích *tại sao***, không lặp lại *cái gì* code đã nói. Comment cũ sai nguy hiểm hơn không có comment.
- **Xử lý lỗi**: không nuốt exception (`catch (Exception e) {}`), không dùng `null` làm tín hiệu lỗi, ném exception có ngữ cảnh (id, trạng thái), log một lần ở nơi xử lý chứ không log–rethrow ở mọi tầng.
- **Không lặp lại (DRY)** nhưng cũng không trừu tượng hóa sớm: hai đoạn code giống nhau vì *tình cờ* (thay đổi vì lý do khác nhau) thì để riêng.
- **Test là một phần của code sạch**: code khó test thường là code thiết kế kém (phụ thuộc cứng, làm quá nhiều việc).
- **Code review** (theo Google Engineering Practices):
  - Approve khi thay đổi **chắc chắn cải thiện sức khỏe tổng thể của code**, dù chưa hoàn hảo.
  - Góp ý nhỏ không bắt buộc thì đánh dấu `Nit:`.
  - Thay đổi nên nhỏ và tự chứa một ý: khoảng 100 dòng thường hợp lý, 1.000 dòng thường là quá lớn.

## Ví Dụ Code

*Đặt tên và magic number*

```java
// ❌
if (u.getT() == 2 && (System.currentTimeMillis() - u.getD()) > 2592000000L) { ... }

// ✅
private static final Duration INACTIVE_THRESHOLD = Duration.ofDays(30);

boolean isInactivePremiumUser(User user, Instant now) {
    return user.tier() == Tier.PREMIUM
            && Duration.between(user.lastLoginAt(), now).compareTo(INACTIVE_THRESHOLD) > 0;
}
```

*Guard clause thay cho if lồng nhau*

```java
// ❌ Logic chính bị đẩy vào tầng thứ 4
Refund refund(Order order, User user) {
    if (order != null) {
        if (order.isPaid()) {
            if (user.owns(order)) {
                return refundService.issue(order);
            } else throw new AccessDeniedException("...");
        } else throw new IllegalStateException("...");
    } else throw new IllegalArgumentException("...");
}

// ✅ Xử lý ngoại lệ trước, luồng chính đọc thẳng từ trên xuống
Refund refund(Order order, User user) {
    Objects.requireNonNull(order, "order");
    if (!user.owns(order)) {
        throw new AccessDeniedException("User %d does not own order %d".formatted(user.id(), order.id()));
    }
    if (!order.isPaid()) {
        throw new IllegalStateException("Order %d is %s, only PAID can be refunded".formatted(order.id(), order.status()));
    }
    return refundService.issue(order);
}
```

*Tham số boolean → hai hàm có tên rõ*

```java
// ❌ Đọc chỗ gọi không hiểu true nghĩa là gì
notifier.send(order, true);

// ✅
notifier.sendWithSms(order);
notifier.sendEmailOnly(order);
```

*Comment: tại sao, không phải cái gì*

```java
// ❌ Lặp lại code
// tăng retry lên 1
retry++;

// ✅ Giải thích quyết định không hiển nhiên
// Nhà cung cấp trả 409 khi request trùng idempotency key đang xử lý — coi là thành công,
// kết quả thật sẽ đến qua webhook.
if (response.status() == 409) return PaymentResult.pending();
```

*Xử lý lỗi*

```java
// ❌ Nuốt lỗi — dữ liệu sai âm thầm, không ai biết
try {
    inventory.reserve(order);
} catch (Exception e) {
}

// ❌ Log rồi ném lại ở mọi tầng → một lỗi xuất hiện 5 lần trong log
catch (SQLException e) {
    log.error("DB error", e);
    throw new RuntimeException(e);
}

// ✅ Bọc với ngữ cảnh, để một handler tập trung (@ControllerAdvice) log một lần
catch (SQLException e) {
    throw new InventoryUnavailableException("Cannot reserve stock for order " + order.id(), e);
}
```

*Một mức trừu tượng trong một hàm*

```java
// ✅ Hàm điều phối đọc như một danh sách bước
public Invoice checkout(Cart cart, Customer customer) {
    validate(cart);
    Money total = pricing.calculate(cart, customer);
    Payment payment = payments.charge(customer, total);
    Order order = orders.create(cart, customer, payment);
    events.publish(new OrderPlaced(order.id()));
    return invoices.issue(order);
}
// Chi tiết của từng bước nằm trong hàm/class riêng — không trộn vòng lặp tính thuế vào đây
```

*Checklist khi review một pull request*

```text
1. Mục đích  — PR giải quyết đúng vấn đề trong ticket? Có cách đơn giản hơn không?
2. Đúng      — trường hợp biên: null, rỗng, trùng, đồng thời, timeout, retry. Transaction đúng phạm vi?
3. Bảo mật   — input được validate? Kiểm tra quyền sở hữu resource? Có log secret/PII không?
4. Hiệu năng — N+1 query, vòng lặp gọi mạng/DB, thiếu index, tải toàn bộ bảng vào bộ nhớ?
5. Test      — có test cho hành vi mới và cho bug vừa sửa? Test có thực sự fail nếu code sai?
6. Dễ đọc    — tên, độ dài hàm, comment giải thích "tại sao"
7. Vận hành  — log/metric đủ để debug production? Migration DB tương thích ngược? Feature flag?
```

## Ứng Dụng Thực Tế

**Khi là người viết PR**:
- Tự review diff của mình trước khi gửi.
- Mô tả PR nêu *vấn đề*, *cách giải quyết*, *cách test*, và ảnh chụp màn hình nếu có UI.
- Giữ PR nhỏ: tách refactor riêng khỏi thay đổi hành vi.
- Trả lời mọi comment — sửa, hoặc giải thích vì sao không sửa. Không coi góp ý là tấn công cá nhân.

**Khi là người review**:
- Review code, không review người: "Hàm này có thể trả null khi…" thay vì "Bạn lại quên check null".
- Đặt câu hỏi khi chưa chắc: "Nếu hai request đến cùng lúc thì sao?"
- Phân biệt rõ điều bắt buộc với `Nit:`.
- Khen điều làm tốt.
- Phản hồi nhanh — PR chờ nhiều ngày làm chậm cả team hơn là một review chưa hoàn hảo.

**Tự động hóa phần máy làm được**: format (Spotless, Prettier), lint/static analysis (Checkstyle, SpotBugs, SonarQube, ESLint), test và coverage chạy trong CI. Người review dành thời gian cho thiết kế, logic nghiệp vụ và rủi ro — những thứ máy không thấy.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Theo bạn thế nào là code sạch?</strong></summary>

**A:** Code mà người khác đọc hiểu nhanh và sửa được an toàn. Cụ thể: tên nói đúng ý định; hàm ngắn, làm một việc, một mức trừu tượng; không có trạng thái hay tác dụng phụ bất ngờ; lỗi được xử lý rõ ràng thay vì bị nuốt; không lặp lại logic nghiệp vụ; có test chứng minh hành vi và cho phép refactor tự tin. Tiêu chí thực tế: một đồng nghiệp mới có thể sửa một bug trong module đó mà không cần hỏi tác giả.

</details>

<details>
<summary><strong>Khi review code, bạn tìm gì đầu tiên?</strong></summary>

**A:** Thứ tự ưu tiên theo mức độ rủi ro: (1) Thay đổi có đúng mục đích và thiết kế hợp lý không — sửa thiết kế sau khi đã review chi tiết thì lãng phí. (2) Tính đúng đắn: trường hợp biên, đồng thời, transaction, xử lý lỗi. (3) Bảo mật: validate input, phân quyền, lộ dữ liệu nhạy cảm. (4) Hiệu năng ở các điểm nóng: query trong vòng lặp, thiếu phân trang. (5) Test. (6) Cuối cùng mới đến tên biến, style — và phần style lẽ ra đã được tool tự động kiểm tra.

</details>

<details>
<summary><strong>Nếu bạn và reviewer bất đồng về một góp ý thì làm sao?</strong></summary>

**A:** Trước hết hiểu lý do của người kia — hỏi lại thay vì bảo vệ ngay. Đưa ra lập luận dựa trên dữ kiện: style guide của team, tài liệu chính thức, số đo hiệu năng, rủi ro cụ thể. Nếu là sở thích cá nhân mà không ảnh hưởng chất lượng thì theo quy ước sẵn có hoặc nhường. Nếu vẫn không thống nhất, trao đổi trực tiếp (gọi nhanh hiệu quả hơn chuỗi comment dài) hoặc nhờ tech lead quyết định, và ghi lại kết luận để lần sau không tranh luận lại.

</details>

<details>
<summary><strong>Khi nào nên viết comment?</strong></summary>

**A:** Khi code không tự nói được **lý do**: một quyết định không hiển nhiên (tại sao chọn cách này thay vì cách "bình thường"), ràng buộc từ bên ngoài (hành vi lạ của API bên thứ ba, yêu cầu pháp lý), workaround cho bug kèm link issue, cảnh báo hậu quả ("đổi thứ tự hai dòng này sẽ gây deadlock"). Không comment để diễn giải từng dòng — nếu cần làm vậy, hãy đổi tên hoặc tách hàm. Javadoc cho API public dùng chung là trường hợp riêng: mô tả hợp đồng (input, output, ngoại lệ) cho người dùng không đọc code.

</details>
