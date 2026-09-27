---
key: "Dockerfile Best Practices"
title: "Dockerfile Best Practices"
crumb: "15. Cloud & DevOps › Docker"
---

Dockerfile tốt tạo ra image nhỏ, bảo mật, build nhanh bằng cách dùng base image tối giản, layer caching, non-root user và tránh secret trong layer.

## Điểm Chính

- Dùng base image tag cụ thể, không bao giờ <code>:latest</code> — đảm bảo reproducibility.
- Dùng Alpine hoặc distroless để giảm attack surface và kích thước image.
- Kết hợp lệnh RUN với <code>&&</code> để giảm số lượng layer và tránh cache package list trung gian.
- Đừng bao giờ hardcode secret trong Dockerfile — dùng build arg hoặc biến môi trường runtime.
- Dùng <code>.dockerignore</code> để loại trừ <code>target/</code>, <code>*.md</code>, <code>.git</code> khỏi build context.
- Instruction <code>HEALTHCHECK</code>: Docker đánh dấu container healthy/unhealthy (không tự restart). Kubernetes không dựa vào nó — khai báo probe trong Pod spec.

## Ví Dụ Code

*Dockerfile best practices: .dockerignore, pin tag, combine RUN, non-root, exec ENTRYPOINT, CI tagging, trivy scan*

```bash
# ── .dockerignore — keep build context lean ──
# (comment phải nằm trên dòng riêng: `#` giữa dòng bị coi là một phần của pattern)
# compiled output — already in jar, never re-copy
target/
# version history — irrelevant, can be hundreds of MB
.git/
# documentation
*.md
# runtime logs
*.log
# local secrets — NEVER include in image
.env
# IDE project files
.idea/

# ── Dockerfile best practices: order-service ──
# pin exact tag — never :latest
FROM eclipse-temurin:21.0.3_9-jre-alpine

# Combine RUN commands: apk cache dropped in same layer (--no-cache) → smaller image
# Combining addgroup + adduser in one RUN avoids an extra intermediate layer
RUN apk add --no-cache curl  && addgroup -S appgroup  && adduser  -S appuser -G appgroup

# process chạy với user không phải root; lưu ý COPY vẫn tạo file owned bởi root (UID/GID 0)
# trừ khi dùng --chown như bên dưới
USER appuser
WORKDIR /app

# --chown at COPY time — file owned by appuser, not root
COPY --from=build --chown=appuser:appgroup /app/target/order-service-*.jar app.jar

# HEALTHCHECK chỉ đặt health status (starting/healthy/unhealthy) và phát event health_status.
# Docker KHÔNG tự restart container unhealthy — restart policy (on-failure...) chỉ chạy khi container THOÁT.
# Trên Kubernetes, sức khỏe container do liveness/readiness/startup probe trong Pod spec quyết định.
# --start-period: grace period before first check (JVM warmup ~30-60 s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3   CMD curl -sf http://localhost:8080/actuator/health/readiness || exit 1

EXPOSE 8080

# Exec form (JSON array): process receives OS signals directly — enables graceful shutdown
# Shell form would wrap in /bin/sh -c → JVM never gets SIGTERM → abrupt kill
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]

# ── CI image tagging best practice ──
# NEVER use :latest in production — makes rollback unpredictable
# Tag with git SHA for exact traceability and rollback:
#   docker build -t myrepo/order-service:${GIT_SHA} .
#   kubectl set image deployment/order-service order-service=myrepo/order-service:${GIT_SHA}

# ── Post-build vulnerability scan (fail CI on HIGH/CRITICAL) ──
#   trivy image myrepo/order-service:${GIT_SHA} --exit-code 1 --severity HIGH,CRITICAL
```

## Ứng Dụng Thực Tế

Scan image với <code>trivy</code> hoặc <code>docker scout</code> cho vulnerability. Đặt image tag với git SHA trong CI (<code>myapp:${GIT_SHA}</code>) để traceability. Không bao giờ dùng <code>:latest</code> trong production — khiến rollback không thể đoán trước.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao bạn nên tránh chạy container với root?</strong></summary>

**A:** Container root = root trên host nếu có container escape vulnerability. Attacker có thể: đọc/ghi file nhạy cảm của host, leo thang privilege, attack container khác cùng node. Best practice: thêm `USER nonroot` (hoặc `USER 1001`) vào Dockerfile. Nhiều K8s cluster enforce `PodSecurityPolicy`/`PodSecurityAdmission` block container chạy với uid=0. Spring Boot images từ Buildpacks mặc định dùng non-root user (`cnb`).

</details>

<details>
<summary><strong>.dockerignore file là gì và tại sao quan trọng?</strong></summary>

**A:** `.dockerignore` liệt kê file/dir không copy vào build context gửi lên Docker daemon. Quan trọng: (1) **Security**: tránh copy `.env`, credentials, private keys vào image. (2) **Performance**: giảm build context size — `node_modules`, `.git`, `target/` có thể hàng GB; Docker daemon phải transfer toàn bộ build context trước khi build. (3) **Cache**: tránh invalidate cache khi file không liên quan thay đổi.

</details>

<details>
<summary><strong>Làm thế nào để xử lý secret cần thiết lúc build time vs runtime?</strong></summary>

**A:** **Build time secret** (npm token, private repo): dùng `--secret` flag (BuildKit): `RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm install` — secret không được lưu trong image layer. **Không** dùng ARG/ENV cho secret vì visible trong `docker history`. **Runtime secret**: inject qua environment variable (K8s Secret, Docker Compose secrets, Vault Agent). Không hardcode secret vào Dockerfile hay image.

</details>
