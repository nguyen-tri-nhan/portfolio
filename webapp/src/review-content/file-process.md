---
key: "File & Process"
title: "Lệnh File & Process"
crumb: "11. Linux & Deployment"
---

Các lệnh Linux thiết yếu cho điều hướng filesystem, quản lý file và giám sát process — nền tảng để tự mình deploy và troubleshoot ứng dụng Java trên Linux server.

## Điểm Chính

- <strong>Điều hướng</strong>: <code>ls -lah</code>, <code>cd</code>, <code>pwd</code>, <code>tree -L 2</code> (cấu trúc thư mục).
- <strong>File ops</strong>: <code>cp -r, mv, rm -rf, mkdir -p, ln -s</code> (symlink), <code>chmod, chown</code>.
- <strong>Tìm kiếm</strong>: <code>find /opt -name "*.jar"</code>, <code>find . -mtime -1</code> (sửa hôm nay), <code>grep -r "pattern" dir/</code>.
- <strong>Process</strong>: <code>ps aux | grep java</code>, <code>top</code>/<code>htop</code>, <code>kill -15 &lt;pid&gt;</code> (graceful), <code>kill -9 &lt;pid&gt;</code> (force).
- <strong>Disk</strong>: <code>df -h</code> (dung lượng filesystem), <code>du -sh *</code> (kích thước thư mục).
- <strong>Archive</strong>: <code>tar -czf backup.tar.gz dir/</code> (tạo), <code>tar -xzf backup.tar.gz</code> (giải nén).

## Ví Dụ Code

*Lệnh file và process management*

```bash
# Xem file với kích thước, quyền, owner
ls -lah /opt/app/

# Tìm file log lớn (>100MB)
find /var/log -name "*.log" -size +100M

# Tìm file sửa trong 24 giờ qua
find /opt/app -name "*.jar" -mtime -1

# Quản lý process
ps aux | grep java                    # list java process
ps aux | sort -k3 -rn | head -10      # top 10 process ngốn CPU nhất
top -c                                # monitor process tương tác

# Chạy background với log
nohup java -Xmx2g -jar app.jar   --spring.profiles.active=prod   > /var/log/app/app.log 2>&1 &
echo $! > /var/run/app.pid

# Kiểm tra process còn sống không
kill -0 $(cat /var/run/app.pid) 2>/dev/null && echo "running" || echo "stopped"

# Tắt graceful: SIGTERM trước, SIGKILL nếu cần
kill -15 $(cat /var/run/app.pid)    # graceful — Spring Boot hoàn thành request đang xử lý
sleep 10
kill -0 $(cat /var/run/app.pid) 2>/dev/null && kill -9 $(cat /var/run/app.pid)

# Phân quyền
chmod 755 deploy.sh         # rwxr-xr-x
chmod 640 application.yml   # rw-r----- (owner rw, group r, others không)
chown appuser:appgroup /opt/app/
```

## Ứng Dụng Thực Tế

Dùng <code>kill -15</code> (SIGTERM) trước — graceful shutdown của Spring Boot sẽ hoàn thành request đang xử lý trước khi dừng. Chỉ dùng <code>kill -9</code> như phương án cuối vì nó không cho phép cleanup. Theo dõi disk usage bằng cron job hoặc alerting: thư mục log đầy bất ngờ rất nhanh dưới high load.

## Câu Hỏi Phỏng Vấn

1. kill -9 và kill -15 khác nhau thế nào?
1. Chạy ứng dụng Java background và giữ nó chạy sau khi logout thế nào?
1. Tìm thư mục nào đang chiếm nhiều disk nhất thế nào?
