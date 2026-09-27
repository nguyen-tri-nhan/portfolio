---
key: "HTTP Fundamentals"
title: "HTTP: Methods, Status Codes, Headers & HTTP/2–3"
crumb: "18. API & Communication › Networking & HTTP"
---

REST API nào cũng xây trên HTTP, nhưng nhiều API dùng sai ngữ nghĩa: `GET` có tác dụng phụ, trả `200` kèm `{"error": ...}`, nhầm `401` với `403`, retry `POST` gây tạo đơn trùng. Bài này bám theo **RFC 9110 (HTTP Semantics)** — chuẩn hiện hành thay cho bộ RFC 7230–7235.

## Điểm Chính

- **Safe** (không làm thay đổi trạng thái server): `GET`, `HEAD`, `OPTIONS`, `TRACE`.
- **Idempotent** (gửi N lần có tác dụng như 1 lần): các method safe + `PUT` + `DELETE`.
  - `POST` không idempotent.
  - `PATCH` (RFC 5789) không idempotent theo định nghĩa — tùy cách thiết kế payload.
  - Idempotent nói về **tác dụng lên server**, không phải response: `DELETE` lần 2 có thể trả `404` nhưng trạng thái server vẫn như sau lần 1.
- **Vì sao idempotent quan trọng**: client, proxy, load balancer có thể **tự động retry** request idempotent khi mất kết nối. Retry `POST` là nguồn gốc của thanh toán/đơn hàng trùng → dùng *Idempotency-Key*.
- **Status code** — chọn đúng nhóm:
  - `2xx` thành công: `200`, `201 Created` (+ `Location`), `202 Accepted` (xử lý bất đồng bộ), `204 No Content`.
  - `3xx` chuyển hướng: `301`/`302` cho phép client đổi method (thực tế POST → GET), còn `308`/`307` **giữ nguyên method**. `304 Not Modified` cho cache.
  - `4xx` lỗi phía client — gửi lại y nguyên sẽ vẫn lỗi.
  - `5xx` lỗi phía server — có thể thử lại sau.
- **`401` vs `403`**: `401 Unauthorized` = thiếu/sai thông tin **xác thực** (chưa biết bạn là ai; kèm `WWW-Authenticate`). `403 Forbidden` = đã hiểu request nhưng **từ chối** (biết bạn là ai nhưng không có quyền).
- **`502` / `503` / `504`**: `502 Bad Gateway` = gateway nhận response không hợp lệ từ upstream; `503 Service Unavailable` = tạm thời không phục vụ được (quá tải, bảo trì — có thể kèm `Retry-After`); `504 Gateway Timeout` = gateway không nhận được response kịp thời từ upstream.
- **`409 Conflict`** (xung đột trạng thái, ví dụ version cũ), **`422 Unprocessable Content`** (cú pháp đúng nhưng không xử lý được — hay dùng cho lỗi validation), **`429 Too Many Requests`** (RFC 6585, rate limit).
- **Caching**: `Cache-Control` (`max-age`, `no-cache` = phải revalidate trước khi dùng, `no-store` = không lưu), validator `ETag` + `If-None-Match` → `304`.
- **Phiên bản**:
  - **HTTP/1.1** — một request tại một thời điểm trên mỗi kết nối → trình duyệt mở nhiều kết nối song song.
  - **HTTP/2** (RFC 9113) — nhị phân, **multiplexing** nhiều stream trên một kết nối TCP, nén header (HPACK). Vẫn còn *head-of-line blocking* ở tầng TCP: một gói mất làm chậm mọi stream.
  - **HTTP/3** (RFC 9114) — chạy trên **QUIC** (UDP): mỗi stream độc lập khi mất gói, TLS 1.3 tích hợp sẵn, kết nối sống sót khi đổi mạng (Wi-Fi → 4G).

## Ví Dụ Code

*Ánh xạ method và status code cho một resource*

```text
GET    /orders?status=PAID      200 + danh sách (rỗng vẫn là 200, không phải 404)
GET    /orders/42               200 | 404
POST   /orders                  201 + Location: /orders/43 | 400/422 validation | 409 trùng
PUT    /orders/42               200 | 204 — thay toàn bộ resource (idempotent)
PATCH  /orders/42               200 | 204 — sửa một phần
DELETE /orders/42               204 | 404 (lần gọi lại)
POST   /orders/42/cancel        202 nếu xử lý bất đồng bộ — action không map được vào CRUD
```

*Spring MVC trả đúng status*

```java
@PostMapping("/orders")
ResponseEntity<OrderResponse> create(@Valid @RequestBody CreateOrderRequest req,
                                     @RequestHeader("Idempotency-Key") String idemKey) {
    Order order = orderService.create(req, idemKey);     // trùng key → trả lại đơn cũ, không tạo mới
    URI location = URI.create("/orders/" + order.id());
    return ResponseEntity.created(location).body(OrderResponse.from(order));   // 201 + Location
}

@GetMapping("/orders/{id}")
ResponseEntity<OrderResponse> get(@PathVariable long id) {
    return orderService.find(id)
            .map(o -> ResponseEntity.ok()
                    .eTag("\"" + o.version() + "\"")       // validator cho cache/concurrency
                    .body(OrderResponse.from(o)))
            .orElse(ResponseEntity.notFound().build());
}

// Lỗi trả về theo chuẩn RFC 9457 Problem Details (Spring 6+: ProblemDetail)
@ExceptionHandler(OrderAlreadyPaidException.class)
ProblemDetail handleConflict(OrderAlreadyPaidException ex) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    pd.setTitle("Order already paid");
    return pd;   // Content-Type: application/problem+json
}
```

