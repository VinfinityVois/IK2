"""Open Banking demo module for Invoice Keeper (sandbox data only)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Optional
import hashlib

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text,
    UniqueConstraint, select, func,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, get_db
from app.core.deps import get_current_user
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.user import User

router = APIRouter(prefix="/open-banking", tags=["open-banking-demo"])


class BankAccount(Base):
    __tablename__ = "ob_demo_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(80), default="Invoice Keeper PSD2 Sandbox")
    institution_name: Mapped[str] = mapped_column(String(120))
    account_name: Mapped[str] = mapped_column(String(120))
    iban_masked: Mapped[str] = mapped_column(String(40))
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    status: Mapped[str] = mapped_column(String(20), default="connected")
    consent_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    transactions: Mapped[list["BankTransaction"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class BankTransaction(Base):
    __tablename__ = "ob_demo_transactions"
    __table_args__ = (UniqueConstraint("owner_id", "external_id", name="uq_ob_demo_owner_external"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("ob_demo_accounts.id", ondelete="CASCADE"), index=True)
    external_id: Mapped[str] = mapped_column(String(100))
    booked_at: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3))
    direction: Mapped[str] = mapped_column(String(8))
    counterparty: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(20), default="booked")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    account: Mapped[BankAccount] = relationship(back_populates="transactions")
    match: Mapped[Optional["TransactionMatch"]] = relationship(back_populates="transaction", uselist=False, cascade="all, delete-orphan")


class TransactionMatch(Base):
    __tablename__ = "ob_demo_matches"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("ob_demo_transactions.id", ondelete="CASCADE"), unique=True)
    occurrence_id: Mapped[int] = mapped_column(ForeignKey("payment_occurrences.id", ondelete="CASCADE"), index=True)
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="suggested")
    reason: Mapped[str] = mapped_column(String(240), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    transaction: Mapped[BankTransaction] = relationship(back_populates="match")


class BankingNotification(Base):
    __tablename__ = "ob_demo_notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(160))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MatchConfirm(BaseModel):
    mark_paid: bool = True


def _owner_filter(query, current_user: User, owner_col):
    if current_user.role != "admin":
        return query.where(owner_col == current_user.id)
    return query


async def _notify(db: AsyncSession, owner_id: int, kind: str, title: str, message: str) -> None:
    db.add(BankingNotification(owner_id=owner_id, kind=kind, title=title, message=message))


def _account_json(a: BankAccount) -> dict:
    return {
        "id": a.id, "provider": a.provider, "institution_name": a.institution_name,
        "account_name": a.account_name, "iban_masked": a.iban_masked,
        "currency": a.currency, "balance": str(a.balance), "status": a.status,
        "consent_expires_at": a.consent_expires_at.isoformat(),
    }


def _transaction_json(t: BankTransaction, match: Optional[TransactionMatch] = None) -> dict:
    return {
        "id": t.id, "account_id": t.account_id, "external_id": t.external_id,
        "booked_at": t.booked_at.isoformat(), "amount": str(t.amount),
        "currency": t.currency, "direction": t.direction,
        "counterparty": t.counterparty, "description": t.description,
        "status": t.status,
        "match": None if not match else {
            "id": match.id, "occurrence_id": match.occurrence_id,
            "confidence": match.confidence, "status": match.status, "reason": match.reason,
        },
    }


async def _seed_demo(db: AsyncSession, owner_id: int) -> dict:
    accounts_result = await db.execute(select(BankAccount).where(BankAccount.owner_id == owner_id))
    accounts = list(accounts_result.scalars().all())
    if not accounts:
        now = datetime.now(timezone.utc)
        accounts = [
            BankAccount(owner_id=owner_id, institution_name="Demo Bank Europe",
                        account_name="Main EUR account", iban_masked="DE•• •••• •••• •••• 4821",
                        currency="EUR", balance=Decimal("4280.50"), status="connected",
                        consent_expires_at=now + timedelta(days=90)),
            BankAccount(owner_id=owner_id, institution_name="Demo Bank Europe",
                        account_name="Business EUR account", iban_masked="NL•• •••• •••• •••• 1093",
                        currency="EUR", balance=Decimal("12750.00"), status="connected",
                        consent_expires_at=now + timedelta(days=90)),
        ]
        db.add_all(accounts)
        await db.flush()
        today = date.today()
        rows = [
            ("DEMO-001", today - timedelta(days=1), "89.99", "debit", "Streamline Media", "Monthly subscription"),
            ("DEMO-002", today - timedelta(days=2), "1250.00", "debit", "Northstar Hosting", "Cloud server invoice"),
            ("DEMO-003", today - timedelta(days=3), "740.00", "debit", "City Utilities", "Electricity and utilities"),
            ("DEMO-004", today - timedelta(days=4), "3250.00", "credit", "Acme GmbH", "Customer payment"),
            ("DEMO-005", today - timedelta(days=5), "24.50", "debit", "Office Supply EU", "Office supplies"),
            ("DEMO-006", today - timedelta(days=6), "49.00", "debit", "Design Tools", "Monthly design subscription"),
            ("DEMO-007", today - timedelta(days=7), "120.00", "debit", "Northstar Hosting", "Additional storage"),
        ]
        for idx, (external_id, booked_at, amount, direction, counterparty, description) in enumerate(rows):
            db.add(BankTransaction(owner_id=owner_id, account_id=accounts[idx % len(accounts)].id,
                external_id=external_id, booked_at=booked_at, amount=Decimal(amount), currency="EUR",
                direction=direction, counterparty=counterparty, description=description, status="booked"))

        # Add one safe, deterministic sample transaction matching an existing unpaid EUR occurrence,
        # if available. This lets users try the review/confirm flow without inventing a real payment.
        occurrence_query = (
            select(PaymentOccurrence)
            .join(RecurringPayment, PaymentOccurrence.recurring_payment_id == RecurringPayment.id)
            .where(RecurringPayment.owner_id == owner_id, RecurringPayment.currency == "EUR",
                   PaymentOccurrence.is_paid.is_(False))
            .order_by(PaymentOccurrence.due_date.asc())
        )
        candidate = (await db.execute(occurrence_query)).scalars().first()
        if candidate is not None:
            payment_result = await db.execute(select(RecurringPayment).where(
                RecurringPayment.id == candidate.recurring_payment_id))
            payment = payment_result.scalar_one_or_none()
            if payment is not None:
                db.add(BankTransaction(owner_id=owner_id, account_id=accounts[0].id,
                    external_id=f"DEMO-MATCH-{candidate.id}", booked_at=candidate.due_date,
                    amount=Decimal(str(payment.amount)), currency=payment.currency, direction="debit",
                    counterparty=payment.name, description=f"Demo match for {payment.name}", status="booked"))

        await _notify(db, owner_id, "demo_connected", "Демо-банк подключён",
                      "Созданы тестовые счета и транзакции. Это не реальные банковские данные.")
        await db.flush()
    await db.commit()
    return {"accounts_created": len(accounts), "demo_mode": True}


@router.get("/overview")
async def overview(db: Annotated[AsyncSession, Depends(get_db)],
                   current_user: Annotated[User, Depends(get_current_user)]):
    accounts_q = _owner_filter(select(BankAccount), current_user, BankAccount.owner_id)
    tx_q = _owner_filter(select(BankTransaction), current_user, BankTransaction.owner_id)
    match_q = _owner_filter(select(TransactionMatch), current_user, TransactionMatch.owner_id)
    notification_q = _owner_filter(select(BankingNotification).where(BankingNotification.is_read.is_(False)),
                                   current_user, BankingNotification.owner_id)
    accounts = list((await db.execute(accounts_q)).scalars().all())
    transactions = list((await db.execute(tx_q)).scalars().all())
    matches = list((await db.execute(match_q)).scalars().all())
    notifications = list((await db.execute(notification_q)).scalars().all())
    return {
        "mode": "demo", "provider": "Invoice Keeper PSD2 Sandbox",
        "accounts_count": len(accounts), "transactions_count": len(transactions),
        "suggested_matches": sum(1 for m in matches if m.status == "suggested"),
        "confirmed_matches": sum(1 for m in matches if m.status == "confirmed"),
        "unread_notifications": len(notifications),
        "notice": "Sandbox only: no real bank connection, payment initiation, or live balances.",
    }


@router.post("/demo/connect")
async def connect_demo(db: Annotated[AsyncSession, Depends(get_db)],
                       current_user: Annotated[User, Depends(get_current_user)]):
    result = await _seed_demo(db, current_user.id)
    return {"status": "connected", **result,
            "message": "Демо-счета и транзакции доступны. Реальные PSD2 consent-процессы не используются."}


@router.post("/demo/sync")
async def sync_demo(db: Annotated[AsyncSession, Depends(get_db)],
                    current_user: Annotated[User, Depends(get_current_user)]):
    await _seed_demo(db, current_user.id)
    result = await db.execute(select(BankTransaction).where(BankTransaction.owner_id == current_user.id))
    existing = list(result.scalars().all())
    fingerprint = hashlib.sha256(f"{current_user.id}:{date.today().isoformat()}".encode()).hexdigest()[:12]
    external_id = f"SYNC-{fingerprint}"
    found = await db.execute(select(BankTransaction).where(
        BankTransaction.owner_id == current_user.id, BankTransaction.external_id == external_id))
    if found.scalar_one_or_none() is None:
        account = (await db.execute(select(BankAccount).where(BankAccount.owner_id == current_user.id))).scalars().first()
        if account:
            tx = BankTransaction(owner_id=current_user.id, account_id=account.id, external_id=external_id,
                booked_at=date.today(), amount=Decimal("18.90"), currency=account.currency,
                direction="debit", counterparty="Demo Sync Merchant",
                description="New sandbox transaction from manual sync", status="booked")
            db.add(tx)
            await _notify(db, current_user.id, "transaction_imported", "Импортирована транзакция",
                          "Добавлена новая тестовая транзакция на 18,90 EUR.")
            await db.commit()
    return {"status": "synced", "transactions_seen": len(existing) + 1, "demo_mode": True}


@router.get("/accounts")
async def list_accounts(db: Annotated[AsyncSession, Depends(get_db)],
                        current_user: Annotated[User, Depends(get_current_user)]):
    q = _owner_filter(select(BankAccount).order_by(BankAccount.id), current_user, BankAccount.owner_id)
    return {"items": [_account_json(x) for x in (await db.execute(q)).scalars().all()]}


@router.get("/transactions")
async def list_transactions(db: Annotated[AsyncSession, Depends(get_db)],
                            current_user: Annotated[User, Depends(get_current_user)],
                            direction: Optional[str] = None, limit: int = 100):
    if direction and direction not in {"debit", "credit"}:
        raise HTTPException(status_code=422, detail="direction must be debit or credit")
    q = select(BankTransaction).order_by(BankTransaction.booked_at.desc(), BankTransaction.id.desc()).limit(
        min(max(limit, 1), 250))
    q = _owner_filter(q, current_user, BankTransaction.owner_id)
    if direction:
        q = q.where(BankTransaction.direction == direction)
    rows = list((await db.execute(q)).scalars().all())
    result = []
    for tx in rows:
        match_result = await db.execute(select(TransactionMatch).where(TransactionMatch.transaction_id == tx.id))
        result.append(_transaction_json(tx, match_result.scalar_one_or_none()))
    return {"items": result}


@router.get("/notifications")
async def list_notifications(db: Annotated[AsyncSession, Depends(get_db)],
                             current_user: Annotated[User, Depends(get_current_user)]):
    q = _owner_filter(select(BankingNotification).order_by(BankingNotification.created_at.desc()).limit(100),
                      current_user, BankingNotification.owner_id)
    rows = (await db.execute(q)).scalars().all()
    return {"items": [{"id": n.id, "kind": n.kind, "title": n.title, "message": n.message,
                       "is_read": n.is_read, "created_at": n.created_at.isoformat()} for n in rows]}


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, db: Annotated[AsyncSession, Depends(get_db)],
                                 current_user: Annotated[User, Depends(get_current_user)]):
    q = select(BankingNotification).where(BankingNotification.id == notification_id)
    q = _owner_filter(q, current_user, BankingNotification.owner_id)
    row = (await db.execute(q)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.is_read = True
    await db.commit()
    return {"status": "read"}


@router.post("/match/auto")
async def auto_match(db: Annotated[AsyncSession, Depends(get_db)],
                     current_user: Annotated[User, Depends(get_current_user)]):
    tx_q = _owner_filter(select(BankTransaction).where(BankTransaction.direction == "debit"),
                         current_user, BankTransaction.owner_id)
    transactions = list((await db.execute(tx_q.order_by(BankTransaction.booked_at.desc()))).scalars().all())
    occurrences_q = select(PaymentOccurrence).options()
    if current_user.role != "admin":
        occurrences_q = occurrences_q.join(RecurringPayment,
            PaymentOccurrence.recurring_payment_id == RecurringPayment.id).where(
                RecurringPayment.owner_id == current_user.id)
    occurrences = list((await db.execute(occurrences_q)).scalars().all())
    created = 0
    for tx in transactions:
        existing = await db.execute(select(TransactionMatch).where(TransactionMatch.transaction_id == tx.id))
        if existing.scalar_one_or_none():
            continue
        candidates = []
        for occ in occurrences:
            if occ.is_paid:
                continue
            payment_result = await db.execute(select(RecurringPayment).where(
                RecurringPayment.id == occ.recurring_payment_id))
            payment = payment_result.scalar_one_or_none()
            if not payment or payment.currency != tx.currency:
                continue
            expected = Decimal(str(payment.amount))
            actual = Decimal(str(tx.amount))
            if expected != actual:
                continue
            delta = abs((occ.due_date - tx.booked_at).days)
            if delta > 14:
                continue
            name_tokens = {x.lower() for x in payment.name.replace("-", " ").split() if len(x) > 3}
            tx_text = f"{tx.counterparty} {tx.description}".lower()
            text_hit = any(token in tx_text for token in name_tokens)
            confidence = min(99, 75 + (15 if text_hit else 0) + max(0, 9 - delta))
            candidates.append((confidence, occ, f"Сумма и валюта совпали; дата отличается на {delta} дн." +
                               ("; найдено совпадение по названию." if text_hit else "")))
        if not candidates:
            continue
        candidates.sort(key=lambda x: x[0], reverse=True)
        confidence, occ, reason = candidates[0]
        db.add(TransactionMatch(owner_id=current_user.id, transaction_id=tx.id,
            occurrence_id=occ.id, confidence=confidence, status="suggested", reason=reason))
        await _notify(db, current_user.id, "match_suggested", "Найдено совпадение платежа",
                      f"{tx.counterparty}: {tx.amount} {tx.currency}. Требуется подтверждение.")
        created += 1
    await db.commit()
    return {"created": created, "message": "Совпадения предложены; статус платежа не изменён автоматически."}


@router.get("/matches")
async def list_matches(db: Annotated[AsyncSession, Depends(get_db)],
                       current_user: Annotated[User, Depends(get_current_user)]):
    q = _owner_filter(select(TransactionMatch).order_by(TransactionMatch.created_at.desc()),
                      current_user, TransactionMatch.owner_id)
    matches = list((await db.execute(q)).scalars().all())
    items = []
    for m in matches:
        tx = (await db.execute(select(BankTransaction).where(BankTransaction.id == m.transaction_id))).scalar_one_or_none()
        occ = (await db.execute(select(PaymentOccurrence).where(PaymentOccurrence.id == m.occurrence_id))).scalar_one_or_none()
        payment = None
        if occ:
            payment = (await db.execute(select(RecurringPayment).where(
                RecurringPayment.id == occ.recurring_payment_id))).scalar_one_or_none()
        items.append({"id": m.id, "status": m.status, "confidence": m.confidence, "reason": m.reason,
            "transaction": _transaction_json(tx) if tx else None,
            "occurrence": None if not occ else {"id": occ.id, "name": payment.name if payment else "Payment",
                "amount": str(payment.amount) if payment else None, "currency": payment.currency if payment else None,
                "due_date": occ.due_date.isoformat(), "is_paid": occ.is_paid}})
    return {"items": items}


@router.post("/matches/{match_id}/confirm")
async def confirm_match(match_id: int, payload: MatchConfirm,
                        db: Annotated[AsyncSession, Depends(get_db)],
                        current_user: Annotated[User, Depends(get_current_user)]):
    q = _owner_filter(select(TransactionMatch).where(TransactionMatch.id == match_id),
                      current_user, TransactionMatch.owner_id)
    match = (await db.execute(q)).scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status == "confirmed":
        return {"status": "confirmed", "already_confirmed": True}
    tx = (await db.execute(select(BankTransaction).where(BankTransaction.id == match.transaction_id))).scalar_one()
    occ_q = select(PaymentOccurrence).where(PaymentOccurrence.id == match.occurrence_id)
    if current_user.role != "admin":
        occ_q = occ_q.join(RecurringPayment,
            PaymentOccurrence.recurring_payment_id == RecurringPayment.id).where(
                RecurringPayment.owner_id == current_user.id)
    occ = (await db.execute(occ_q)).scalar_one_or_none()
    if occ is None:
        raise HTTPException(status_code=404, detail="Payment occurrence not found")
    if payload.mark_paid:
        if tx.direction != "debit":
            raise HTTPException(status_code=400, detail="Only debit transactions can confirm a payment")
        if occ.is_paid:
            match.status = "confirmed"
        else:
            occ.is_paid = True
            occ.paid_at = tx.booked_at
            match.status = "confirmed"
    else:
        match.status = "dismissed"
    match.confirmed_at = datetime.now(timezone.utc)
    await _notify(db, current_user.id, "match_confirmed" if payload.mark_paid else "match_dismissed",
                  "Сверка подтверждена" if payload.mark_paid else "Совпадение отклонено",
                  f"Транзакция {tx.external_id}; платеж #{occ.id}.")
    await db.commit()
    return {"status": match.status, "occurrence_id": occ.id,
            "payment_marked_paid": bool(payload.mark_paid), "paid_at": occ.paid_at.isoformat() if occ.paid_at else None}
