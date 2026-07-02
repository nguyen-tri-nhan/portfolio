---
key: "owasp-top10"
title: "OWASP Top 10"
crumb: "20. Security › OWASP"
---

OWASP Top 10 (2021) liệt kê 10 rủi ro bảo mật nghiêm trọng nhất của ứng dụng web — là chuẩn tham chiếu để review code, threat modeling, và security training.

## Điểm Chính

- **A01 Broken Access Control**: user truy cập resource không được phép (IDOR, privilege escalation) — fix: deny-by-default, kiểm tra authorization ở tầng service (không chỉ UI).
- **A02 Cryptographic Failures**: dữ liệu nhạy cảm không được mã hóa đúng — fix: TLS cho data in transit, **bcrypt/Argon2** cho password (không dùng MD5/SHA1/SHA256 vì thiếu salt và quá nhanh).
- **A03 Injection** (SQL, NoSQL, Command): user input được nhúng trực tiếp vào câu lệnh — fix: **parameterized queries**, ORM, input validation, least privilege DB account.
- **A04 Insecure Design**: thiếu threat modeling từ đầu, bỏ sót security control cơ bản — fix: secure-by-design principles, threat model trước khi code.
- **A05 Security Misconfiguration**: default credentials, verbose error message lộ stack trace, unnecessary endpoints enabled, S3 bucket public.
- **A06 Vulnerable Components**: dependency có CVE đã biết — fix: SBOM (Software Bill of Materials), `dependabot`, `snyk`, upgrade policy định kỳ.
- **A07 Authentication Failures**: weak password policy, không có MFA, session fixation, credential stuffing không có rate limiting.
- **A08 Software & Data Integrity Failures**: CI/CD pipeline bị tấn công, insecure deserialization, artifact không được verify checksum/signature.
- **A09 Security Logging Failures**: không log security events (login failure, access denied), hoặc log sensitive data (password, token) — phải log WHO, WHAT, WHEN, WHERE.
- **A10 SSRF** (Server-Side Request Forgery): server fetch URL từ user input → attacker trỏ vào internal service (metadata endpoint, database) — fix: allowlist domain/IP, block private IP ranges.

## Ví Dụ Code

*Java: so sánh vulnerable vs fixed code cho SQL Injection (Statement vs PreparedStatement), SSRF (naive fetch vs allowlist), và Broken Access Control*

```java
// ======================================================
// A03 - SQL INJECTION
// ======================================================

// ❌ VULNERABLE: concatenate user input vào SQL string
public List<User> findUserVulnerable(String username) {
    // Attacker nhập: ' OR '1'='1  → trả về toàn bộ user table
    // Attacker nhập: '; DROP TABLE users; -- → xóa table
    String sql = "SELECT * FROM users WHERE username = '" + username + "'";
    Statement stmt = connection.createStatement();
    return mapResults(stmt.executeQuery(sql));
}

// ✅ FIXED: Parameterized query — DB tách biệt code và data
public List<User> findUserSafe(String username) {
    String sql = "SELECT * FROM users WHERE username = ?";
    PreparedStatement stmt = connection.prepareStatement(sql);
    stmt.setString(1, username);       // driver tự escape — không thể inject
    return mapResults(stmt.executeQuery());
}

// ======================================================
// A10 - SSRF (Server-Side Request Forgery)
// ======================================================

// ❌ VULNERABLE: fetch URL trực tiếp từ user input
public String fetchExternalContent(String url) throws IOException {
    // Attacker gửi: http://169.254.169.254/latest/meta-data/iam/credentials
    // → server (chạy trên AWS EC2) lấy được AWS credentials của production!
    return new URL(url).openConnection().getInputStream()
           .readAllBytes().toString();
}

// ✅ FIXED: Allowlist domain và block private/internal IP ranges
public String fetchExternalContentSafe(String urlString) throws IOException {
    URL url = new URL(urlString);

    // 1. Chỉ cho phép HTTPS
    if (!"https".equalsIgnoreCase(url.getProtocol())) {
        throw new SecurityException("Only HTTPS URLs are allowed");
    }

    // 2. Allowlist domain hợp lệ
    Set<String> allowedHosts = Set.of("api.trusted-partner.com", "cdn.example.com");
    if (!allowedHosts.contains(url.getHost())) {
        throw new SecurityException("Host not in allowlist: " + url.getHost());
    }

    // 3. Resolve IP và block private ranges (SSRF via DNS rebinding)
    InetAddress resolved = InetAddress.getByName(url.getHost());
    if (isPrivateOrLoopback(resolved)) {
        throw new SecurityException("Resolved IP is private/internal: " + resolved.getHostAddress());
    }

    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    conn.setConnectTimeout(3000);
    conn.setReadTimeout(5000);
    return new String(conn.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
}

private boolean isPrivateOrLoopback(InetAddress addr) {
    return addr.isLoopbackAddress()    // 127.x.x.x
        || addr.isSiteLocalAddress()   // 10.x, 172.16-31.x, 192.168.x
        || addr.isLinkLocalAddress()   // 169.254.x (AWS metadata)
        || addr.isAnyLocalAddress();
}

// ======================================================
// A01 - BROKEN ACCESS CONTROL (IDOR)
// ======================================================

// ❌ VULNERABLE: chỉ check authenticated, không check ownership
@GetMapping("/api/invoices/{id}")
public Invoice getInvoice(@PathVariable Long id) {
    // User A có thể gọi /api/invoices/999 và đọc invoice của User B!
    return invoiceRepository.findById(id).orElseThrow();
}

// ✅ FIXED: deny-by-default, kiểm tra ownership ở tầng service
@GetMapping("/api/invoices/{id}")
public Invoice getInvoice(@PathVariable Long id,
                           @AuthenticationPrincipal UserDetails user) {
    Invoice invoice = invoiceRepository.findById(id)
        .orElseThrow(() -> new NotFoundException("Invoice not found"));

    // Ownership check: chỉ owner hoặc ADMIN mới được xem
    if (!invoice.getOwnerId().equals(user.getUsername())
            && !user.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))) {
        throw new AccessDeniedException("Access denied to invoice " + id);
        // Trả 403, không phải 404 — để phân biệt not-found vs forbidden
    }
    return invoice;
}
```

