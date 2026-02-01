"""
Configuration module for Daing Grader Backend
Handles environment variables and service configurations.
"""

import os
from dotenv import load_dotenv
import cloudinary
from pymongo import MongoClient

# Load environment variables
load_dotenv()

# ============================================
# CLOUDINARY CONFIGURATION
# ============================================
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# ============================================
# MONGODB CONFIGURATION
# ============================================
mongo_client = None
db = None
scans_collection = None
history_collection = None

def init_mongodb():
    """Initialize MongoDB connection and collections"""
    global mongo_client, db, scans_collection, history_collection
    
    try:
        mongo_client = MongoClient(os.getenv("MONGODB_URI"))
        db = mongo_client[os.getenv("MONGODB_DB_NAME", "daing_grader")]
        scans_collection = db.scans
        history_collection = db.history
        
        # Create indexes for faster queries
        scans_collection.create_index([("timestamp", -1)])
        scans_collection.create_index([("fish_type", 1)])
        scans_collection.create_index([("scan_id", 1)])
        history_collection.create_index([("timestamp", -1)])
        history_collection.create_index([("id", 1)], unique=True)
        
        print("✅ MongoDB Connected Successfully!")
        return True
    except Exception as e:
        print(f"❌ MongoDB Connection Error: {e}")
        return False

def get_scans_collection():
    """Get scans collection"""
    return scans_collection

def get_history_collection():
    """Get history collection"""
    return history_collection

# Initialize MongoDB on import
init_mongodb()
