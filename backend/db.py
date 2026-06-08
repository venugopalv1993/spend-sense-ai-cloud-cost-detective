import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime


def get_connection():
    """Get a PostgreSQL connection using DATABASE_URL from env."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not set in environment")
    return psycopg2.connect(database_url, sslmode="require")


def init_db():
    """Create tables if they don't exist."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS analyses (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            region VARCHAR(50) NOT NULL,
            resources_scanned INTEGER DEFAULT 0,
            issues_found INTEGER DEFAULT 0,
            estimated_savings VARCHAR(50),
            analysis_result JSONB,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


def save_analysis(user_id: int, region: str, resources_scanned: int,
                  issues_found: int, estimated_savings: str,
                  analysis_result: dict) -> int:
    """Save an analysis result to the database. Returns the analysis ID."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO analyses (user_id, region, resources_scanned, issues_found,
                              estimated_savings, analysis_result, status)
        VALUES (%s, %s, %s, %s, %s, %s, 'completed')
        RETURNING id
    """, (user_id, region, resources_scanned, issues_found,
          estimated_savings, json.dumps(analysis_result)))
    analysis_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return analysis_id


def get_history(user_id: int) -> list:
    """Get analysis history for a user."""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, region, resources_scanned, issues_found,
               estimated_savings, status, created_at
        FROM analyses
        WHERE user_id = %s
        ORDER BY created_at DESC
    """, (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    # Convert datetime to string for JSON serialization
    for row in rows:
        if isinstance(row.get("created_at"), datetime):
            row["created_at"] = row["created_at"].isoformat()
    return rows


def get_analysis_by_id(analysis_id: int, user_id: int) -> dict:
    """Get a single analysis by ID for a specific user."""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, region, resources_scanned, issues_found,
               estimated_savings, analysis_result, status, created_at
        FROM analyses
        WHERE id = %s AND user_id = %s
    """, (analysis_id, user_id))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row and isinstance(row.get("created_at"), datetime):
        row["created_at"] = row["created_at"].isoformat()
    return row
