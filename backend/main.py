from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import get_settings
from app.core.redis import close_redis
from app.api.routers import auth, transactions, budgets, agent, insights
from app.api.routers import reallocations
from app.api.routers import goals
from app.api.routers import statements
from app.api.routers import receipts

settings = get_settings()
scheduler = AsyncIOScheduler()
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.jobs.insight_job import run_daily_insights

    scheduler.add_job(run_daily_insights, CronTrigger(hour=8, minute=0), id="daily_insights")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)
    await close_redis()


app = FastAPI(
    title="Helm — AI Finance Copilot",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.environment == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(budgets.router, prefix="/api/v1")
app.include_router(agent.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
app.include_router(reallocations.router, prefix="/api/v1")
app.include_router(goals.router, prefix="/api/v1")
app.include_router(statements.router, prefix="/api/v1")
app.include_router(receipts.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