*Conditional request — cache và chống ghi đè*

```http
GET /orders/42
→ 200 OK
  ETag: "7"
  Cache-Control: private, max-age=0, must-revalidate

GET /orders/42
If-None-Match: "7"
→ 304 Not Modified            (không có body — tiết kiệm băng thông)

PUT /orders/42
If-Match: "7"
→ 412 Precondition Failed     (nếu người khác đã sửa, version giờ là "8") — optimistic locking qua HTTP
```

*Xem header và phiên bản HTTP*

```bash
curl -sI https://example.com                  # chỉ header (HEAD)
curl -s -o /dev/null -w '%{http_version}\n' https://example.com   # 1.1 / 2 / 3
curl -v https://api.example.com/orders/42 -H 'Accept: application/json'
```

## Ứng Dụng Thực Tế

**Retry an toàn**: cấu hình retry (Resilience4j, Spring Retry, service mesh) chỉ cho method idempotent và cho lỗi tạm thời (`502`, `503`, `504`, timeout kết nối), kèm backoff + jitter. Không retry `4xx` (trừ `429`, và phải tôn trọng `Retry-After`). Với `POST` quan trọng (thanh toán) dùng header `Idempotency-Key`: server lưu key → kết quả, request trùng key trả lại kết quả cũ.

**Không trả 200 cho lỗi**: monitoring, load balancer, client retry đều dựa vào status code. `200 {"success": false}` làm dashboard xanh trong khi người dùng gặp lỗi.

**Timeout theo tầng**: gateway timeout phải lớn hơn timeout của service phía sau, nếu không client nhận `504` trong khi backend vẫn tiếp tục xử lý (và có thể thành công) → client retry → xử lý trùng.

**HTTP/2 giữa các service**: gRPC chạy trên HTTP/2; khi dùng load balancer L4, một kết nối HTTP/2 sống lâu dồn mọi request vào một pod → cần cân bằng tải ở L7 (theo request) hoặc phía client.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Idempotent là gì? PUT và POST khác nhau thế nào?</strong></summary>

**A:** Idempotent: gửi cùng request nhiều lần có tác dụng lên server giống như gửi một lần. `PUT /orders/42` với cùng body luôn để resource ở cùng trạng thái → idempotent, client tự chọn URI. `POST /orders` mỗi lần tạo một đơn mới → không idempotent, server chọn URI (trả trong `Location`). Hệ quả thực tế: hạ tầng có thể tự retry `PUT`/`DELETE`/`GET` khi mất kết nối, còn `POST` thì không nên — cần Idempotency-Key nếu muốn retry an toàn.

</details>

<details>
<summary><strong>401 và 403 khác nhau thế nào?</strong></summary>

**A:** `401 Unauthorized` (tên gây nhầm, thực chất là "unauthenticated"): request thiếu hoặc có thông tin xác thực không hợp lệ — token hết hạn, sai chữ ký; server gửi kèm `WWW-Authenticate` cho biết cách xác thực; client nên đăng nhập/refresh token rồi thử lại. `403 Forbidden`: server biết bạn là ai (hoặc không cần biết) nhưng từ chối — không đủ role, không sở hữu resource; xác thực lại cũng không giúp gì. Một số API trả `404` thay cho `403` để không để lộ resource có tồn tại.

</details>

<details>
<summary><strong>Phân biệt 502, 503, 504.</strong></summary>

**A:** Cả ba thường do gateway/proxy/load balancer trả về. `502 Bad Gateway`: upstream trả response không hợp lệ hoặc đóng kết nối đột ngột (app crash, sai cổng, sai protocol). `503 Service Unavailable`: tạm thời không phục vụ được — quá tải, đang bảo trì, không còn instance healthy; nên kèm `Retry-After`. `504 Gateway Timeout`: upstream không trả lời trong thời gian cho phép (query chậm, deadlock, timeout gateway nhỏ hơn thời gian xử lý). Khi điều tra: 502 xem log/crash của app, 504 xem độ trễ và timeout các tầng, 503 xem health check và tải.

</details>

<details>
<summary><strong>HTTP/2 cải tiến gì so với HTTP/1.1? HTTP/3 giải quyết vấn đề gì còn lại?</strong></summary>

**A:** HTTP/1.1 xử lý tuần tự trên mỗi kết nối, nên trình duyệt phải mở nhiều kết nối song song, header dạng text lặp lại. HTTP/2: framing nhị phân, multiplexing nhiều stream song song trên một kết nối TCP, nén header HPACK, ưu tiên stream. Vấn đề còn lại: mọi stream đi chung một kết nối TCP, một gói bị mất khiến TCP giữ lại toàn bộ dữ liệu phía sau → mọi stream cùng chờ (head-of-line blocking ở tầng transport). HTTP/3 chạy trên QUIC (UDP), mỗi stream được đảm bảo thứ tự độc lập nên mất gói chỉ ảnh hưởng stream đó; gộp bắt tay transport và TLS 1.3 nên thiết lập nhanh hơn; hỗ trợ đổi mạng mà không mất kết nối.

</details>

<details>
<summary><strong>ETag dùng để làm gì?</strong></summary>

**A:** ETag là định danh phiên bản của resource. (1) **Cache validation**: client gửi `If-None-Match: <etag>`, nếu chưa đổi server trả `304 Not Modified` không có body → tiết kiệm băng thông. (2) **Chống lost update**: client gửi `If-Match: <etag>` khi `PUT`/`PATCH`; nếu resource đã bị người khác sửa (ETag khác), server trả `412 Precondition Failed` thay vì ghi đè — optimistic locking ở tầng HTTP, thường map tới cột `@Version` của JPA.

</details>
