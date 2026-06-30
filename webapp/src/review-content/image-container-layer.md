---
key: "Image / Container / Layer"
title: "Image, Container & Layer"
crumb: "8. Cloud & DevOps › Docker"
---

Docker image được tạo từ layer bất biến (mỗi instruction Dockerfile tạo một layer); container thêm thin writable layer lên trên image — chia sẻ tất cả layer read-only.

## Điểm Chính

- <strong>Layer</strong>: mỗi instruction <code>RUN</code>, <code>COPY</code>, <code>ADD</code> tạo layer read-only mới.
- Layer được cache: nếu instruction và context không thay đổi, Docker tái sử dụng cached layer (rebuild nhanh).
- <strong>Image</strong>: stack layer read-only + metadata.
- <strong>Container</strong>: image + thin writable layer (Union FS). Bị xóa khi container dừng trừ khi dùng volume.
- Tối ưu: đặt layer ít thay đổi trước (base OS, dependency), thay đổi thường xuyên sau (app code).

## Ví Dụ Code

*Layer caching: BAD vs GOOD COPY order, layer size breakdown, dive inspection, shared base layers across microservices*

```bash
# ── Docker layer caching deep-dive: order-service ──

# BAD: COPY . . invalidates ALL layers on any file change (src, README, .env…)
# Every rebuild re-downloads 200+ Maven deps → CI takes 5+ minutes
COPY . .
RUN mvn package -DskipTests

# ────────────────────────────────────────────────────────────────────────
# GOOD: split descriptor from source — dependency layer cached independently
# ────────────────────────────────────────────────────────────────────────
# Layer A: pom.xml only — cache miss only when deps change (rarely)
COPY pom.xml .
RUN mvn dependency:go-offline -q    # ~200 deps cached in this layer

# Layer B: source — cache miss on every commit (expected, fast ~20 s)
COPY src ./src
RUN mvn package -DskipTests -q

# ── Inspecting what each layer contains ──
# docker image history order-service:latest    # size per instruction
# dive order-service:latest                    # interactive explorer (brew install dive)

# ── Sharing base layers across all microservices ──
# order-service/Dockerfile:
FROM eclipse-temurin:21.0.3_9-jre-alpine    # ~190 MB, pulled once per host
# user-service/Dockerfile:
FROM eclipse-temurin:21.0.3_9-jre-alpine    # reuses cached base — 0 MB re-pulled

# ── Typical layer size breakdown ──
# Base JRE (eclipse-temurin alpine) : ~190 MB  (shared, pulled once per host)
# OS tools + non-root user          :   ~2 MB
# Maven dependency cache            : ~120 MB  (stable, rebuilt only on pom.xml change)
# Application fat-jar               :   ~8 MB  (rebuilt every commit — fast)
# Total                             : ~320 MB  vs ~600 MB without multi-stage
```

## Ứng Dụng Thực Tế

Sắp xếp instruction Dockerfile từ ít-đến-nhiều-thay-đổi-thường-xuyên. Copy <code>pom.xml</code> và chạy <code>mvn dependency:go-offline</code> TRƯỚC khi copy source — dependency hiếm khi thay đổi và sẽ được cache qua các rebuild, tăng tốc CI đáng kể.

## Câu Hỏi Phỏng Vấn

1. Tại sao bạn nên copy file descriptor gói trước source code trong Dockerfile?
1. Điều gì xảy ra với writable layer khi container bị xóa?
1. Union filesystem cho phép chia sẻ layer giữa container thế nào?
