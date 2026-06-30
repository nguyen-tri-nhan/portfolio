---
key: "Dynamic SQL"
title: "Dynamic SQL"
crumb: "4. Database › MyBatis"
---

MyBatis dynamic SQL dùng XML tag để build SQL có điều kiện — loại bỏ nối chuỗi thủ công trong khi giữ query dễ đọc và an toàn injection. Tag chính: &lt;if&gt;, &lt;where&gt;, &lt;set&gt;, &lt;foreach&gt;, &lt;choose&gt;.

## Điểm Chính

- <code>&lt;if test="..."&gt;</code>: include SQL có điều kiện. Dùng biểu thức OGNL.
- <code>&lt;where&gt;</code>: wrap điều kiện, tự thêm WHERE và bỏ AND/OR đầu — thay thế hack "WHERE 1=1".
- <code>&lt;set&gt;</code>: cho UPDATE — tự thêm SET và bỏ dấu phẩy cuối.
- <code>&lt;foreach&gt;</code>: iterate collection. Cần thiết cho mệnh đề IN: <code>WHERE id IN (&lt;foreach&gt;)</code>.
- <code>&lt;choose&gt;&lt;when&gt;&lt;otherwise&gt;</code>: tương đương switch/case — chỉ thực thi when đầu tiên khớp.

## Ví Dụ Code

*<where>, <foreach>, <set> — ví dụ thực tế*

```xml
<!-- Dynamic search với <where> và <if> -->
<select id="searchOrders" resultType="Order">
  SELECT id, user_id, total, status, created_at FROM orders
  <where>
    <if test="userId   != null">AND user_id   = #{userId}</if>
    <if test="status   != null">AND status    = #{status}</if>
    <if test="startDate != null">AND created_at &gt;= #{startDate}</if>
    <if test="endDate   != null">AND created_at &lt;= #{endDate}</if>
  </where>
  ORDER BY created_at DESC
  LIMIT #{pageSize} OFFSET #{offset}
</select>

<!-- IN clause với <foreach> -->
<select id="findByIds" resultType="User">
  SELECT * FROM users WHERE id IN
  <foreach item="id" collection="list" open="(" separator="," close=")">
    #{id}
  </foreach>
</select>

<!-- Partial update với <set> (chỉ update field không null) -->
<update id="updateSelective">
  UPDATE users
  <set>
    <if test="name   != null">name   = #{name},</if>
    <if test="email  != null">email  = #{email},</if>
    <if test="status != null">status = #{status},</if>
  </set>
  WHERE id = #{id}
</update>
```

## Ứng Dụng Thực Tế

<code>&lt;where&gt;</code> là tag dùng nhiều nhất trong project thực — giải quyết gọn "tất cả điều kiện optional" mà không cần hack "WHERE 1=1". <code>&lt;foreach&gt;</code> cho IN clause an toàn hơn nối chuỗi thủ công. Pattern <code>updateSelective</code> (chỉ update field không null) tương đương <code>@DynamicUpdate</code> của JPA nhưng toàn quyền kiểm soát SQL.

## Câu Hỏi Phỏng Vấn

1. Tag <where> giải quyết vấn đề gì so với hardcode "WHERE 1=1"?
1. Viết batch INSERT 100 record bằng MyBatis thế nào?
1. Biểu thức OGNL kiểm tra list không rỗng thế nào?
