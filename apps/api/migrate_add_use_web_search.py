"""
Migration: Add use_web_search column to prompts table
Run this ONCE on Render to fix the missing column error.

Usage on Render:
1. Go to Render Dashboard → your API service
2. Click "Shell" or use Render CLI: render shell <service-name>
3. Run: python apps/api/migrate_add_use_web_search.py
"""

import os
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

load_dotenv("../.env")  # Load from repo root if running locally

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not set")
    exit(1)

print(f"Connecting to database...")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Check if column already exists
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("prompts")]

    if "use_web_search" in columns:
        print("✅ Column use_web_search already exists")
    else:
        print("➕ Adding use_web_search column to prompts table...")
        conn.execute(text(
            "ALTER TABLE prompts ADD COLUMN use_web_search BOOLEAN DEFAULT FALSE"
        ))
        conn.commit()
        print("✅ Migration successful!")

    # Also check for other potentially missing columns
    expected_columns = ["use_web_search"]
    missing = [col for col in expected_columns if col not in columns]

    if missing:
        print(f"⚠️  Missing columns: {missing}")
    else:
        print("✅ All expected columns present")

print("\nDone!")
