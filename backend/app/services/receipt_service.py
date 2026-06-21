"""
Receipt image scanning service.
Sends a receipt image to Gemini Flash (vision) for one-shot extraction,
detects duplicates against existing transactions, and returns candidates.
Confirm step reuses statement_service.create_approved_transactions.
"""
import json
import logging
import re
from datetime import date

log = logging.getLogger(__name__)

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.statement import TransactionCandidate
from app.services.statement_service import _check_duplicate

_RECEIPT_PROMPT = """\
Look at this receipt image and extract the financial transaction(s).
Return a valid JSON array. Each element must have exactly these fields:
  "date": ISO date string YYYY-MM-DD — use the date printed on the receipt; if absent, use today's date
  "description": merchant name or item description (string, required)
  "amount": positive number — the total charged (required)
  "type": "debit" for a purchase/expense, "credit" for a refund
  "category": best-fit from: Food, Transport, Entertainment, Shopping, Utilities, Health, Housing, Salary, Transfer, Other

For a single-merchant receipt, return one element with the grand total.
For itemized receipts, return one element per distinct line item (skip tax lines and the grand total row).
Return ONLY the JSON array — no markdown fences, no explanation.
"""


async def _extract_with_gemini(image_bytes: bytes, mime_type: str) -> list[dict]:
    from google import genai
    from google.genai import types
    from app.core.config import get_settings

    settings = get_settings()
    client = genai.Client(api_key=settings.google_api_key)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            types.Part.from_text(text=_RECEIPT_PROMPT),
        ],
    )
    content = response.text.strip()
    log.info("[receipt] raw Gemini response: %r", content[:400])

    content = re.sub(r"^```(?:json)?\s*\n?", "", content, flags=re.MULTILINE)
    content = re.sub(r"\n?```$", "", content, flags=re.MULTILINE)
    return json.loads(content.strip())


async def analyze_receipt(
    user_id: int,
    image_bytes: bytes,
    mime_type: str,
    db: AsyncSession,
) -> list[TransactionCandidate]:
    raw = await _extract_with_gemini(image_bytes, mime_type)
    if not isinstance(raw, list):
        raise ValueError("Gemini did not return a transaction list.")

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
