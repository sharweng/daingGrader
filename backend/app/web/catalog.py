"""
Catalog Routes for E-commerce
=============================
API endpoints for product catalog browsing.
"""

import re
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from ..database import get_products_collection

router = APIRouter()


def _normalize_product(doc: dict) -> dict:
    """Normalize product document for API response."""
    return {
        "id": str(doc.get("_id")),
        "seller_id": doc.get("seller_id", ""),
        "seller_name": doc.get("seller_name", ""),
        "name": doc.get("name", ""),
        "description": doc.get("description", ""),
        "price": doc.get("price", 0),
        "category_id": str(doc.get("category_id")) if doc.get("category_id") else None,
        "category_name": doc.get("category_name", ""),
        "stock_qty": doc.get("stock_qty", 0),
        "status": doc.get("status", "available"),
        "images": doc.get("images", []),
        "main_image_index": doc.get("main_image_index", 0),
        "is_disabled": doc.get("is_disabled", False),
        "sold_count": doc.get("sold_count", 0),
        "created_at": str(doc.get("created_at", "")),
        "updated_at": str(doc.get("updated_at", "")),
    }


@router.get("/catalog/products")
def get_catalog_products(
    search: str = "",
    category_id: str = "",
    seller_id: str = "",
    sort: str = "latest",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
):
    """
    Get paginated list of available products.
    
    Query Parameters:
    - search: Search term for product names
    - category_id: Filter by category
    - seller_id: Filter by seller
    - sort: Sort order (latest, most_sold, price_low, price_high)
    - page: Page number (default 1)
    - page_size: Items per page (default 12, max 50)
    """
    collection = get_products_collection()
    if collection is None:
        raise HTTPException(status_code=500, detail="Database not configured")

    # Build query filter
    query: Dict[str, Any] = {"is_disabled": {"$ne": True}, "status": "available"}
    
    if search:
        query["name"] = {"$regex": re.escape(search), "$options": "i"}
    
    if category_id:
        try:
            query["category_id"] = ObjectId(category_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid category ID")
    
    if seller_id:
        query["seller_id"] = seller_id

    # Determine sort order
    sort_fields = [("created_at", -1)]
    if sort == "most_sold":
        sort_fields = [("sold_count", -1), ("created_at", -1)]
    elif sort == "price_low":
        sort_fields = [("price", 1)]
    elif sort == "price_high":
        sort_fields = [("price", -1)]

    # Execute query
    total = collection.count_documents(query)
    docs = list(
        collection.find(query)
        .sort(sort_fields)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    
    return {
        "status": "success",
        "products": [_normalize_product(d) for d in docs],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/catalog/products/{product_id}")
def get_product_detail(product_id: str):
    """Get details for a specific product."""
    collection = get_products_collection()
    if collection is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        doc = collection.find_one({"_id": ObjectId(product_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if doc.get("is_disabled"):
        raise HTTPException(status_code=404, detail="Product not available")
    
    return {"status": "success", "product": _normalize_product(doc)}


@router.get("/catalog/categories")
def get_catalog_categories():
    """Get all product categories for browsing."""
    from ..database import get_categories_collection
    
    collection = get_categories_collection()
    if collection is None:
        return {"status": "success", "categories": []}
    
    docs = list(collection.find({}))
    categories = [
        {
            "id": str(d.get("_id")),
            "name": d.get("name", ""),
            "description": d.get("description", ""),
        }
        for d in docs
    ]
    
    return {"status": "success", "categories": categories}
