---
key: "ResultMap"
title: "ResultMap — Ánh Xạ Kết Quả Phức Tạp"
crumb: "4. Database › MyBatis"
---

ResultMap định nghĩa mapping tường minh từ cột sang field cho JOIN query, nested object (association = has-one), và nested collection (collection = has-many). Đây là cách MyBatis xử lý dữ liệu quan hệ mà không gây N+1.

## Điểm Chính

- <code>resultType</code>: tự map theo tên cột. Đủ cho query một bảng.
- <code>resultMap</code>: cần khi tên cột khác field name, hoặc mapping kết quả JOIN sang nested object.
- <code>&lt;association property="address" javaType="Address"&gt;</code>: ánh xạ quan hệ has-one.
- <code>&lt;collection property="items" ofType="OrderItem"&gt;</code>: ánh xạ quan hệ has-many.
- Một JOIN query với <code>&lt;collection&gt;</code> tốt hơn nhiều so với N+1 select riêng.
- Bật <code>mapUnderscoreToCamelCase=true</code> để giảm boilerplate <code>&lt;result&gt;</code> tag.

## Ví Dụ Code

*ResultMap với association và collection*

```xml
<!-- ResultMap: Order → Address (has-one) + List<OrderItem> (has-many) -->
<resultMap id="OrderRM" type="com.example.Order">
  <id     property="id"     column="o_id"/>
  <result property="userId" column="o_user_id"/>
  <result property="total"  column="o_total"/>

  <!-- has-one: embedded Address object -->
  <association property="address" javaType="com.example.Address">
    <result property="street" column="a_street"/>
    <result property="city"   column="a_city"/>
    <result property="zip"    column="a_zip"/>
  </association>

  <!-- has-many: List<OrderItem> từ các dòng JOIN -->
  <collection property="items" ofType="com.example.OrderItem">
    <id     property="id"        column="i_id"/>
    <result property="productId" column="i_product_id"/>
    <result property="quantity"  column="i_qty"/>
    <result property="price"     column="i_price"/>
  </collection>
</resultMap>

<!-- Một JOIN duy nhất — không N+1 -->
<select id="findOrderDetail" resultMap="OrderRM">
  SELECT o.id          AS o_id,   o.user_id  AS o_user_id, o.total   AS o_total,
         a.street      AS a_street, a.city   AS a_city,   a.zip     AS a_zip,
         i.id          AS i_id,   i.product_id AS i_product_id,
         i.quantity    AS i_qty,  i.price    AS i_price
  FROM orders o
  LEFT JOIN addresses   a ON a.order_id = o.id
  LEFT JOIN order_items i ON i.order_id = o.id
  WHERE o.id = #{id}
</select>
```

## Ứng Dụng Thực Tế

Alias tất cả cột trong JOIN query (ví dụ <code>o.id AS o_id</code>) để tránh xung đột khi nhiều bảng có cột tên <code>id</code>. Dùng <code>&lt;collection&gt;</code> với JOIN cho hầu hết trường hợp — load tất cả trong một query. Chỉ dùng lazy <code>select</code> attribute (trigger query riêng mỗi record) khi nested data hiếm khi cần.

## Câu Hỏi Phỏng Vấn

1. resultType và resultMap khác nhau thế nào?
1. MyBatis xử lý quan hệ một-nhiều trong một query thế nào?
1. Ngăn N+1 query trong MyBatis thế nào?
