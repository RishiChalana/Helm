"""
PDF bank statement import service.
Extracts text with pdfplumber, parses transactions via one-shot LLM call,
detects duplicates against existing transactions, and bulk-creates approved ones.
"""
import io
import json
import re
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction, TransactionType
from app.schemas.statement import (
    ApprovedCandidate,
    StatementConfirmResponse,
    TransactionCandidate,
)

_EXTRACTION_PROMPT = """\
Extract all financial transactions from the bank statement text below.
Return a valid JSON array. Each element must have exactly these fields:
  "date": ISO date string YYYY-MM-DD (required)
  "description": merchant or transaction description (string, required)
  "amount": positive number (required)
  "type": "debit" for money-out/expense, "credit" for money-in/income (required)
  "category": best-fit from: Food, Transport, Entertainment, Shopping, Utilities, Health, Housing, Salary, Transfer, Other

Return ONLY the JSON array — no markdown code fences, no explanation, no surrounding text.
If the year is ambiguous, use the most recent plausible year.

Bank statement text:
"""

_STOP_WORDS = {"the", "a", "an", "in", "at", "on", "to", "for", "of", "and", "or", "by"}


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    import pdfplumber

    parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
    return "\n".join(parts)


async def _parse_with_llm(text: str) -> list[dict]:
    from langchain_groq import ChatGroq
    from app.core.config import get_settings

    settings = get_settings()
    llm = ChatGroq(model="openai/gpt-oss-120b", api_key=settings.groq_api_key)

    response = await llm.ainvoke([{"role": "user", "content": _EXTRACTION_PROMPT + text[:8000]}])
    content = response.content.strip()

    # Strip markdown code fence if present
    content = re.sub(r"^```(?:json)?\s*\n?", "", content, flags=re.MULTILINE)
    content = re.sub(r"\n?```$", "", content, flags=re.MULTILINE)

    return json.loads(content.strip())


def _word_tokens(s: str) -> set[str]:
    return {
        w.lower()
        for w in re.split(r"\W+", s)
        if len(w) > 2 and w.lower() not in _STOP_WORDS
    }


def _similar(a: str, b: str) -> bool:
    """True if the two strings share at least one significant word."""
    return bool(_word_tokens(a) & _word_tokens(b))


async def _check_duplicate(
    user_id: int,
    tx_date: date,
    amount: float,
    description: str,
    db: AsyncSession,
) -> tuple[bool, str | None]:
    amount_decimal = Decimal(str(round(amount, 2)))

    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= tx_date - timedelta(days=1),
                Transaction.transaction_date <= tx_date + timedelta(days=1),
                Transaction.amount == amount_decimal,
            )
        )
    )
    existing = result.scalars().all()

    if not existing:
        return False, None

    for t in existing:
        if _similar(description, t.merchant or "") or _similar(description, t.category):
            return True, f"Matches: {t.category} ₹{t.amount} on {t.transaction_date}"

    # Same date window + same amount, merchant differs — still flag
    t = existing[0]
    return True, f"Same date & amount: {t.category} ₹{t.amount} on {t.transaction_date}"


async def extract_and_analyze(
    user_id: int,
    file_bytes: bytes,
    db: AsyncSession,
) -> list[TransactionCandidate]:
    text = _extract_text_from_pdf(file_bytes)
    if not text.strip():
        raise ValueError(
            "No extractable text found in this PDF. "
            "Only text-based PDFs are supported (scanned images are not)."
        )

    raw = await _parse_with_llm(text)
    if not isinstance(raw, list):
        raise ValueError("LLM did not return a transaction list.")

    candidates: list[TransactionCandidate] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, dict):
            continue

        raw_date = str(item.get("date", ""))[:10]
        try:
            tx_date = date.fromisoformat(raw_date)
        except ValueError:
            tx_date = date.today()

        description = str(item.get("description") or "Unknown").strip()
        try:
            amount = float(item.get("amount", 0))
        except (TypeError, ValueError):
            continue
        if amount <= 0:
            continue

        tx_type = item.get("type", "debit")
        if tx_type not in ("debit", "credit"):
            tx_type = "debit"

        category = str(item.get("category") or "Other").strip()

        is_dup, dup_detail = await _check_duplicate(user_id, tx_date, amount, description, db)

        # Use first 3 words of description as merchant hint
        merchant = " ".join(description.split()[:3]) or None

        candidates.append(
            TransactionCandidate(
                idx=idx,
                transaction_date=tx_date.isoformat(),
                description=description,
                merchant=merchant,
                amount=round(amount, 2),
                type=tx_type,
                category=category,
                is_duplicate=is_dup,
                duplicate_detail=dup_detail,
            )
        )

    return candidates


async def create_approved_transactions(
    user_id: int,
    approved: list[ApprovedCandidate],
    db: AsyncSession,
) -> StatementConfirmResponse:
    created_ids: list[int] = []

    for item in approved:
        try:
            tx_date = date.fromisoformat(item.transaction_date[:10])
        except (ValueError, TypeError):
            tx_date = date.today()

        tx = Transaction(
            user_id=user_id,
            amount=Decimal(str(round(item.amount, 2))),
            type=TransactionType.expense if item.type == "debit" else TransactionType.income,
            category=item.category,
            merchant=item.merchant,
            note=None,
            transaction_date=tx_date,
        )
        db.add(tx)
        await db.flush()
        created_ids.append(tx.id)

    await db.commit()
    return StatementConfirmResponse(created=len(created_ids), transaction_ids=created_ids)
