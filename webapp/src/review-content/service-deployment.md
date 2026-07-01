---
key: "Service Deployment"
title: "Deploy Service & systemd"
crumb: "11. Linux & Deployment"
---

systemd là service manager tiêu chuẩn trên Linux hiện đại. Dùng systemd service unit cho ứng dụng Java: tự động restart khi fail, start khi boot, quản lý log qua journald, và điều khiển lifecycle gọn gàng.

## Điểm Chính

- <code>systemctl start/stop/restart/status &lt;service&gt;</code>: quản lý lifecycle service.
- <code>systemctl enable &lt;service&gt;</code>: start khi boot. <code>systemctl disable</code>: xóa khỏi boot.
- <code>journalctl -u myapp -f</code>: follow log của service cụ thể.
- <code>journalctl -u myapp --since "1 hour ago"</code>: query log theo thời gian.
- <code>scp user@host:file .</code>: copy file qua SSH. <code>rsync -avz src/ user@host:dst/</code>: sync incremental hiệu quả.
- Đặt <code>SuccessExitStatus=143</code> cho Spring Boot: thoát với 143 (128+SIGTERM) khi graceful shutdown.

## Ví Dụ Code

*systemd service unit và quy trình deploy*

```bash
# /etc/systemd/system/myapp.service
[Unit]
Description=My Spring Boot Application
After=network.target mysql.service

[Service]
User=appuser
Group=appgroup
WorkingDirectory=/opt/myapp
ExecStart=/usr/bin/java   -Xms1g -Xmx1g   -XX:+UseG1GC   -XX:+HeapDumpOnOutOfMemoryError   -XX:HeapDumpPath=/var/log/myapp   -XX:+ExitOnOutOfMemoryError   -Dspring.profiles.active=prod   -jar /opt/myapp/app.jar
SuccessExitStatus=143         # Spring Boot thoát 143 khi SIGTERM (graceful shutdown)
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target

# --- Đăng ký và start ---
sudo systemctl daemon-reload   # reload sau khi tạo/sửa unit file
sudo systemctl enable myapp    # start khi boot
sudo systemctl start myapp
sudo systemctl status myapp    # verify đang chạy

# --- Deploy JAR version mới ---
# Bước 1: upload JAR mới
scp target/app-2.0.jar appuser@server:/opt/myapp/app-new.jar

# Bước 2: trên server — backup + swap + restart
ssh appuser@server '
  cp /opt/myapp/app.jar /opt/myapp/app.jar.bak
  mv /opt/myapp/app-new.jar /opt/myapp/app.jar
  sudo systemctl restart myapp
'

# Bước 3: verify
ssh appuser@server 'sudo journalctl -u myapp -f -n 50'
# và: curl http://server:8080/actuator/health
```

## Ứng Dụng Thực Tế

Luôn dùng systemd thay vì raw <code>nohup</code>: systemd tự restart khi fail, quản lý log qua journald (có rotation), start lại khi reboot. Đặt <code>SuccessExitStatus=143</code> — không có nó, systemd coi graceful shutdown của Spring Boot là crash và cố restart không cần thiết. Dùng <code>After=mysql.service</code> để đảm bảo DB khởi động xong trước khi app start.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Blue-green deployment hoạt động thế nào?</strong></summary>

**A:** Duy trì **hai production environment** identical: Blue (current live) và Green (new version). Deploy new version lên Green → test Green → switch load balancer để route 100% traffic sang Green → Blue trở thành standby. Rollback: switch LB về Blue (instant). Không cần downtime. Trade-off: tốn chi phí double infrastructure. Giải quyết: database migration phải backward compatible (Blue phải đọc được DB schema sau migration). Kubernetes: Blue/Green với service selector switch: `kubectl patch service myapp -p '{"spec":{"selector":{"version":"green"}}}'`.

</details>

<details>
<summary><strong>Canary deployment khác blue-green thế nào?</strong></summary>

**A:** **Canary**: route **percentage nhỏ** traffic (1-5%) đến new version, tăng dần nếu không có vấn đề. Không cần double infrastructure — cả hai version chạy song song, traffic split theo weight. **Blue-green**: switch 100% traffic instant. Canary tốt hơn cho: phát hiện vấn đề với real user traffic trước khi full rollout, giảm blast radius. Blue-green tốt cho: cần instant rollback, không muốn split traffic. Kubernetes canary: dùng Argo Rollouts hoặc Flagger tự động tăng traffic % khi metrics OK. Istio: `VirtualService` với weight routing.

</details>

<details>
<summary><strong>Làm thế nào để handle database migration trong deployment?</strong></summary>

**A:** Nguyên tắc: migration phải **backward compatible** — old code phải chạy được với schema mới (và ngược lại). Expand-Contract pattern: (1) **Expand**: thêm column mới (nullable hoặc có default), giữ column cũ — old code ignore column mới. (2) Deploy new code (read cả cũ và mới). (3) **Migrate data**. (4) **Contract**: drop column cũ sau khi tất cả traffic đã dùng new code. Không rename column trực tiếp — thêm column mới, copy data, update code, drop cũ. Flyway/Liquibase: version migration, tích hợp vào deploy pipeline.

</details>
