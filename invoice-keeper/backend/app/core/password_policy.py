import re

# Сложность пароля (базовая политика)
MIN_LEN = 8
MAX_LEN = 128


def validate_password(password: str) -> str | None:
    """Возвращает текст ошибки или None если ок."""
    if len(password) < MIN_LEN:
        return f"Пароль должен быть не короче {MIN_LEN} символов"
    if len(password) > MAX_LEN:
        return f"Пароль не длиннее {MAX_LEN} символов"
    if not re.search(r"[A-ZА-Я]", password):
        return "Нужна хотя бы одна заглавная буква"
    if not re.search(r"[a-zа-я]", password):
        return "Нужна хотя бы одна строчная буква"
    if not re.search(r"\d", password):
        return "Нужна хотя бы одна цифра"
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\",.<>/?\\|`~]", password):
        return "Нужен хотя бы один спецсимвол (!@#$%...)"
    # Простые словари
    lowered = password.lower()
    for bad in ("password", "12345678", "qwerty", "admin123", "iloveyou"):
        if bad in lowered:
            return "Пароль слишком простой"
    return None
