"""
Database initialization and seeding script.
Creates tables and optionally seeds with sample data.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.db.database import init_database, reset_database, get_db_context
from app.services.auth_service import create_user
from app.db.models import User
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def initialize_fresh_database():
    """Initialize a fresh database with tables"""
    logger.info("Initializing fresh database...")
    reset_database()
    logger.info("Database initialized successfully!")


def seed_development_data():
    """Seed database with sample data for development"""
    logger.info("Seeding development data...")

    with get_db_context() as db:
        # Check if users already exist
        existing_user = db.query(User).first()
        if existing_user:
            logger.info("Database already contains users. Skipping seed.")
            return

        # Create admin user
        try:
            admin = create_user(
                db=db,
                email="admin@example.com",
                password="Admin123!@#",
                full_name="Admin User",
                organization="System",
                role="admin"
            )
            admin.is_verified = True
            admin.is_active = True
            db.commit()
            logger.info(f"Created admin user: admin@example.com")
        except Exception as e:
            logger.error(f"Failed to create admin user: {e}")

        # Create regular user
        try:
            user = create_user(
                db=db,
                email="user@example.com",
                password="User123!@#",
                full_name="Test User",
                organization="Example Corp",
                role="user"
            )
            user.is_verified = True
            user.is_active = True
            db.commit()
            logger.info(f"Created test user: user@example.com")
        except Exception as e:
            logger.error(f"Failed to create test user: {e}")

        # Create premium user
        try:
            premium = create_user(
                db=db,
                email="premium@example.com",
                password="Premium123!@#",
                full_name="Premium User",
                organization="Premium Corp",
                role="premium"
            )
            premium.is_verified = True
            premium.is_active = True
            db.commit()
            logger.info(f"Created premium user: premium@example.com")
        except Exception as e:
            logger.error(f"Failed to create premium user: {e}")

    logger.info("Development data seeded successfully!")
    logger.info("\nDevelopment Users:")
    logger.info("  Admin:   admin@example.com / Admin123!@#")
    logger.info("  User:    user@example.com / User123!@#")
    logger.info("  Premium: premium@example.com / Premium123!@#")


def main():
    """Main initialization function"""
    import argparse

    parser = argparse.ArgumentParser(description="Database initialization script")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset database (WARNING: destroys all data)"
    )
    parser.add_argument(
        "--seed",
        action="store_true",
        help="Seed database with development data"
    )

    args = parser.parse_args()

    if args.reset:
        response = input("WARNING: This will delete ALL data. Continue? (yes/no): ")
        if response.lower() != "yes":
            logger.info("Operation cancelled")
            return
        initialize_fresh_database()

    if args.seed:
        seed_development_data()

    if not args.reset and not args.seed:
        # Default: just create tables if they don't exist
        init_database()
        logger.info("Database tables created (if not exist)")


if __name__ == "__main__":
    main()