## Ứng Dụng Thực Tế

Trong security review, OWASP Top 10 được dùng như checklist để đánh giá từng endpoint: kiểm tra parameterized queries (A03), verify authorization check ở service layer (A01), và scan dependencies với `snyk test` hoặc `./mvnw dependency-check:check` (A06). SSRF đặc biệt nguy hiểm trong môi trường cloud vì server có thể query metadata endpoint để lấy IAM credentials và leo thang đặc quyền.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>SQL Injection và SSRF khác nhau như thế nào về cơ chế và tác hại?</strong></summary>

**A:** SQL Injection xảy ra khi user input được nhúng vào câu lệnh SQL mà không sanitize — attacker có thể đọc/sửa/xóa dữ liệu trong database. SSRF xảy ra khi server thực hiện HTTP request tới URL do attacker kiểm soát — attacker có thể khiến server tấn công internal service (database, cache, metadata endpoint) mà firewall bên ngoài không chặn được vì request xuất phát từ server nội bộ. SQL Injection tấn công tầng data, SSRF tấn công tầng network và infrastructure.

</details>

<details>
<summary><strong>Tại sao không dùng MD5 hay SHA1 để hash password?</strong></summary>

**A:** MD5 và SHA1 là hash function thiết kế cho speed — có thể tính hàng tỷ hash/giây trên GPU hiện đại, khiến brute-force và rainbow table attack khả thi. Chúng cũng không có salt tích hợp nên hai user cùng password sẽ có hash giống nhau. Password hashing cần dùng **bcrypt**, **Argon2**, hoặc **scrypt** — các thuật toán này có cost factor điều chỉnh được (tăng khi hardware mạnh hơn), salt tự động, và thiết kế để chậm có chủ ý. MD5/SHA1 phù hợp cho file integrity check, không phù hợp cho password.

</details>

<details>
<summary><strong>Làm thế nào để prevent SSRF attack hiệu quả?</strong></summary>

**A:** Cần kết hợp nhiều lớp phòng thủ: (1) **Input validation**: parse và validate URL, chỉ chấp nhận scheme `https`; (2) **Domain allowlist**: duy trì danh sách domain được phép thay vì blocklist — blocklist dễ bị bypass bằng encoding hay redirect; (3) **IP validation sau DNS resolution**: resolve hostname ra IP rồi kiểm tra xem có phải private/loopback range không — ngăn DNS rebinding attack; (4) **Network egress control**: cấu hình firewall/security group để server application không được connect tới internal IP ranges; (5) **Disable URL redirects** trong HTTP client để tránh open redirect kết hợp SSRF.

</details>
