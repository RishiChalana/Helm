# Helm — AI Finance Copilot

## Phase 1 setup

### Backend

```bash
cd backend

# 1. Create and activate a virtual environment
python -m venv .venv && source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, ANTHROPIC_API_KEY, and a random SECRET_KEY

# 4. Run Postgres locally (or set DATABASE_URL to a hosted instance)
#    Example with Docker:
#    docker run -d --name helm-pg -e POSTGRES_DB=helm_db -e POSTGRES_USER=helm -e POSTGRES_PASSWORD=helm -p 5432:5432 postgres:16

# 5. Generate and apply the initial Alembic migration
alembic revision --autogenerate -m "initial"
alembic upgrade head

# 6. Start the server
uvicorn main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs

### Mobile

```bash
cd mobile
npm install

# Set the backend URL
# Create mobile/.env:  EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
#   (use your machine's LAN IP, not localhost, when running on a physical device)

npx expo start
# Then press 'a' for Android emulator, 'i' for iOS simulator, or scan QR code with Expo Go
```

## Architecture

See `docs/adr/` for key design decisions:
- `001` — Agent tool isolation (no raw SQL from LLM)
- `002` — Refresh token rotation with reuse detection
- `003` — Materiality filter to prevent notification fatigue

## Phase 1 feature checklist

- [x] JWT auth + refresh token rotation
- [x] Biometric gate on app open
- [x] Transactions CRUD
- [x] Budgets CRUD + real-time pace tracking
- [x] LangGraph agent with 4 tools (get_transactions, get_budget_status, simulate_scenario, forecast_cashflow)
- [x] Multi-turn conversation memory (persisted per user)
- [x] Daily insight job (APScheduler) with materiality filter
- [x] Expo push notifications
- [x] Scenario simulator UI (slider-driven, instant recalculation)
- [x] Insights feed with unread indicators
- [x] Rate-limited auth endpoints
- [x] Audit log for every agent action
