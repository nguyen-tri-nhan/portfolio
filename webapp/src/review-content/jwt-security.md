---
key: "jwt-security"
title: "JWT Security"
crumb: "20. Security › Auth & Identity"
---

JWT (JSON Web Token) là chuẩn truyền claims giữa các bên dưới dạng JSON được ký số — stateless, compact, nhưng cần validate chặt chẽ để tránh các attack vector nguy hiểm.

## Điểm Chính

- **Cấu trúc**: `Header.Payload.Signature` — mỗi phần Base64URL encoded, **không phải mã hóa** — bất kỳ ai cũng decode được payload nếu không dùng JWE.
- **Header**: `{"alg": "RS256", "typ": "JWT"}` — `alg` là trường quan trọng nhất, phải whitelist phía server; **Payload**: standard claims (`iss`, `sub`, `exp`, `iat`, `aud`) + custom claims.
- **Stateless**: server verify JWT bằng cách kiểm tra signature với public key — không cần DB lookup, phù hợp microservices.
- **Claims bắt buộc validate**: `exp` (chưa hết hạn), `iss` (đúng issuer), `aud` (đúng audience) — bỏ sót bất kỳ claim nào là lỗ hổng bảo mật.
- **`alg: none` attack**: attacker xóa signature, đổi `alg` thành `"none"` — server naive sẽ chấp nhận token giả mạo; fix: luôn whitelist thuật toán cho phép.
- **RS256 → HS256 confusion attack**: attacker ký token bằng public key (biết công khai) và khai báo `alg: HS256` — server dùng public key như HMAC secret → verify thành công nhầm; fix: enforce `alg` cứng ở server.
- **JWS vs JWE**: JWS (ký) = đảm bảo integrity, ai cũng đọc được payload; JWE (mã hóa) = đảm bảo confidentiality, chỉ người có private key mới đọc được.
- **Revocation**: JWT stateless không revoke được trực tiếp — giải pháp: TTL ngắn (15 phút) + Redis blacklist token ID (`jti`) + Refresh Token rotation.

## Ví Dụ Code

*Kotlin Spring Security: JWT filter với RS256 validation, whitelist algorithm, validate exp/iss/aud, và Refresh Token rotation*

```kotlin
// ---- 1. JWT Validation Service với strict security checks ----
@Service
class JwtValidationService(
    @Value("\${jwt.issuer}") private val expectedIssuer: String,
    @Value("\${jwt.audience}") private val expectedAudience: String,
    private val jwksClient: JwkProviderClient,            // fetch public key từ JWKS URI
    private val tokenBlacklist: TokenBlacklistRepository  // Redis
) {
    // Whitelist: chỉ chấp nhận RS256, tuyệt đối không cho phép "none" hay HS256
    private val allowedAlgorithms = setOf("RS256", "ES256")

    fun validate(rawToken: String): JwtClaims {
        val parts = rawToken.split(".")
        require(parts.size == 3) { "Invalid JWT structure" }

        // 1. Decode header để lấy alg TRƯỚC khi verify signature
        val header = parseHeader(parts[0])
        val alg = header["alg"] as? String
            ?: throw JwtException("Missing 'alg' in header")

        // 2. Enforce algorithm whitelist — ngăn alg:none và confusion attacks
        if (alg !in allowedAlgorithms) {
            throw JwtException("Algorithm '$alg' is not allowed. Permitted: $allowedAlgorithms")
        }

        // 3. Verify signature với public key tương ứng (kid từ header)
        val kid = header["kid"] as? String ?: throw JwtException("Missing 'kid'")
        val publicKey = jwksClient.getPublicKey(kid)     // fetch từ /.well-known/jwks.json
        val claims = verifySignatureAndDecode(rawToken, publicKey, alg)

        // 4. Validate standard claims — tất cả đều bắt buộc
        val now = Instant.now()
        if (claims.expiration.isBefore(now)) {
            throw JwtExpiredException("Token expired at ${claims.expiration}")
        }
        if (claims.issuer != expectedIssuer) {
            throw JwtException("Invalid issuer '${claims.issuer}', expected '$expectedIssuer'")
        }
        if (expectedAudience !in claims.audience) {
            throw JwtException("Token audience ${claims.audience} does not include '$expectedAudience'")
        }

        // 5. Check blacklist: jti (JWT ID) bị revoke chưa?
        val jti = claims.jwtId ?: throw JwtException("Missing 'jti' claim — required for revocation")
        if (tokenBlacklist.isRevoked(jti)) {
            throw JwtException("Token '$jti' has been revoked")
        }

        return claims
    }
}

// ---- 2. Refresh Token Rotation ----
@Service
class TokenRefreshService(
    private val refreshTokenRepo: RefreshTokenRepository,  // persistent store (DB/Redis)
    private val jwtGenerator: JwtGenerator,
    private val tokenBlacklist: TokenBlacklistRepository
) {
    fun rotate(refreshToken: String): TokenPair {
        val stored = refreshTokenRepo.findByToken(refreshToken)
            ?: throw InvalidTokenException("Refresh token not found or already used")

        if (stored.expiresAt.isBefore(Instant.now())) {
            throw InvalidTokenException("Refresh token expired")
        }

        // Rotation: xóa refresh token cũ ngay lập tức (one-time use)
        refreshTokenRepo.delete(stored)

        // Blacklist access token cũ nếu còn trong TTL
        stored.accessTokenJti?.let { tokenBlacklist.revoke(it, stored.expiresAt) }

        // Phát hành cặp token mới
        val userId = stored.userId
        val newAccessToken  = jwtGenerator.generateAccess(userId, ttlMinutes = 15)
        val newRefreshToken = jwtGenerator.generateRefresh(userId, ttlDays = 30)
        refreshTokenRepo.save(newRefreshToken)

        return TokenPair(newAccessToken, newRefreshToken.token)
    }
}

// ---- 3. JWT Filter tích hợp vào Spring Security chain ----
@Component
class JwtAuthFilter(
    private val jwtValidation: JwtValidationService
) : OncePerRequestFilter() {

    override fun doFilterInternal(req: HttpServletRequest, res: HttpServletResponse,
                                  chain: FilterChain) {
        val token = extractBearerToken(req)
        if (token != null) {
            try {
                val claims = jwtValidation.validate(token)
                val auth = JwtAuthenticationToken(claims)
                SecurityContextHolder.getContext().authentication = auth
            } catch (ex: JwtException) {
                // Không throw — để Spring Security trả 401 qua AuthenticationEntryPoint
                log.warn("JWT validation failed: ${ex.message}")
            }
        }
        chain.doFilter(req, res)
    }

    private fun extractBearerToken(req: HttpServletRequest): String? =
        req.getHeader(HttpHeaders.AUTHORIZATION)
            ?.takeIf { it.startsWith("Bearer ") }
            ?.substring(7)
}
```

