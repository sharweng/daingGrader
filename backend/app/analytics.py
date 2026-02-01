"""
Analytics Module
================
Handles analytics logging and aggregation for scan data.
"""

from datetime import datetime, timedelta

from .config import get_scans_collection


def log_scan_analytics(
    fish_types: list,
    confidences: list,
    is_daing: bool,
    scan_id: str = None,
    color_analysis: dict = None
) -> bool:
    """
    Log scan analytics to MongoDB including color consistency data.
    
    Args:
        fish_types: List of detected fish types
        confidences: List of confidence scores
        is_daing: Whether daing was detected
        scan_id: Optional ID linking to history entry
        color_analysis: Optional color consistency analysis results
        
    Returns:
        True if successful, False otherwise
    """
    scans_collection = get_scans_collection()
    if scans_collection is None:
        print("⚠️ MongoDB not connected, skipping analytics")
        return False
    
    try:
        scan_data = {
            "timestamp": datetime.now(),
            "is_daing": is_daing,
            "detections": [],
            "scan_id": scan_id,
            "color_analysis": color_analysis or {}
        }
        
        if is_daing and fish_types:
            for fish_type, confidence in zip(fish_types, confidences):
                scan_data["detections"].append({
                    "fish_type": fish_type,
                    "confidence": float(confidence)
                })
        
        scans_collection.insert_one(scan_data)
        grade = color_analysis.get('quality_grade', 'N/A') if color_analysis else 'N/A'
        score = color_analysis.get('consistency_score', 0) if color_analysis else 0
        print(f"📊 Analytics logged: {'Daing' if is_daing else 'No Daing'} | Color: {score}% ({grade}) (ID: {scan_id})")
        return True
    except Exception as e:
        print(f"⚠️ Failed to log analytics: {e}")
        return False


def delete_analytics_by_scan_id(scan_id: str) -> bool:
    """
    Delete analytics record by scan_id.
    
    Args:
        scan_id: ID of the scan to delete analytics for
        
    Returns:
        True if record was deleted, False otherwise
    """
    scans_collection = get_scans_collection()
    if scans_collection is None:
        return False
    
    try:
        # First try to delete by scan_id (new method)
        result = scans_collection.delete_one({"scan_id": scan_id})
        if result.deleted_count > 0:
            print(f"📊 Deleted analytics record for {scan_id}")
            return True
        
        # Fallback: try by timestamp parsing (for old records)
        timestamp_str = scan_id.replace("scan_", "")
        date_part = timestamp_str[:8]
        time_part = timestamp_str[9:15]
        
        target_time = datetime.strptime(f"{date_part}{time_part}", "%Y%m%d%H%M%S")
        start_time = target_time - timedelta(seconds=2)
        end_time = target_time + timedelta(seconds=2)
        
        result = scans_collection.delete_one({
            "timestamp": {"$gte": start_time, "$lte": end_time}
        })
        if result.deleted_count > 0:
            print(f"📊 Deleted analytics record for {scan_id} (by timestamp)")
            return True
        
        print(f"⚠️ No analytics record found for {scan_id}")
        return False
    except Exception as e:
        print(f"⚠️ Failed to delete analytics: {e}")
        return False


def get_analytics_summary() -> dict:
    """
    Get comprehensive analytics summary from MongoDB.
    
    Returns:
        Analytics summary with totals, distributions, and color consistency data
    """
    scans_collection = get_scans_collection()
    
    empty_response = {
        "status": "error",
        "message": "MongoDB not connected",
        "total_scans": 0,
        "daing_scans": 0,
        "non_daing_scans": 0,
        "fish_type_distribution": {},
        "average_confidence": {},
        "daily_scans": {},
        "color_consistency": {
            "average_score": 0,
            "grade_distribution": {"Export": 0, "Local": 0, "Reject": 0},
            "by_fish_type": {}
        }
    }
    
    if scans_collection is None:
        return empty_response
    
    try:
        # Total scans
        total_scans = scans_collection.count_documents({})
        daing_scans = scans_collection.count_documents({"is_daing": True})
        non_daing_scans = total_scans - daing_scans
        
        # Fish type distribution
        pipeline = [
            {"$match": {"is_daing": True}},
            {"$unwind": "$detections"},
            {"$group": {"_id": "$detections.fish_type", "count": {"$sum": 1}}}
        ]
        fish_types = list(scans_collection.aggregate(pipeline))
        fish_type_distribution = {item["_id"]: item["count"] for item in fish_types}
        
        # Average confidence by fish type
        pipeline = [
            {"$match": {"is_daing": True}},
            {"$unwind": "$detections"},
            {"$group": {"_id": "$detections.fish_type", "avg_conf": {"$avg": "$detections.confidence"}}}
        ]
        avg_conf = list(scans_collection.aggregate(pipeline))
        average_confidence = {item["_id"]: round(item["avg_conf"], 4) for item in avg_conf}
        
        # Daily scans (last 7 days)
        seven_days_ago = datetime.now() - timedelta(days=7)
        pipeline = [
            {"$match": {"timestamp": {"$gte": seven_days_ago}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        daily = list(scans_collection.aggregate(pipeline))
        daily_scans = {item["_id"]: item["count"] for item in daily}
        
        # Color Consistency Analysis
        pipeline = [
            {"$match": {"is_daing": True, "color_analysis.consistency_score": {"$exists": True, "$gt": 0}}},
            {"$group": {
                "_id": None,
                "avg_score": {"$avg": "$color_analysis.consistency_score"},
                "count": {"$sum": 1}
            }}
        ]
        color_avg = list(scans_collection.aggregate(pipeline))
        avg_color_score = round(color_avg[0]["avg_score"], 1) if color_avg else 0
        
        # Quality grade distribution
        grade_distribution = {"Export": 0, "Local": 0, "Reject": 0}
        for grade in ["Export", "Local", "Reject"]:
            count = scans_collection.count_documents({
                "is_daing": True,
                "color_analysis.quality_grade": grade
            })
            grade_distribution[grade] = count
        
        # Color consistency by fish type
        pipeline = [
            {"$match": {"is_daing": True, "color_analysis.consistency_score": {"$exists": True, "$gt": 0}}},
            {"$unwind": "$detections"},
            {"$group": {
                "_id": "$detections.fish_type",
                "avg_score": {"$avg": "$color_analysis.consistency_score"},
                "count": {"$sum": 1}
            }}
        ]
        color_by_type = list(scans_collection.aggregate(pipeline))
        color_by_fish_type = {
            item["_id"]: {
                "avg_score": round(item["avg_score"], 1),
                "count": item["count"]
            } for item in color_by_type
        }
        
        return {
            "status": "success",
            "total_scans": total_scans,
            "daing_scans": daing_scans,
            "non_daing_scans": non_daing_scans,
            "fish_type_distribution": fish_type_distribution,
            "average_confidence": average_confidence,
            "daily_scans": daily_scans,
            "color_consistency": {
                "average_score": avg_color_score,
                "grade_distribution": grade_distribution,
                "by_fish_type": color_by_fish_type
            }
        }
    
    except Exception as e:
        print(f"❌ Analytics error: {e}")
        import traceback
        traceback.print_exc()
        empty_response["message"] = str(e)
        return empty_response
