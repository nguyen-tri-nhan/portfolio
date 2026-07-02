---
key: restful-design
title: RESTful API Design
crumb: 18. API & Communication > REST & HTTP
---

REST là architectural style (không phải protocol) với 6 ràng buộc, dùng HTTP làm nền tảng truyền tải để xây dựng API có tính stateless, cacheable và uniform interface.

## Điểm Chính

- **6 REST constraints**: stateless, client-server, cacheable, uniform interface, layered system, code-on-demand (optional).
- **Stateless**: mỗi request chứa đủ thông tin; server không lưu session state giữa các request.
- **Uniform interface** gồm 4 nguyên tắc: resource identification qua URI, manipulation through representations, self-descriptive messages, **HATEOAS** (links trong response để điều hướng).
- **API versioning**: URI path (`/v1/users`), request header (`Accept-Version: v1`), query param (`?version=1`) — URI path phổ biến nhất vì dễ debug.
- **Pagination**: offset-based (đơn giản nhưng chậm với large dataset + data drift), cursor-based/keyset (hiệu quả hơn, stable, phù hợp infinite scroll).

### So Sánh HTTP Methods

| Method  | Safe | Idempotent | Cacheable | Request Body | Use Case |
|---------|:----:|:----------:|:---------:|:------------:|----------|
| GET     | ✅   | ✅          | ✅        | ❌           | Đọc resource |
| HEAD    | ✅   | ✅          | ✅        | ❌           | Kiểm tra tồn tại / metadata |
| OPTIONS | ✅   | ✅          | ❌        | ❌           | CORS preflight |
| POST    | ❌   | ❌          | ❌        | ✅           | Tạo resource / trigger action |
| PUT     | ❌   | ✅          | ❌        | ✅           | **Full replace** toàn bộ resource |
| PATCH   | ❌   | ❌ *        | ❌        | ✅           | **Partial update** một số field |
| DELETE  | ❌   | ✅          | ❌        | ❌           | Xóa resource |

> **Safe** = không thay đổi server state. **Idempotent** = gọi N lần = gọi 1 lần về kết quả.  
> *PATCH có thể idempotent nếu thiết kế đúng (set field cụ thể), nhưng không đảm bảo theo spec (ví dụ PATCH increment counter thì không idempotent).

### PUT vs PATCH — Phân Biệt Quan Trọng

| Tiêu chí | PUT | PATCH |
|----------|-----|-------|
| Scope | Thay thế **toàn bộ** resource | Cập nhật **một phần** resource |
| Body | Phải gửi đầy đủ fields | Chỉ gửi fields cần thay đổi |
| Missing fields | Field không có trong body → bị **xóa/null** | Field không có trong body → **giữ nguyên** |
| Idempotent | ✅ Luôn luôn | ❌ Không đảm bảo |
| Ví dụ | `PUT /users/1` với `{name, email, role}` đầy đủ | `PATCH /users/1` với `{name: "Bob"}` |

```
// PUT — nếu không gửi email, email sẽ bị xóa:
PUT /users/1  →  { "name": "Bob", "role": "admin" }
// Result: email = null ❌ (nguy hiểm nếu client quên field)

// PATCH — chỉ cập nhật name, email giữ nguyên:
PATCH /users/1  →  { "name": "Bob" }
// Result: name = "Bob", email unchanged ✅
```

### Status Codes Quan Trọng

| Code | Meaning | Khi dùng |
|------|---------|----------|
| 200 | OK | GET, PUT, PATCH thành công |
| 201 | Created | POST tạo resource thành công (kèm `Location` header) |
| 204 | No Content | DELETE thành công, hoặc PATCH không trả body |
| 400 | Bad Request | Request malformed, validation fail |
| 401 | Unauthorized | Chưa authenticate (thiếu/invalid token) |
| 403 | Forbidden | Đã authenticate nhưng không có quyền |
| 404 | Not Found | Resource không tồn tại |
| 409 | Conflict | Duplicate (email đã tồn tại), optimistic lock conflict |
| 422 | Unprocessable Entity | Syntax đúng nhưng business validation fail |
| 429 | Too Many Requests | Rate limit exceeded (kèm `Retry-After` header) |
| 500 | Internal Server Error | Lỗi server không xác định |
| 502 | Bad Gateway | Upstream service lỗi |
| 503 | Service Unavailable | Server quá tải hoặc đang maintenance |

## Ví Dụ Code

*Spring Boot REST controller với proper status codes, cursor pagination, và HATEOAS link*

