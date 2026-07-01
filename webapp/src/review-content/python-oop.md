---
key: python-oop
title: Python OOP — Classes, Dunder Methods & Dataclasses
crumb: 14. Python > Python Cơ Bản
---

Python OOP dùng `class`, `self`, và dunder methods để định nghĩa hành vi — hỗ trợ multiple inheritance với MRO (C3 linearization), property descriptor, và dataclasses để giảm boilerplate.

## Điểm Chính

- **class & __init__**: constructor tường minh với `self` — Python không có `this` implicit như Java
- **Multiple inheritance**: Python cho phép kế thừa nhiều class, MRO (Method Resolution Order) theo thuật toán C3 linearization
- **Dunder methods**: `__str__` (human-readable), `__repr__` (debug), `__eq__` (equality), `__hash__` (hashability), `__len__`, `__getitem__`
- **@property**: biến method thành attribute — tương tự getter/setter Java nhưng syntax gọn hơn
- **@classmethod**: nhận `cls` thay vì `self`, dùng làm alternative constructor (tương tự static factory method)
- **@staticmethod**: không nhận `self` hay `cls`, thuần function đặt trong class cho namespace
- **@dataclass**: tự động generate `__init__`, `__repr__`, `__eq__` — tương tự Lombok `@Data` trong Java
- **__eq__ và __hash__**: nếu override `__eq__`, Python tự set `__hash__ = None` (object không hashable) — phải định nghĩa cả hai nếu muốn dùng trong set/dict

## Ví Dụ Code

*Class với dunder methods, multiple inheritance, MRO, property, classmethod, dataclass*

```python
from __future__ import annotations
from dataclasses import dataclass, field
from functools import total_ordering

# ── Basic Class ─────────────────────────────────────────────
class BankAccount:
    interest_rate: float = 0.05  # class variable (shared)

    def __init__(self, owner: str, balance: float = 0.0) -> None:
        self.owner = owner          # instance variable
        self._balance = balance     # convention: "protected"

    # @property — getter không cần gọi như method
    @property
    def balance(self) -> float:
        return self._balance

    @balance.setter
    def balance(self, value: float) -> None:
        if value < 0:
            raise ValueError("Balance cannot be negative")
        self._balance = value

    # @classmethod — alternative constructor (Factory Method pattern)
    @classmethod
    def from_dict(cls, data: dict) -> BankAccount:
        return cls(owner=data["owner"], balance=data.get("balance", 0.0))

    # @staticmethod — utility function, không cần self/cls
    @staticmethod
    def validate_amount(amount: float) -> bool:
        return amount > 0

    def __repr__(self) -> str:
        return f"BankAccount(owner={self.owner!r}, balance={self._balance})"

    def __str__(self) -> str:
        return f"{self.owner}'s account: ${self._balance:.2f}"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, BankAccount):
            return NotImplemented
        return self.owner == other.owner and self._balance == other._balance

    def __hash__(self) -> int:
        # Phải định nghĩa nếu override __eq__
        return hash((self.owner, self._balance))

# ── Multiple Inheritance & MRO ──────────────────────────────
class Flyable:
    def move(self) -> str:
        return "flying"

class Swimmable:
    def move(self) -> str:
        return "swimming"

class Duck(Flyable, Swimmable):
    def move(self) -> str:
        return f"duck can do both: {super().move()}"

# MRO: Duck → Flyable → Swimmable → object
print(Duck.__mro__)
print(Duck().move())  # "duck can do both: flying" (Flyable đứng trước)

# ── @dataclass — giảm boilerplate (tương tự Lombok @Data) ──
@dataclass
class Product:
    name: str
    price: float
    tags: list[str] = field(default_factory=list)  # mutable default

    # frozen=True: immutable dataclass (tương tự @Value trong Lombok)
    # order=True: tự generate __lt__, __le__, __gt__, __ge__

@dataclass(frozen=True)
class Point:
    x: float
    y: float

    def distance_to(self, other: Point) -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5

p1 = Point(0.0, 0.0)
p2 = Point(3.0, 4.0)
print(p2.distance_to(p1))  # 5.0
```

## Ứng Dụng Thực Tế

`@dataclass` rất phổ biến trong backend Python để định nghĩa domain models và value objects — thay thế việc viết `__init__`, `__eq__`, `__repr__` thủ công. FastAPI/Pydantic dùng pattern tương tự nhưng với validation bổ sung. MRO quan trọng khi build mixin classes cho DRY behavior (ví dụ `TimestampMixin`, `SoftDeleteMixin` trong ORM models).

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>MRO và diamond problem trong Python được giải quyết thế nào?</strong></summary>

**A:** Python dùng thuật toán C3 linearization để xác định thứ tự tìm kiếm method trong multiple inheritance. Diamond problem xảy ra khi class D kế thừa B và C, cả hai đều kế thừa A. C3 đảm bảo: (1) child class luôn đứng trước parent, (2) thứ tự trong `class D(B, C)` được tôn trọng (B trước C), (3) mỗi class chỉ xuất hiện một lần. Dùng `ClassName.__mro__` hoặc `ClassName.mro()` để xem thứ tự. `super()` trong Python aware MRO, nên cooperative multiple inheritance hoạt động đúng khi tất cả class trong chain đều dùng `super()`.

</details>

<details>
<summary><strong>__eq__ và __hash__ liên quan thế nào? Tại sao override __eq__ lại mất __hash__?</strong></summary>

**A:** Trong Python, hai object bằng nhau (`a == b` là True) phải có cùng hash (`hash(a) == hash(b)`). Đây là invariant bắt buộc của hash table. Nếu bạn override `__eq__` mà không override `__hash__`, Python tự set `__hash__ = None` để prevent violation của invariant này — object không còn hashable, không thể cho vào `set` hay dùng làm `dict` key. Giải pháp: luôn định nghĩa cả hai, dùng các immutable fields để tính hash (tương tự Java: `Objects.hash(field1, field2)`). `@dataclass(frozen=True)` tự handle điều này.

</details>

<details>
<summary><strong>@classmethod và @staticmethod khác nhau thế nào so với Java?</strong></summary>

**A:** `@classmethod` nhận `cls` (class itself) làm tham số đầu — cho phép access class attributes và tạo instance, thường dùng làm alternative constructor (`User.from_email(email)`). `@staticmethod` không nhận `self` hay `cls` — là pure function được đặt trong class namespace cho logical grouping. Trong Java, cả hai đều là `static method`, nhưng không có sự phân biệt rõ ràng. Python `@classmethod` hữu ích hơn vì khi subclass override, `cls` trỏ đến subclass (polymorphism), còn Java static method không polymorphic.

</details>
