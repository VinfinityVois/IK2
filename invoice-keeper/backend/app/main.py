from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import settings
from app.core.database import Base, engine, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User


async def create_admin_if_not_exists():
    """Создаёт администратора из .env при первом запуске."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.username == settings.ADMIN_USERNAME)
        )
        admin = result.scalar_one_or_none()
        if not admin:
            admin = User(
                username=settings.ADMIN_USERNAME,
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            print(f"✅ Admin user '{settings.ADMIN_USERNAME}' created")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await create_admin_if_not_exists()
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Роутеры =====
from app.api.v1 import auth, users, recurring_payments, payment_occurrences, payments

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(recurring_payments.router, prefix=settings.API_V1_PREFIX)
app.include_router(payment_occurrences.router, prefix=settings.API_V1_PREFIX)
app.include_router(payments.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": f"{settings.API_V1_PREFIX}/docs",
    }