```java
// ✅ Well-designed REST controller: HTTP semantics + pagination + versioning
@RestController
@RequestMapping("/v1/users")
public class UserController {

    private final UserService userService;

    // GET /v1/users?limit=20&cursor=eyJpZCI6MTAwfQ== — cursor-based pagination
    @GetMapping
    public ResponseEntity<PageResponse<UserDto>> listUsers(
            @RequestParam(defaultValue = "20") @Max(100) int limit,
            @RequestParam(required = false) String cursor) {

        Page<UserDto> page = userService.findAll(limit, cursor);
        return ResponseEntity.ok(PageResponse.<UserDto>builder()
                .data(page.getItems())
                .nextCursor(page.getNextCursor())   // opaque base64 cursor
                .hasMore(page.hasMore())
                .build());
    }

    // GET /v1/users/{id}
    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
        return userService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());  // 404
    }

    // POST /v1/users — returns 201 Created with Location header
    @PostMapping
    public ResponseEntity<UserDto> createUser(
            @Valid @RequestBody CreateUserRequest request,
            UriComponentsBuilder uriBuilder) {

        UserDto created = userService.create(request);
        URI location = uriBuilder.path("/v1/users/{id}")
                .buildAndExpand(created.getId()).toUri();
        return ResponseEntity.created(location).body(created);  // 201 + Location
    }

    // PUT /v1/users/{id} — idempotent full replace
    @PutMapping("/{id}")
    public ResponseEntity<UserDto> replaceUser(
            @PathVariable Long id,
            @Valid @RequestBody ReplaceUserRequest request) {

        return userService.replace(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // PATCH /v1/users/{id} — partial update
    @PatchMapping("/{id}")
    public ResponseEntity<UserDto> updateUser(
            @PathVariable Long id,
            @RequestBody PatchUserRequest request) {

        return userService.patch(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // DELETE /v1/users/{id} — 204 No Content on success
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();  // 204
    }
}

// Cursor-based page response envelope
@Builder
public record PageResponse<T>(
        List<T> data,
        String nextCursor,   // base64-encoded keyset for next page
        boolean hasMore
) {}
```

## Ứng Dụng Thực Tế

Trong hệ thống e-commerce, cursor pagination tránh được vấn đề data drift khi user đang phân trang và record mới được thêm vào — offset pagination có thể bỏ sót hoặc trùng record. Versioning qua URI path (`/v1/`, `/v2/`) giúp client và server deploy độc lập mà không breaking change.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>PUT và PATCH khác nhau thế nào? Khi nào nên dùng cái nào?</strong></summary>

**A:** PUT là full replace — client phải gửi toàn bộ representation của resource, fields nào không gửi sẽ bị null/xóa; PUT phải idempotent. PATCH là partial update — chỉ gửi fields cần thay đổi, fields còn lại giữ nguyên; PATCH không đảm bảo idempotent theo spec. Trong thực tế: dùng PATCH cho form edit (user chỉ đổi tên), dùng PUT khi muốn replace hoàn toàn và đảm bảo idempotency cho retry logic. Lỗi hay gặp: dùng PUT nhưng client quên gửi field nào đó → field đó bị xóa trong DB mà không có warning.

</details>

<details>
<summary><strong>REST là architectural style chứ không phải protocol — giải thích sự khác biệt này có ý nghĩa gì trong thực tế?</strong></summary>

**A:** REST là tập hợp 6 ràng buộc kiến trúc do Roy Fielding định nghĩa; nó không ràng buộc transport protocol, mặc dù HTTP là lựa chọn phổ biến nhất. Điều này có nghĩa: REST over HTTP không tự động tuân thủ REST nếu vi phạm các constraint — ví dụ, dùng POST cho tất cả operations vi phạm uniform interface, hay lưu session trên server vi phạm stateless. Trong thực tế, nhiều API tự gọi là "RESTful" nhưng thực ra chỉ là HTTP JSON API. Sự khác biệt quan trọng nhất là statelessness: mỗi request phải self-contained, giúp scale horizontal dễ dàng vì bất kỳ server node nào cũng có thể xử lý bất kỳ request nào.

</details>

<details>
<summary><strong>Idempotency quan trọng thế nào trong distributed system và làm thế nào đảm bảo DELETE là idempotent?</strong></summary>

**A:** Trong distributed system, network failure và retry là không thể tránh khỏi. Idempotency đảm bảo rằng gọi một operation nhiều lần có cùng kết quả với gọi một lần — giúp client an toàn retry mà không sợ side effect. DELETE phải trả về 204 cho lần xóa thành công và cũng trả về 204 (hoặc chấp nhận 404) cho các lần gọi tiếp theo — không nên throw 500 nếu resource đã bị xóa. PUT là idempotent vì replace toàn bộ resource, còn PATCH thì không tự động idempotent (ví dụ: PATCH tăng counter sẽ tăng mỗi lần gọi). Thiết kế idempotent API cùng với idempotency key giảm đáng kể độ phức tạp của error recovery.

</details>

<details>
<summary><strong>Cursor-based pagination khác offset-based thế nào và khi nào nên dùng cursor?</strong></summary>

**A:** Offset pagination (`LIMIT 20 OFFSET 100`) đơn giản nhưng có hai vấn đề lớn: performance (database phải scan và bỏ qua 100 row đầu) và data drift (nếu record mới được insert trong khi user phân trang, page sau có thể trùng hoặc bỏ sót item). Cursor-based (keyset) pagination dùng giá trị của row cuối cùng (`WHERE id > last_id LIMIT 20`) — hiệu quả hơn vì dùng index, và stable vì không bị ảnh hưởng bởi insert/delete. Nên dùng cursor khi dataset lớn, data thay đổi thường xuyên, hoặc cần infinite scroll. Hạn chế của cursor là không thể jump đến arbitrary page — chỉ đi forward (hoặc backward nếu thiết kế thêm prev cursor).

</details>
