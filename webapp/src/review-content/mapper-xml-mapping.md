---
key: "Mapper & XML Mapping"
title: "Mapper Interface & XML Mapping"
crumb: "4. Database › MyBatis"
---

MyBatis ánh xạ Java interface method sang SQL qua XML file hoặc annotation inline. XML namespace phải khớp đúng tên đầy đủ của interface; id của statement phải khớp tên method.

## Điểm Chính

- <code>@Mapper</code> trên interface; Spring Boot auto-scan với <code>@MapperScan("com.example.mapper")</code>.
- CRUD đơn giản: dùng annotation (<code>@Select, @Insert, @Update, @Delete</code>) trực tiếp trên method.
- SQL phức tạp: dùng XML mapper file — dễ đọc hơn cho query dài dòng, hỗ trợ dynamic SQL.
- <code>@Options(useGeneratedKeys=true, keyProperty="id")</code>: gán auto-increment PK ngược lại vào entity sau insert.
- <code>resultType</code>: class đơn giản, tự map tên cột sang field (camelCase nếu bật <code>mapUnderscoreToCamelCase=true</code>).

## Ví Dụ Code

*Mapper với annotation và XML*

```java
// Mapper interface
@Mapper
public interface UserMapper {
    @Select("SELECT * FROM users WHERE id = #{id}")
    User findById(Long id);

    @Select("SELECT * FROM users WHERE email = #{email}")
    Optional<User> findByEmail(String email);

    @Insert("INSERT INTO users(name, email, status) VALUES(#{name}, #{email}, #{status})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(User user);

    @Update("UPDATE users SET status = #{status} WHERE id = #{id}")
    int updateStatus(@Param("id") Long id, @Param("status") String status);

    // Query phức tạp → dùng XML
    List<User> searchUsers(UserQuery query);
}

// XML: src/main/resources/mapper/UserMapper.xml
/*
<mapper namespace="com.example.mapper.UserMapper">
  <select id="searchUsers" resultType="com.example.domain.User">
    SELECT id, name, email, status, created_at
    FROM users
    WHERE status = #{status}
      AND created_at >= #{startDate}
    ORDER BY created_at DESC
    LIMIT #{pageSize} OFFSET #{offset}
  </select>
</mapper>
*/
```

## Ứng Dụng Thực Tế

Dùng annotation cho CRUD đơn giản một bảng, XML cho query có điều kiện động, JOIN nhiều bảng. Bật <code>mapUnderscoreToCamelCase: true</code> trong config MyBatis để tự map <code>user_name → userName</code> — giảm đáng kể boilerplate resultMap. Luôn dùng <code>@Options(useGeneratedKeys=true)</code> để lấy PK tự sinh ngược về entity sau insert.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Rủi ro khi dùng ${} thay vì #{} trong MyBatis?</strong></summary>

**A:** `#{}` → PreparedStatement parameter: giá trị được escape, ngăn **SQL injection**. `${}` → string substitution trực tiếp vào SQL — **SQL injection vulnerability**: nếu user input, attacker có thể inject SQL. Dùng `${}` chỉ cho column name hoặc table name trong dynamic SQL (không phải giá trị user input): `ORDER BY ${columnName}` với column name whitelist validate. Không bao giờ dùng `${}` cho user-controlled input.

</details>

<details>
<summary><strong>Lấy primary key tự sinh sau INSERT thế nào?</strong></summary>

**A:** Trong MyBatis XML:
```xml
<insert id="insert" useGeneratedKeys="true" keyProperty="id">
  INSERT INTO users (name, email) VALUES (#{name}, #{email})
</insert>
```
`useGeneratedKeys="true"`: dùng JDBC getGeneratedKeys(). `keyProperty="id"`: set generated key vào field `id` của parameter object. Sau gọi `mapper.insert(user)`, `user.getId()` có giá trị mới. Cho DB không support getGeneratedKeys: dùng `<selectKey>` tag với `keyOrder="AFTER"`.

</details>

<details>
<summary><strong>Namespace trong XML mapper file liên hệ với Mapper interface thế nào?</strong></summary>

**A:** Namespace trong `<mapper namespace="com.example.UserMapper">` phải **khớp chính xác** với fully-qualified name của Mapper interface. MyBatis scan interface methods và lookup tương ứng trong namespace: method `UserMapper.findById(Long)` → lookup `<select id="findById">` trong namespace `com.example.UserMapper`. Mismatch namespace → `BindingException`. Annotation `@Mapper` hoặc `MapperScan` để MyBatis detect interface tự động.

</details>
