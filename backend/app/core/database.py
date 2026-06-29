import ssl as _ssl

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings

settings = get_settings()

# asyncpg requires ssl=SSLContext, not the string "require".
# Never rely on URL params like ?ssl=require — asyncpg ignores or rejects them.
# Supavisor (Supabase's pooler) presents a self-signed chain that fails verify-full;
# use sslmode=require semantics: encrypt but don't verify the CA chain.
def _make_ssl_context() -> _ssl.SSLContext:
    ctx = _ssl.SSLContext(_ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = _ssl.CERT_NONE
    return ctx

_connect_args = {"ssl": _make_ssl_context()} if settings.db_ssl_required else {}

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
