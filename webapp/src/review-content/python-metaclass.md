---
key: python-metaclass
title: Python Metaclass, ABC & Protocol
crumb: 14. Python > Python Internals
---

Metaclass là "class của class" — kiểm soát cách class được tạo ra, cho phép modify class definition tại định nghĩa time; Abstract Base Class (ABC) và Protocol cung cấp interface contract tương tự Java interface/abstract class.

## Điểm Chính

- **type là metaclass mặc định**: mọi class trong Python đều là instance của `type` — `type("MyClass", (Base,), {"method": fn})`
- **__new__ vs __init__**: `__new__` tạo instance mới (allocate memory), `__init__` khởi tạo instance đã tạo; metaclass override `__new__` của class itself
- **Custom metaclass**: override `__new__` hoặc `__init__` của metaclass để modify class at creation time — dùng trong ORM (SQLAlchemy), API framework (Django models)
- **ABC (Abstract Base Class)**: `abc.ABCMeta` + `@abstractmethod` — enforce implementation của abstract method, raise `TypeError` khi instantiate nếu chưa implement
- **Protocol (PEP 544)**: structural subtyping — duck typing với static check; không cần kế thừa, chỉ cần implement đúng interface
- **ABC vs Protocol**: ABC dùng inheritance (nominal typing), Protocol dùng structural typing (duck typing với type checker support)
- **Use cases metaclass**: singleton, ORM model registration, auto-register subclasses, enforce naming conventions

## Ví Dụ Code

*Metaclass, __new__ vs __init__, ABC và Protocol với use cases thực tế*

```python
from __future__ import annotations
import abc
from typing import Protocol, runtime_checkable

# ── type: metaclass mặc định ────────────────────────────────
# Tạo class động với type() — ít dùng trực tiếp nhưng hiểu nguyên lý
def greet(self) -> str:
    return f"Hello from {self.__class__.__name__}"

DynamicClass = type("DynamicClass", (object,), {"greet": greet})
obj = DynamicClass()
print(obj.greet())   # "Hello from DynamicClass"
print(type(DynamicClass))  # <class 'type'>

# ── __new__ vs __init__ ─────────────────────────────────────
class Singleton:
    """__new__ kiểm soát việc TẠO instance — chỉ tạo một lần"""
    _instance: Singleton | None = None

    def __new__(cls) -> "Singleton":
        if cls._instance is None:
            cls._instance = super().__new__(cls)  # allocate memory
        return cls._instance

    def __init__(self) -> None:
        # __init__ LUÔN được gọi sau __new__, kể cả khi trả về instance cũ
        # → cần guard nếu không muốn re-initialize
        if not hasattr(self, "_initialized"):
            self.value = 0
            self._initialized = True

s1 = Singleton()
s2 = Singleton()
print(s1 is s2)  # True — cùng instance

# ── Custom Metaclass ────────────────────────────────────────
class RegistryMeta(type):
    """Metaclass tự động đăng ký subclass vào registry"""
    _registry: dict[str, type] = {}

    def __new__(mcs, name: str, bases: tuple, namespace: dict) -> type:
        cls = super().__new__(mcs, name, bases, namespace)
        if bases:  # không đăng ký base class chính
            mcs._registry[name] = cls
        return cls

class Plugin(metaclass=RegistryMeta):
    """Base class — tất cả subclass được auto-register"""
    def execute(self) -> None: ...

class EmailPlugin(Plugin):
    def execute(self) -> None:
        print("Sending email")

class SlackPlugin(Plugin):
    def execute(self) -> None:
        print("Sending Slack message")

# Auto-registered without any manual registration
print(RegistryMeta._registry)
# {"EmailPlugin": <class EmailPlugin>, "SlackPlugin": <class SlackPlugin>}

# ── Abstract Base Class (ABC) ───────────────────────────────
class Repository(abc.ABC):
    """Interface contract — phải implement tất cả abstract methods"""

    @abc.abstractmethod
    def find_by_id(self, entity_id: int) -> dict | None: ...

    @abc.abstractmethod
    def save(self, entity: dict) -> dict: ...

    def find_or_raise(self, entity_id: int) -> dict:
        """Concrete method dùng được trong subclass"""
        result = self.find_by_id(entity_id)
        if result is None:
            raise ValueError(f"Entity {entity_id} not found")
        return result

class UserRepository(Repository):
    def find_by_id(self, entity_id: int) -> dict | None:
        return {"id": entity_id, "name": "Alice"}

    def save(self, entity: dict) -> dict:
        return {**entity, "id": 1}

# Repository()  # TypeError: Can't instantiate abstract class
user_repo = UserRepository()  # OK — tất cả abstract methods đã implement

# ── Protocol — Structural Typing (Duck Typing + Type Check) ─
@runtime_checkable  # cho phép isinstance() check tại runtime
class Closeable(Protocol):
    """Bất kỳ class nào có close() method đều thỏa Protocol này"""
    def close(self) -> None: ...

class FileHandler:
    def close(self) -> None:
        print("Closing file")

class DBConnection:
    def close(self) -> None:
        print("Closing DB connection")

def cleanup(resource: Closeable) -> None:
    resource.close()

# Không cần kế thừa Closeable — duck typing với type safety
cleanup(FileHandler())   # OK
cleanup(DBConnection())  # OK

# runtime_checkable cho phép isinstance
print(isinstance(FileHandler(), Closeable))  # True
```

