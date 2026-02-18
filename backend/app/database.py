"""
Shared MongoDB Connection Module
================================
Single database connection used by both mobile app and web features.
All collections are defined here for easy reference.
"""

import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

_client = None


def get_mongo_client():
    """Get or create MongoDB client singleton."""
    global _client
    if _client is not None:
        return _client
    
    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise ValueError(
            "MONGODB_URI is not set in .env. "
            "Add it for database features (e.g. MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/)"
        )
    
    try:
        from pymongo import MongoClient
        _client = MongoClient(uri)
        # Verify connection
        _client.admin.command("ping")
        print("✅ MongoDB connected successfully")
        return _client
    except ImportError:
        raise ImportError("Install pymongo: pip install pymongo")


def get_db(database_name: str = None):
    """Get database instance. Uses MONGODB_DATABASE env var or defaults to 'daing_grader'."""
    if database_name is None:
        database_name = os.getenv("MONGODB_DATABASE", "daing_grader")
    return get_mongo_client()[database_name]


# ===========================================
# COLLECTION HELPERS
# ===========================================

# --- Mobile App Collections ---
def get_users_collection():
    """Users collection (shared between mobile and web)."""
    return get_db()["users"]


def get_scans_collection():
    """Scan history collection for AI detections."""
    return get_db()["scan_history"]


def get_dataset_collection():
    """Dataset collection for training data."""
    return get_db()["dataset"]


# --- Web App Collections ---
def get_products_collection():
    """Products collection for e-commerce."""
    return get_db()["products"]


def get_categories_collection():
    """Product categories collection."""
    return get_db()["product_categories"]


def get_orders_collection():
    """Orders collection for e-commerce."""
    return get_db()["orders"]


def get_payments_collection():
    """Payments collection for tracking transactions."""
    return get_db()["payments"]


def get_vouchers_collection():
    """Vouchers/discounts collection."""
    return get_db()["vouchers"]


def get_cart_collection():
    """Shopping cart collection."""
    return get_db()["carts"]


def get_community_posts_collection():
    """Community forum posts collection."""
    return get_db()["community_posts"]


def get_community_comments_collection():
    """Community forum comments collection."""
    return get_db()["community_comments"]


def get_reviews_collection():
    """Product reviews collection."""
    return get_db()["product_reviews"]


def get_contact_collection():
    """Contact form submissions collection."""
    return get_db()["contact_messages"]


def get_audit_logs_collection():
    """Audit logs for admin tracking."""
    return get_db()["audit_logs"]


def get_payouts_collection():
    """Seller payouts collection."""
    return get_db()["payouts"]
