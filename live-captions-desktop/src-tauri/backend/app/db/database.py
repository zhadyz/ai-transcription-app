"""
Database connection and session management.
Supports both SQLite (development) and PostgreSQL (production).
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from typing import Generator
import logging
from contextlib import contextmanager
from app.config import settings

logger = logging.getLogger(__name__)


# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================

# Determine database URL based on environment
if settings.ENV == "production" and hasattr(settings, 'DATABASE_URL'):
    DATABASE_URL = settings.DATABASE_URL
else:
    # Development: Use SQLite
    DATABASE_URL = "sqlite:///./db/auth.db"
    logger.info(f"Using SQLite database: {DATABASE_URL}")


# ============================================================================
# ENGINE CONFIGURATION
# ============================================================================

# Create engine based on database type
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # SQLite specific
        poolclass=StaticPool,  # For SQLite in-memory or single connection
        echo=settings.IS_DEVELOPMENT,  # Log SQL in development
    )

    # Enable foreign keys for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

else:
    # PostgreSQL or other databases
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=10,  # Connection pool size
        max_overflow=20,  # Max connections beyond pool_size
        echo=settings.IS_DEVELOPMENT,
    )


# ============================================================================
# SESSION FACTORY
# ============================================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# ============================================================================
# DATABASE DEPENDENCY
# ============================================================================

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database sessions.

    Usage:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """
    Context manager for database sessions (non-FastAPI usage).

    Usage:
        with get_db_context() as db:
            user = db.query(User).filter_by(email="test@example.com").first()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def init_database():
    """
    Initialize database schema.
    Creates all tables if they don't exist.
    """
    from app.db.models import Base

    logger.info("Initializing database...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}", exc_info=True)
        raise


def reset_database():
    """
    Reset database (DROP and CREATE all tables).
    USE WITH CAUTION - destroys all data!
    """
    from app.db.models import Base

    logger.warning("Resetting database - ALL DATA WILL BE LOST!")
    try:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        logger.info("Database reset successfully")
    except Exception as e:
        logger.error(f"Database reset failed: {e}", exc_info=True)
        raise


# ============================================================================
# HEALTH CHECK
# ============================================================================

def check_database_connection() -> bool:
    """
    Check if database connection is healthy.
    Returns True if connection is working, False otherwise.
    """
    try:
        with get_db_context() as db:
            db.execute("SELECT 1")
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False