## Ứng Dụng Thực Tế

Django ORM dùng metaclass (`ModelBase`) để scan `Field` descriptors trong class body và setup database schema mapping tại class creation time. SQLAlchemy dùng metaclass tương tự. FastAPI dùng Pydantic models với metaclass để build JSON schema tự động. `abc.ABC` phổ biến khi định nghĩa repository interface, service interface trong clean architecture.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Metaclass là gì? Khi nào cần dùng metaclass?</strong></summary>

**A:** Metaclass là class của class — nó kiểm soát cách class được tạo ra, tương tự class kiểm soát cách instance được tạo. `type` là metaclass mặc định: khi Python thấy `class Foo:`, nó gọi `type("Foo", (object,), {...})`. Custom metaclass override `__new__` hoặc `__init__` của metaclass để can thiệp vào class creation. Use cases thực tế: (1) auto-register subclasses (plugin system, Django model registry), (2) enforce class conventions (kiểm tra naming, required methods), (3) ORM field setup (SQLAlchemy, Django). Lưu ý: metaclass là advanced feature, 99% case có thể dùng class decorator hoặc `__init_subclass__` thay thế và đơn giản hơn nhiều.

</details>

<details>
<summary><strong>__new__ và __init__ khác nhau thế nào?</strong></summary>

**A:** `__new__(cls)` là static method tạo và trả về instance mới (allocate memory) — được gọi trước `__init__`. `__init__(self)` nhận instance đã tạo và initialize nó (set attributes). Thứ tự: `__new__` → nếu trả về instance của cls → Python gọi `__init__`. Override `__new__` khi cần kiểm soát việc tạo object: Singleton (trả về cùng instance), immutable types như `int`/`str`/`tuple` (vì `__init__` không thể modify immutable object sau khi tạo), hoặc metaclass. Trong Java, constructor tương đương với cả `__new__` + `__init__` gộp lại.

</details>

<details>
<summary><strong>ABC và Protocol khác nhau thế nào? Khi nào dùng cái nào?</strong></summary>

**A:** `ABC` (Abstract Base Class) dùng nominal typing — subclass phải `class Foo(ABC)` và implement `@abstractmethod`. Tại runtime, Python enforce điều này. `Protocol` dùng structural typing — bất kỳ class nào implement đúng methods/attributes là thỏa protocol, không cần kế thừa (duck typing với type checker). Dùng `ABC` khi: muốn enforce inheritance hierarchy, cần share concrete implementation từ base, muốn runtime check với `isinstance`. Dùng `Protocol` khi: muốn work với existing classes không thể modify (third-party library), prefer loose coupling, hoặc muốn multiple protocols được thỏa mãn mà không cần multiple inheritance. Python 3.8+ `Protocol` là cách Pythonic hơn cho "interface" contract.

</details>
