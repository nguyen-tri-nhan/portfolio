---
key: "Network & Logs"
title: "Lệnh Network & Log"
crumb: "11. Linux & Deployment"
---

Lệnh chẩn đoán network để kiểm tra port và kết nối; công cụ phân tích log để monitoring thời gian thực và tìm pattern trong production — kỹ năng core để tự troubleshoot deployment.

## Điểm Chính

- <code>ss -lntp</code>: liệt kê tất cả TCP port đang listen với process name (thay thế hiện đại cho <code>netstat -tulnp</code>).
- <code>lsof -i :8080</code>: process nào đang dùng port 8080.
- <code>curl -v http://localhost:8080/actuator/health</code>: test HTTP endpoint verbose.
- <code>telnet db-host 3306</code>: test kết nối TCP đến port DB.
- <code>tail -f /var/log/app/app.log</code>: theo dõi log live.
- <code>grep -n "ERROR" app.log</code>: tìm error. <code>grep -C 5 "Exception"</code>: 5 dòng context.
- <code>awk '{print $NF}' access.log | sort -n | tail -20</code>: extract và sort field cuối (ví dụ response time).

## Ví Dụ Code

*Lệnh chẩn đoán network và phân tích log*

```bash
# Kiểm tra port
ss -lntp                           # tất cả port đang listen + process
ss -lntp | grep 8080               # port 8080 có được dùng không?
lsof -i :8080                      # PID nào đang dùng port 8080

# Test kết nối
curl -v http://localhost:8080/actuator/health   # HTTP test (verbose)
curl -o /dev/null -s -w "%{http_code}
" http://localhost:8080/  # chỉ lấy status code
telnet db-host 3306                # test kết nối DB port (Ctrl+] để thoát)
ping -c 4 gateway-service          # ICMP reachability

# Summary trạng thái connection (kiểm tra TIME_WAIT tích lũy)
ss -s

# Monitor log realtime
tail -f /var/log/app/app.log                       # tất cả output
tail -f /var/log/app/app.log | grep --line-buffered "ERROR"   # chỉ error

# Phân tích log
grep -n "NullPointerException" app.log             # tìm kèm số dòng
grep -C 10 "OutOfMemoryError" app.log              # 10 dòng context
grep "2024-01-15 14:" app.log | grep -c "ERROR"    # đếm error lúc 2pm

# Phân tích slow request trong nginx access log
awk '$NF > 1.0 {print}' /var/log/nginx/access.log    # request > 1s
awk '{sum+=$NF; cnt++} END{print "avg:", sum/cnt}' access.log  # avg response time
```

## Ứng Dụng Thực Tế

<code>tail -f | grep --line-buffered</code> là cách nhanh nhất xem error live. Flag <code>--line-buffered</code> ngăn grep buffer output khi pipe. Quy trình chẩn đoán outage production: 1) <code>curl /actuator/health</code> kiểm tra trạng thái app, 2) <code>tail -f app.log | grep ERROR</code> xem error hiện tại, 3) <code>ss -s</code> kiểm tra connection state (nhiều TIME_WAIT = connection leak hoặc surge traffic), 4) <code>top</code> kiểm tra CPU/memory.

## Câu Hỏi Phỏng Vấn

1. Kiểm tra process nào đang dùng port 8080 thế nào?
1. Nhiều TIME_WAIT connection trong ss -s cho thấy gì?
1. Xem live log nhưng chỉ filter dòng ERROR thế nào?
