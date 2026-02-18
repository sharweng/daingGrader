"""
Daing Grader Backend Server
===========================
Unified backend for both mobile app and web frontend.

AI-powered dried fish grading system using YOLOv8 segmentation
with color consistency analysis for quality assessment.

This is the main entry point for the FastAPI server.

Mobile App Modules (app/):
- config.py: Configuration and database connections
- model.py: AI model loading and inference
- color_analysis.py: Color consistency analysis
- mold_analysis.py: Mold detection analysis
- drawing.py: Image visualization and annotation
- history.py: History management
- analytics.py: Analytics logging and aggregation
- dataset.py: Dataset management
- routes.py: API route handlers
- auth.py: Session-based authentication

Web App Modules (app/web/):
- auth.py: JWT-based authentication with Firebase support
- payment.py: PayMongo payment integration
- paymongo.py: PayMongo API wrapper
- contact.py: Contact form with email
- email_sender.py: Email utilities
- email_templates.py: HTML email templates
- order_receipt.py: Order receipt PDF generation
"""

import os
import re
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

# Initialize the app module (loads config, model, etc.)
from app.config import init_mongodb
from app.model import load_model
from app.routes import router as mobile_router

# Import web routers
from app.web import auth_router, payment_router, contact_router
from app.web.catalog import router as catalog_router

# Create FastAPI app
app = FastAPI(
    title="Daing Grader API",
    description="Unified backend for AI-powered dried fish grading system (mobile + web)",
    version="3.0.0"
)

# --- CORS Configuration ---
# Support both mobile app and web frontend
_cors_origins = [
    "http://localhost:5173",    # Vite dev server
    "http://127.0.0.1:5173",
    "http://localhost:8081",    # Expo web
    "http://127.0.0.1:8081",
    "http://localhost:19006",   # Expo web alternate
]

# Add production frontend URL if configured
if _url := os.getenv("FRONTEND_URL", "").strip():
    _cors_origins.append(_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include Routes ---
# Mobile app routes (scan, history, analytics, mobile auth)
app.include_router(mobile_router)

# Web app routes
app.include_router(auth_router, prefix="/auth", tags=["web-auth"])
app.include_router(payment_router, prefix="/payment", tags=["payment"])
app.include_router(contact_router, tags=["contact"])
app.include_router(catalog_router, tags=["catalog"])

# Dataset directory
DATASET_DIR = Path("dataset")
DATASET_DIR.mkdir(exist_ok=True)

# Load model on startup
@app.on_event("startup")
async def startup_event():
    """Initialize model and connections on startup."""
    try:
        load_model("best.pt")
    except Exception as e:
        print(f"⚠️ Model loading deferred: {e}")

# Health check endpoint
@app.get("/")
async def root():
    """Health check endpoint for both mobile and web."""
    return {"status": "ok", "version": "3.0.0", "platforms": ["mobile", "web"]}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "3.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
