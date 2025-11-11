"""
Database initialization for API v2.
Creates tables for API keys, tasks, usage tracking, and webhooks.
"""

import sys
from pathlib import Path
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from app.config import settings
from app.db.models import Base as BaseV1  # Original auth models
from app.db.models_v2 import Base as BaseV2  # API v2 models
from app.services.auth_service import hash_password

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_database(reset: bool = False, seed: bool = False):
    """
    Initialize database with both v1 (auth) and v2 (API) tables.

    Args:
        reset: Drop all tables and recreate
        seed: Create test data
    """
    logger.info(f"Initializing database: {settings.DATABASE_URL}")

    # Create engine
    engine = create_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_pre_ping=True
    )

    # Check if tables exist
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if reset and existing_tables:
        logger.warning("⚠️  Dropping all existing tables...")
        BaseV2.metadata.drop_all(bind=engine)
        BaseV1.metadata.drop_all(bind=engine)
        logger.info("✓ All tables dropped")

    # Create all tables
    logger.info("Creating v1 tables (auth system)...")
    BaseV1.metadata.create_all(bind=engine)
    logger.info("✓ V1 tables created")

    logger.info("Creating v2 tables (API system)...")
    BaseV2.metadata.create_all(bind=engine)
    logger.info("✓ V2 tables created")

    # List created tables
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    logger.info(f"✓ Database initialized with {len(tables)} tables:")
    for table in sorted(tables):
        logger.info(f"  - {table}")

    # Seed test data
    if seed:
        logger.info("\nSeeding test data...")
        seed_test_data(engine)

    logger.info("\n✓ Database initialization complete!")


def seed_test_data(engine):
    """Create test users and API keys"""
    from app.db.models import User
    from app.db.models_v2 import APIKey
    from app.services.api_key_service import api_key_service
    from datetime import datetime
    import secrets

    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Create test users (if they don't exist)
        test_users = [
            {
                "email": "admin@example.com",
                "password": "Admin123!@#",
                "full_name": "Admin User",
                "role": "admin",
                "is_verified": True
            },
            {
                "email": "developer@example.com",
                "password": "Dev123!@#",
                "full_name": "Developer User",
                "role": "user",
                "is_verified": True
            }
        ]

        created_users = []
        for user_data in test_users:
            existing_user = db.query(User).filter(User.email == user_data["email"]).first()

            if not existing_user:
                user = User(
                    email=user_data["email"],
                    password_hash=hash_password(user_data["password"]),
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    is_verified=user_data["is_verified"],
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                created_users.append(user)
                logger.info(f"✓ Created user: {user.email}")
            else:
                created_users.append(existing_user)
                logger.info(f"  User already exists: {existing_user.email}")

        # Create test API keys
        if created_users:
            dev_user = [u for u in created_users if "developer" in u.email][0]

            # Check if API key already exists
            existing_key = db.query(APIKey).filter(APIKey.user_id == dev_user.id).first()

            if not existing_key:
                full_key, key_prefix, key_hash = api_key_service.generate_api_key()

                api_key = APIKey(
                    user_id=dev_user.id,
                    name="Development API Key",
                    key_prefix=key_prefix,
                    key_hash=key_hash,
                    rate_limit_per_hour=100,
                    max_file_size_mb=500,
                    allowed_formats="mp3,wav,mp4,avi,mov,mkv,flac",
                    webhook_url="http://localhost:3000/webhooks/test",
                    webhook_secret=secrets.token_urlsafe(32)
                )

                db.add(api_key)
                db.commit()
                db.refresh(api_key)

                logger.info(f"\n✓ Created API key for {dev_user.email}")
                logger.info(f"  API Key: {full_key}")
                logger.info(f"  Key ID: {api_key.id}")
                logger.info(f"  ⚠️  SAVE THIS KEY - it won't be shown again!")
            else:
                logger.info(f"  API key already exists for {dev_user.email}")

        logger.info("\n✓ Test data seeding complete!")

        # Print login credentials
        logger.info("\n" + "="*60)
        logger.info("TEST CREDENTIALS")
        logger.info("="*60)
        for user_data in test_users:
            logger.info(f"\nEmail: {user_data['email']}")
            logger.info(f"Password: {user_data['password']}")
            logger.info(f"Role: {user_data['role']}")

    except Exception as e:
        logger.error(f"Error seeding test data: {e}")
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Initialize database for API v2")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables")
    parser.add_argument("--seed", action="store_true", help="Seed with test data")

    args = parser.parse_args()

    if args.reset:
        response = input("⚠️  This will DELETE ALL DATA. Are you sure? (yes/no): ")
        if response.lower() != "yes":
            logger.info("Aborted.")
            sys.exit(0)

    init_database(reset=args.reset, seed=args.seed)