## Ứng Dụng Thực Tế

Trong hệ thống e-commerce, Access Token có TTL 15 phút giảm thiểu thiệt hại khi bị đánh cắp — ứng dụng dùng Refresh Token rotation để tự động làm mới mà user không cần đăng nhập lại. Khi user logout, `jti` của Access Token được lưu vào Redis với TTL bằng thời gian còn lại của token, đảm bảo revocation ngay lập tức mà không cần centralized session.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>JWT có thể bị decode mà không cần secret không? Điều đó có nguy hiểm không?</strong></summary>

**A:** Có — JWT mặc định chỉ được ký (JWS), không được mã hóa. Ai cũng có thể Base64URL decode phần Header và Payload để đọc claims. Điều này không nguy hiểm nếu không lưu thông tin nhạy cảm (password, PII) trong payload. Signature đảm bảo integrity — attacker đọc được nhưng không thể sửa payload mà không bị phát hiện. Nếu cần confidentiality thì dùng JWE (JSON Web Encryption) để mã hóa toàn bộ token.

</details>

<details>
<summary><strong>alg:none attack là gì và cách phòng chống thế nào?</strong></summary>

**A:** Attacker lấy một JWT hợp lệ, decode ra, sửa payload (ví dụ nâng role lên ADMIN), đổi `alg` trong header thành `"none"`, xóa phần Signature, rồi gửi token giả mạo này. Một số thư viện JWT lỗi thời sẽ bỏ qua bước verify signature khi `alg == "none"`. Fix: server phải **whitelist** các thuật toán được phép (ví dụ chỉ `["RS256", "ES256"]`) và từ chối bất kỳ token nào có `alg` nằm ngoài whitelist — kể cả `"none"`.

</details>

<details>
<summary><strong>Làm thế nào để revoke JWT trước khi hết hạn?</strong></summary>

**A:** JWT stateless nên không có cơ chế revoke built-in. Có 3 cách tiếp cận: (1) **Ngắn TTL** (15 phút) — giới hạn cửa sổ tấn công, kết hợp Refresh Token rotation; (2) **Token blacklist** — lưu `jti` (JWT ID) của token bị revoke vào Redis với TTL bằng thời gian còn lại của token, mọi request đều kiểm tra blacklist; (3) **Short-lived + re-auth** — khi cần revoke ngay (user logout, account bị khóa), dùng blacklist cho khoảng thời gian ngắn còn lại. Tradeoff: blacklist phá vỡ tính stateless và tạo thêm một network hop.

</details>
