import asyncio
import hashlib
import hmac
import json
import logging
import smtplib
import urllib.request
from datetime import date, datetime, timezone
from email.message import EmailMessage
from typing import Any

from app.core.config import settings

logger = logging.getLogger("invoice_keeper.events")


def _json_default(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _send_email(to_email: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM or settings.SMTP_USERNAME
    message["To"] = to_email
    message.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
        server.send_message(message)


def _send_webhook(payload: dict[str, Any]) -> None:
    if not settings.WEBHOOK_URL:
        return
    body = json.dumps(payload, ensure_ascii=False, default=_json_default).encode()
    req = urllib.request.Request(
        settings.WEBHOOK_URL, data=body,
        headers={"Content-Type": "application/json", "User-Agent": "Invoice-Keeper/1.1"},
        method="POST",
    )
    if settings.WEBHOOK_SECRET:
        signature = hmac.new(settings.WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        req.add_header("X-Invoice-Keeper-Signature", f"sha256={signature}")
    with urllib.request.urlopen(req, timeout=8) as response:
        if response.status >= 400:
            raise RuntimeError(f"Webhook HTTP {response.status}")


async def emit_event(event_type: str, *, occurrence_id: int, recurring_payment_id: int,
                     payment_name: str, amount: Any, currency: str, due_date: date,
                     is_paid: bool, paid_at: date | None, actor_id: int | None,
                     recipient_email: str | None = None, payment_url: str | None = None,
                     receipt_url: str | None = None) -> None:
    payload = {
        "event": event_type,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "occurrence": {
            "id": occurrence_id, "recurring_payment_id": recurring_payment_id,
            "name": payment_name, "amount": str(amount), "currency": currency,
            "due_date": due_date.isoformat(), "is_paid": is_paid,
            "paid_at": paid_at.isoformat() if paid_at else None,
            "payment_url": payment_url, "receipt_url": receipt_url,
        },
        "actor_id": actor_id,
    }
    logger.info("audit_event %s", json.dumps(payload, ensure_ascii=False, default=_json_default))
    if settings.WEBHOOK_URL:
        try:
            await asyncio.to_thread(_send_webhook, payload)
        except Exception:
            logger.exception("webhook_delivery_failed event=%s occurrence_id=%s", event_type, occurrence_id)
    if event_type == "payment.paid" and settings.SMTP_ENABLED and recipient_email:
        if not settings.SMTP_HOST or not (settings.SMTP_FROM or settings.SMTP_USERNAME):
            logger.warning("email_not_sent reason=smtp_not_configured occurrence_id=%s", occurrence_id)
            return
        body = (f"Платёж отмечен как оплаченный.\n\nПлатёж: {payment_name}\n"
                f"Сумма: {amount} {currency}\nСрок: {due_date.isoformat()}\n"
                f"Фактическая дата: {paid_at.isoformat() if paid_at else 'не указана'}\n")
        if payment_url:
            body += f"\nСсылка к оплате: {payment_url}\n"
        if receipt_url:
            body += f"\nКвитанция: {receipt_url}\n"
        try:
            await asyncio.to_thread(_send_email, recipient_email,
                                    f"Invoice Keeper: оплачено — {payment_name}", body)
            logger.info("email_sent event=%s occurrence_id=%s", event_type, occurrence_id)
        except Exception:
            logger.exception("email_delivery_failed occurrence_id=%s", occurrence_id)
