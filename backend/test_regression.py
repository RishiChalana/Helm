"""Run after all 6 fixes. Reports PASS/FAIL for each test case."""
import asyncio
import sys
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8000/api/v1"


def post(path: str, body: dict, token: str | None = None) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def get(path: str, token: str) -> dict | list:
    req = urllib.request.Request(f"{BASE}{path}")
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def check(label: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}" + (f" — {detail}" if detail else ""))


def main():
    print("── Auth ──────────────────────────────────")
    resp = post("/auth/login", {"email": "rishi@example.com", "password": "Helm1234!"})
    token = resp["access_token"]
    check("Login returns access_token", bool(token))

    print("\n── Fix 1: Relative date resolution ───────")
    r = post("/agent/chat", {"message": "How much did I spend this month?"}, token)
    reply = r.get("reply", "")
    print(f"  Reply: {reply[:120]}")
    check("No 'what date' question in reply", "date" not in reply.lower() or "₹" in reply, reply[:80])
    check("Contains ₹ amount", "₹" in reply, reply[:80])
    check("Does NOT ask user for dates", "what is" not in reply.lower() and "provide" not in reply.lower(), reply[:80])

    r2 = post("/agent/chat", {"message": "What did I spend last week?"}, token)
    reply2 = r2.get("reply", "")
    print(f"  Last-week reply: {reply2[:120]}")
    check("Last week resolved without asking", "₹" in reply2 or "nothing" in reply2.lower() or "no transactions" in reply2.lower(), reply2[:80])

    print("\n── Fix 2: Budget lookup by category ──────")
    r = post("/agent/chat", {"message": "What is my food budget status?"}, token)
    reply = r.get("reply", "")
    print(f"  Reply: {reply[:160]}")
    check("Contains ₹3,000 limit", "3,000" in reply or "3000" in reply, reply[:100])
    check("Contains ₹4,300 spent", "4,300" in reply or "4300" in reply, reply[:100])
    check("Did NOT ask for budget ID", "budget id" not in reply.lower() and "id?" not in reply.lower(), reply[:100])

    print("\n── Fix 3: Spending summary tool ──────────")
    r = post("/agent/chat", {"message": "Give me my spending breakdown this month"}, token)
    reply = r.get("reply", "")
    print(f"  Reply: {reply[:200]}")
    check("Contains ₹9,800 total", "9,800" in reply or "9800" in reply, reply[:100])
    check("Lists Food, Entertainment, Transport", all(c in reply for c in ["Food", "Entertainment", "Transport"]), reply[:150])

    print("\n── Fix 4: Currency formatting ────────────")
    r = post("/agent/chat", {"message": "What is my food budget limit?"}, token)
    reply = r.get("reply", "")
    print(f"  Reply: {reply[:120]}")
    check("Uses ₹ symbol", "₹" in reply, reply[:80])
    check("No $ sign", "$" not in reply, reply[:80])

    print("\n── Fix 5: Budget API schema ──────────────")
    budgets = get("/budgets", token)
    b = budgets[0]
    print(f"  Budget: {b}")
    check("limit_amount is float not string", isinstance(b["limit_amount"], float), str(type(b["limit_amount"])))
    check("period field present", "period" in b, str(b.keys()))
    check("period_month/period_year gone", "period_month" not in b and "period_year" not in b, str(b.keys()))
    check("period == 'monthly'", b["period"] == "monthly", b.get("period"))
    check("period_start == '2026-06-01'", b["period_start"] == "2026-06-01", b.get("period_start"))

    status = get("/budgets/1/status", token)
    print(f"  Status: {status}")
    check("spent is float", isinstance(status["spent"], float), str(type(status["spent"])))
    check("spent == 4300.0", status["spent"] == 4300.0, str(status["spent"]))
    check("is_over_budget is True", status["is_over_budget"] is True, str(status["is_over_budget"]))

    print("\n── Fix 6: Insight pipeline ───────────────")
    insights = get("/insights", token)
    print(f"  Insights in DB: {len(insights)}")
    check("At least 1 insight exists", len(insights) >= 1, str(len(insights)))
    if insights:
        i = insights[0]
        print(f"  Latest insight: {i['title']}")
        check("Insight category == Food", i["category"] == "Food", i["category"])
        check("Contains ₹ in body", "₹" in i["body"], i["body"][:80])

    print("\n── Multi-tool chain ──────────────────────")
    r = post("/agent/chat", {
        "message": "Full summary: how much spent this month total, my food budget status, and 30-day cashflow forecast"
    }, token)
    reply = r.get("reply", "")
    print(f"  Reply:\n{reply}")
    check("Contains total spend ₹9,800", "9,800" in reply or "9800" in reply, "")
    check("Contains food budget info", "food" in reply.lower() or "Food" in reply, "")
    check("Contains cashflow/forecast info", any(w in reply.lower() for w in ["cashflow", "forecast", "projected", "income"]), "")


if __name__ == "__main__":
    main()
