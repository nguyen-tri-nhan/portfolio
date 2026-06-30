---
key: "JMeter / Gatling / k6"
title: "JMeter, Gatling & k6"
crumb: "9. Testing › Performance Testing"
---

Ba tool performance testing phổ biến: JMeter (GUI/XML, chuẩn enterprise), Gatling (Scala DSL, report tốt), k6 (JavaScript DSL, hiện đại CI-first).

## Điểm Chính

- <strong>JMeter</strong>: GUI + XML, hỗ trợ nhiều protocol (HTTP, JDBC, JMS). Chuẩn enterprise. Khó version-control.
- <strong>Gatling</strong>: Scala DSL, compiled scenario, HTML report chi tiết, CI-friendly.
- <strong>k6</strong>: JavaScript DSL, Go runtime (memory-efficient), tích hợp CI/CD xuất sắc, threshold như code. Tốt nhất cho team ưu tiên JS.
- Tất cả hỗ trợ: ramping VU, think time, assertion, data feeder.

## Ví Dụ Code

*k6 script: ramp → sustained → spike, custom metrics, SLO thresholds, setup/teardown*

```java
// ── k6 script: order checkout với ramp-up → sustained → spike ───────────────
// order-checkout.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics beyond default k6 metrics
const orderSuccessRate  = new Rate('order_success_rate');
const checkoutDuration  = new Trend('checkout_duration_ms', true);

export const options = {
  stages: [
    { duration: '2m', target: 50  },  // ramp-up: 0 → 50 VUs
    { duration: '5m', target: 50  },  // sustained load
    { duration: '1m', target: 200 },  // spike: 50 → 200 VUs
    { duration: '2m', target: 200 },  // hold spike
    { duration: '2m', target: 0   },  // ramp-down
  ],
  thresholds: {
    http_req_duration:    ['p(95)<500',  'p(99)<2000'],  // SLO gates
    http_req_failed:      ['rate<0.01'],                 // <1% errors
    order_success_rate:   ['rate>0.99'],                 // >99% orders created
    checkout_duration_ms: ['p(95)<800'],                 // full checkout < 800ms
  },
};

// Setup: called once — get auth token
export function setup() {
  const res = http.post('https://api.example.com/auth/token', JSON.stringify({
    clientId: 'perf-test', clientSecret: __ENV.CLIENT_SECRET
  }), { headers: { 'Content-Type': 'application/json' } });
  return { token: res.json('access_token') };
}

// Default function: executed by each VU repeatedly
export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Step 1: Browse products
  const products = http.get('https://api.example.com/api/products?limit=10', { headers });
  check(products, { 'products 200': r => r.status === 200 });
  const productId = products.json('items.0.id');

  sleep(Math.random() * 2 + 0.5);   // think time: 0.5–2.5s

  // Step 2: Place order (business critical path)
  const startMs = Date.now();
  const order = http.post(
    'https://api.example.com/api/orders',
    JSON.stringify({ userId: `user-${__VU}`, items: [{ productId, quantity: 1 }] }),
    { headers }
  );

  const success = check(order, {
    'order created 201': r => r.status === 201,
    'has orderId':        r => r.json('orderId') !== undefined,
  });
  orderSuccessRate.add(success);
  checkoutDuration.add(Date.now() - startMs);

  sleep(1);  // cool-down between iterations
}

// Teardown: called once after all VUs finish
export function teardown(data) {
  console.log('k6 test complete — check Grafana dashboard for results');
}
// Run: k6 run --env CLIENT_SECRET=xxx order-checkout.js
// CI:  k6 run --out influxdb=http://influx:8086/k6 order-checkout.js
```

## Ứng Dụng Thực Tế

Cho project mới: chọn k6. Cho JMeter infrastructure có sẵn: giữ nguyên nhưng thêm CI automation. Cho HTML report chi tiết mỗi request: Gatling. Luôn định nghĩa pass/fail threshold trong tool — đừng dựa vào kiểm tra kết quả thủ công.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa virtual user và request per second là gì?
1. Làm thế nào để parameterize test với credential user khác nhau?
1. Think time mô phỏng gì trong load test?
