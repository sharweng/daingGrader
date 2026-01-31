from fastapi import FastAPI, UploadFile, File, Form
import cv2
import numpy as np
import io
import os
import json
from pathlib import Path
from starlette.responses import StreamingResponse
from datetime import datetime, timedelta
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv
from ultralytics import YOLO
from pymongo import MongoClient

# Load environment variables
load_dotenv()

# Configure Cloudinary
cloudinary.config(
  cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
  api_key=os.getenv("CLOUDINARY_API_KEY"),
  api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# Configure MongoDB
try:
    mongo_client = MongoClient(os.getenv("MONGODB_URI"))
    db = mongo_client[os.getenv("MONGODB_DB_NAME", "daing_grader")]
    scans_collection = db.scans
    history_collection = db.history
    # Create indexes for faster queries
    scans_collection.create_index([("timestamp", -1)])
    scans_collection.create_index([("fish_type", 1)])
    scans_collection.create_index([("scan_id", 1)])  # For deletion by scan_id
    history_collection.create_index([("timestamp", -1)])
    history_collection.create_index([("id", 1)], unique=True)
    print("✅ MongoDB Connected Successfully!")
except Exception as e:
    print(f"❌ MongoDB Connection Error: {e}")
    scans_collection = None
    history_collection = None

app = FastAPI()

# --- 🧠 LOAD YOUR AI MODEL HERE ---
# We load it outside the function so it stays in memory (faster)
# Make sure 'best.pt' is in the same folder as this script!
try:
    print("Loading AI Model...")
    model = YOLO("best.pt")
    print("✅ AI Model Loaded Successfully!")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    print("Did you forget to put best.pt in the folder?")
# ----------------------------------

# Dataset Setup
DATASET_DIR = Path("dataset")
DATASET_DIR.mkdir(exist_ok=True)

# ============================================
# HISTORY FUNCTIONS (MongoDB)
# ============================================

def add_history_entry(entry):
    """Add a history entry to MongoDB"""
    if history_collection is None:
        print("⚠️ MongoDB not connected, skipping history save")
        return
    try:
        # Convert ISO string to datetime for proper sorting
        entry_doc = {
            "id": entry["id"],
            "timestamp": datetime.fromisoformat(entry["timestamp"]),
            "url": entry["url"],
            "folder": entry.get("folder", "")
        }
        history_collection.insert_one(entry_doc)
        print(f"📚 History saved to MongoDB: {entry['id']}")
    except Exception as e:
        print(f"⚠️ Failed to save history to MongoDB: {e}")

def get_history_entries():
    """Get all history entries from MongoDB, sorted by newest first"""
    if history_collection is None:
        return []
    try:
        entries = list(history_collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(200))
        # Convert datetime back to ISO string for JSON response
        for entry in entries:
            if isinstance(entry.get("timestamp"), datetime):
                entry["timestamp"] = entry["timestamp"].isoformat()
        return entries
    except Exception as e:
        print(f"⚠️ Failed to get history from MongoDB: {e}")
        return []

def remove_history_entry(entry_id: str):
    """Remove a history entry from MongoDB"""
    if history_collection is None:
        return None
    try:
        result = history_collection.find_one_and_delete({"id": entry_id})
        if result:
            # Convert datetime to ISO string
            if isinstance(result.get("timestamp"), datetime):
                result["timestamp"] = result["timestamp"].isoformat()
            return result
        return None
    except Exception as e:
        print(f"⚠️ Failed to remove history from MongoDB: {e}")
        return None

# ============================================
# ANALYTICS FUNCTIONS
# ============================================

def log_scan_analytics(fish_types: list, confidences: list, is_daing: bool, scan_id: str = None):
    """Log scan analytics to MongoDB"""
    if scans_collection is None:
        print("⚠️ MongoDB not connected, skipping analytics")
        return
    
    try:
        scan_data = {
            "timestamp": datetime.now(),
            "is_daing": is_daing,
            "detections": [],
            "scan_id": scan_id  # Link analytics to history entry
        }
        
        if is_daing and fish_types:
            for fish_type, confidence in zip(fish_types, confidences):
                scan_data["detections"].append({
                    "fish_type": fish_type,
                    "confidence": float(confidence)
                })
        
        scans_collection.insert_one(scan_data)
        print(f"📊 Analytics logged: {'Daing' if is_daing else 'No Daing'} (ID: {scan_id})")
    except Exception as e:
        print(f"⚠️ Failed to log analytics: {e}")

@app.post("/analyze")
async def analyze_fish(file: UploadFile = File(...), auto_save_dataset: bool = False):
  print(f"Received an image for AI Analysis... (auto_save_dataset: {auto_save_dataset})") 
  
  # 1. READ IMAGE
  contents = await file.read()
  nparr = np.frombuffer(contents, np.uint8)
  img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

  # 2. RUN AI INFERENCE (The Real Deal)
  # This replaces the manual cv2.rectangle code
  results = model(img)
  
  # 3. FILTER DETECTIONS BY CONFIDENCE THRESHOLD
  # Set a minimum confidence threshold to avoid false positives
  CONFIDENCE_THRESHOLD = 0.8  # Only accept detections with 50% confidence or higher
  
  # Get the detection boxes from results
  boxes = results[0].boxes
  
  # Variables for analytics
  detected_fish_types = []
  detected_confidences = []
  is_daing_detected = False
  
  # Filter detections based on confidence
  if boxes is not None and len(boxes) > 0:
    # Get confidence scores
    confidences = boxes.conf.cpu().numpy()
    # Check if any detection meets the threshold
    high_conf_detections = confidences >= CONFIDENCE_THRESHOLD
    
    if not high_conf_detections.any():
      # NO DAING DETECTED - Add text overlay
      annotated_img = img.copy()
      h, w = annotated_img.shape[:2]
      
      # Add semi-transparent overlay
      overlay = annotated_img.copy()
      cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
      cv2.addWeighted(overlay, 0.3, annotated_img, 0.7, 0, annotated_img)
      
      # Add "NO DAING DETECTED" text in the center
      text = "NO DAING DETECTED"
      font = cv2.FONT_HERSHEY_SIMPLEX
      font_scale = 1.5
      thickness = 3
      
      # Get text size for centering
      (text_w, text_h), _ = cv2.getTextSize(text, font, font_scale, thickness)
      text_x = (w - text_w) // 2
      text_y = (h + text_h) // 2
      
      # Draw text with outline for better visibility
      cv2.putText(annotated_img, text, (text_x, text_y), font, font_scale, (0, 0, 0), thickness + 2)
      cv2.putText(annotated_img, text, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)
      
      is_daing_detected = False
      print("⚠️ No high-confidence daing detected")
    else:
      # DAING DETECTED - Filter and draw only high-confidence boxes
      # Create a mask for high confidence detections
      indices = [i for i, conf in enumerate(confidences) if conf >= CONFIDENCE_THRESHOLD]
      
      # Collect analytics data
      for idx in indices:
          fish_type = model.names[int(boxes.cls[idx])]
          confidence = float(boxes.conf[idx])
          detected_fish_types.append(fish_type)
          detected_confidences.append(confidence)
      
      # Filter the results to only include high-confidence detections
      filtered_boxes = boxes[indices]
      results[0].boxes = filtered_boxes
      
      # Draw boxes and labels for filtered detections
      annotated_img = results[0].plot()
      is_daing_detected = True
      print(f"✅ Found {len(indices)} high-confidence daing detection(s)")
  else:
    # No detections at all
    annotated_img = img.copy()
    h, w = annotated_img.shape[:2]
    
    # Add semi-transparent overlay
    overlay = annotated_img.copy()
    cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.3, annotated_img, 0.7, 0, annotated_img)
    
    # Add "NO DAING DETECTED" text
    text = "NO DAING DETECTED"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1.5
    thickness = 3
    
    (text_w, text_h), _ = cv2.getTextSize(text, font, font_scale, thickness)
    text_x = (w - text_w) // 2
    text_y = (h + text_h) // 2
    
    cv2.putText(annotated_img, text, (text_x, text_y), font, font_scale, (0, 0, 0), thickness + 2)
    cv2.putText(annotated_img, text, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)
    
    print("⚠️ No daing detected at all")

  # 4. PREPARE RESPONSE
  success, encoded_img = cv2.imencode('.jpg', annotated_img)
  if not success:
    raise ValueError("Failed to encode image")

  # Convert to bytes - this creates the actual JPEG file data
  image_bytes = encoded_img.tobytes()

  # 5. UPLOAD TO CLOUDINARY & LOG HISTORY
  try:
    now = datetime.now()
    date_folder = now.strftime("%Y-%m-%d")
    history_folder = f"daing-history/{date_folder}"
    history_id = f"scan_{now.strftime('%Y%m%d_%H%M%S_%f')}"

    # We upload the ANNOTATED image (with boxes) so you can see what the AI saw
    # Use io.BytesIO to create a file-like object from the JPEG encoded data
    upload_result = cloudinary.uploader.upload(
      io.BytesIO(image_bytes),
      folder=history_folder,
      public_id=history_id,
      resource_type="image"
    )

    add_history_entry({
      "id": history_id,
      "timestamp": now.isoformat(),
      "url": upload_result.get("secure_url"),
      "folder": history_folder
    })
    print(f"📚 History saved: {history_folder}/{history_id}")
    
    # 6. LOG ANALYTICS TO MONGODB (with scan_id for reliable deletion)
    log_scan_analytics(detected_fish_types, detected_confidences, is_daing_detected, scan_id=history_id)
    
    # 7. AUTO-SAVE HIGH-CONFIDENCE IMAGES TO DATASET
    # Only save if enabled and has detections with 85%+ confidence
    if auto_save_dataset and is_daing_detected and detected_confidences:
      max_confidence = max(detected_confidences) if detected_confidences else 0
      if max_confidence >= 0.85:
        try:
          # Save ORIGINAL image (not annotated) to dataset folder
          dataset_folder = f"daing-dataset-auto/{date_folder}"
          dataset_id = f"auto_{now.strftime('%Y%m%d_%H%M%S_%f')}"
          
          # Upload original image bytes (not annotated)
          cloudinary.uploader.upload(
            contents,  # Original image bytes from earlier
            folder=dataset_folder,
            public_id=dataset_id,
            resource_type="image"
          )
          print(f"📁 Auto-saved to dataset: {dataset_folder}/{dataset_id} (confidence: {max_confidence:.1%})")
        except Exception as dataset_error:
          print(f"⚠️ Failed to auto-save to dataset: {dataset_error}")
    
  except Exception as history_error:
    print(f"⚠️ Failed to save history: {history_error}")
    import traceback
    traceback.print_exc()

  # Return the image with boxes drawn on it
  return StreamingResponse(io.BytesIO(image_bytes), media_type="image/jpeg")


# --- KEEP YOUR DATASET/HISTORY ENDPOINTS BELOW AS IS ---
@app.post("/upload-dataset")
async def upload_dataset(
  file: UploadFile = File(...),
  fish_type: str = Form(...),
  condition: str = Form(...)
):
  # ... (Keep your existing code here) ...
  # Just copying the start to show where it goes
  print(f"📸 Data Gathering: {fish_type} - {condition}")
  contents = await file.read()
  timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
  filename = f"{fish_type}_{condition}_{timestamp}"
  date_folder = datetime.now().strftime("%Y-%m-%d")
  
  try:
    folder_path_1 = f"daing-dataset/{fish_type}/{condition}"
    upload_result_1 = cloudinary.uploader.upload(
      contents,
      folder=folder_path_1,
      public_id=filename,
      resource_type="image"
    )
    folder_path_2 = f"daing-dataset/date/{date_folder}/{fish_type}/{condition}"
    upload_result_2 = cloudinary.uploader.upload(
      contents,
      folder=folder_path_2,
      public_id=filename,
      resource_type="image"
    )
    return {
      "status": "success", 
      "message": "Image uploaded", 
      "filename": filename,
      "uploads": [{"url": upload_result_1.get("secure_url")}, {"url": upload_result_2.get("secure_url")}]
    }
  except Exception as e:
    return {"status": "error", "message": str(e)}

@app.get("/history")
def get_history():
  """Fetch history from Cloudinary directly - always in sync!"""
  try:
    # Get all resources from the daing-history folder
    result = cloudinary.api.resources(
      type="upload",
      prefix="daing-history/",
      max_results=500,
      resource_type="image"
    )
    
    entries = []
    for resource in result.get("resources", []):
      # Extract info from the resource
      public_id = resource.get("public_id", "")
      # public_id format: "daing-history/2026-01-30/scan_20260130_123456_789012"
      parts = public_id.split("/")
      if len(parts) >= 3:
        folder = "/".join(parts[:2])  # "daing-history/2026-01-30"
        scan_id = parts[2]  # "scan_20260130_123456_789012"
        
        # Parse timestamp from scan_id (scan_YYYYMMDD_HHMMSS_ffffff)
        try:
          timestamp_str = scan_id.replace("scan_", "")
          # Format: 20260130_123456_789012
          date_part = timestamp_str[:8]  # 20260130
          time_part = timestamp_str[9:15]  # 123456
          micro_part = timestamp_str[16:]  # 789012
          iso_timestamp = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}T{time_part[:2]}:{time_part[2:4]}:{time_part[4:6]}.{micro_part}"
        except:
          iso_timestamp = resource.get("created_at", "")
        
        entries.append({
          "id": scan_id,
          "timestamp": iso_timestamp,
          "url": resource.get("secure_url"),
          "folder": folder
        })
    
    # Sort by timestamp descending (newest first)
    entries.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {"status": "success", "entries": entries}
  except Exception as e:
    print(f"⚠️ Failed to fetch from Cloudinary: {e}")
    # Fallback to MongoDB if Cloudinary fails
    return {"status": "success", "entries": get_history_entries()}

def delete_analytics_by_scan_id(scan_id: str):
    """Delete analytics record by scan_id"""
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

def cleanup_empty_cloudinary_folder(folder_path: str):
    """Delete empty folder from Cloudinary"""
    try:
        # Check if folder has any resources left
        result = cloudinary.api.resources(
            type="upload",
            prefix=folder_path,
            max_results=1,
            resource_type="image"
        )
        if len(result.get("resources", [])) == 0:
            # Folder is empty, delete it
            cloudinary.api.delete_folder(folder_path)
            print(f"🗑️ Deleted empty folder: {folder_path}")
            return True
    except Exception as e:
        # Folder deletion may fail if it doesn't exist or not empty
        print(f"⚠️ Could not delete folder {folder_path}: {e}")
    return False

@app.delete("/history/{entry_id}")
def delete_history(entry_id: str):
  """Delete from both Cloudinary and MongoDB"""
  try:
    folder_to_check = None
    
    # Try to get folder info from MongoDB first
    entry = remove_history_entry(entry_id)
    
    # If not in MongoDB, try to find it in Cloudinary by searching
    if not entry:
      # Search in Cloudinary for this scan ID
      try:
        result = cloudinary.api.resources(
          type="upload",
          prefix=f"daing-history/",
          max_results=500,
          resource_type="image"
        )
        for resource in result.get("resources", []):
          public_id = resource.get("public_id", "")
          if entry_id in public_id:
            # Extract folder path for cleanup
            parts = public_id.rsplit("/", 1)
            if len(parts) > 1:
                folder_to_check = parts[0]
            
            # Found it! Delete from Cloudinary
            cloudinary.uploader.destroy(public_id, resource_type="image")
            
            # Delete from MongoDB analytics by scan_id
            delete_analytics_by_scan_id(entry_id)
            
            # Check and cleanup empty folder
            if folder_to_check:
                cleanup_empty_cloudinary_folder(folder_to_check)
            
            return {"status": "success"}
      except Exception as search_error:
        print(f"⚠️ Failed to search Cloudinary: {search_error}")
      
      return {"status": "error", "message": "Entry not found"}
    
    # Get folder for cleanup check
    folder_to_check = entry.get("folder")
    
    # Delete from Cloudinary using the folder info from MongoDB
    public_id = f"{folder_to_check}/{entry_id}" if folder_to_check else entry_id
    cloudinary.uploader.destroy(public_id, resource_type="image")
    
    # Delete from MongoDB analytics by scan_id
    delete_analytics_by_scan_id(entry_id)
    
    # Check and cleanup empty folder
    if folder_to_check:
        cleanup_empty_cloudinary_folder(folder_to_check)
    
    return {"status": "success"}
  except Exception as e:
    print(f"⚠️ Failed to delete: {e}")
    return {"status": "error", "message": str(e)}

# ============================================
# ANALYTICS ENDPOINTS
# ============================================

@app.get("/analytics/summary")
async def get_analytics_summary():
    """Get analytics summary from MongoDB"""
    if scans_collection is None:
        return {
            "status": "error",
            "message": "MongoDB not connected",
            "total_scans": 0,
            "daing_scans": 0,
            "non_daing_scans": 0,
            "fish_type_distribution": {},
            "average_confidence": {},
            "daily_scans": {}
        }
    
    try:
        # Total scans
        total_scans = scans_collection.count_documents({})
        daing_scans = scans_collection.count_documents({"is_daing": True})
        non_daing_scans = total_scans - daing_scans
        
        # Fish type distribution (flatten detections array)
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
        
        return {
            "status": "success",
            "total_scans": total_scans,
            "daing_scans": daing_scans,
            "non_daing_scans": non_daing_scans,
            "fish_type_distribution": fish_type_distribution,
            "average_confidence": average_confidence,
            "daily_scans": daily_scans
        }
    
    except Exception as e:
        print(f"❌ Analytics error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "total_scans": 0,
            "daing_scans": 0,
            "non_daing_scans": 0,
            "fish_type_distribution": {},
            "average_confidence": {},
            "daily_scans": {}
        }

# ============================================
# AUTO DATASET ENDPOINTS
# ============================================

@app.get("/auto-dataset")
def get_auto_dataset():
    """Fetch auto-saved dataset images from Cloudinary"""
    try:
        result = cloudinary.api.resources(
            type="upload",
            prefix="daing-dataset-auto/",
            max_results=500,
            resource_type="image"
        )
        
        entries = []
        for resource in result.get("resources", []):
            public_id = resource.get("public_id", "")
            # public_id format: "daing-dataset-auto/2026-01-30/auto_20260130_123456_789012"
            parts = public_id.split("/")
            
            # Handle both formats: with date folder (3+ parts) or without (2 parts)
            if len(parts) >= 2:
                if len(parts) >= 3:
                    folder = "/".join(parts[:2])
                    image_id = parts[-1]  # Get the last part as image_id
                else:
                    folder = parts[0]
                    image_id = parts[-1]
                
                # Parse timestamp from image_id (auto_YYYYMMDD_HHMMSS_ffffff)
                try:
                    timestamp_str = image_id.replace("auto_", "")
                    date_part = timestamp_str[:8]
                    time_part = timestamp_str[9:15] if len(timestamp_str) > 9 else "000000"
                    micro_part = timestamp_str[16:] if len(timestamp_str) > 16 else "000000"
                    iso_timestamp = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}T{time_part[:2]}:{time_part[2:4]}:{time_part[4:6]}.{micro_part}"
                except:
                    iso_timestamp = resource.get("created_at", "")
                
                entries.append({
                    "id": image_id,
                    "timestamp": iso_timestamp,
                    "url": resource.get("secure_url"),
                    "folder": folder,
                    "public_id": public_id  # Include full public_id for deletion
                })
        
        print(f"📁 Auto-dataset: Found {len(entries)} images")
        entries.sort(key=lambda x: x["timestamp"], reverse=True)
        return {"status": "success", "entries": entries}
    except Exception as e:
        print(f"⚠️ Failed to fetch auto-dataset: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "entries": [], "message": str(e)}

@app.delete("/auto-dataset/{entry_id}")
def delete_auto_dataset_entry(entry_id: str):
    """Delete an auto-saved dataset image from Cloudinary"""
    try:
        folder_to_check = None
        
        # Search in Cloudinary for this entry
        result = cloudinary.api.resources(
            type="upload",
            prefix="daing-dataset-auto/",
            max_results=500,
            resource_type="image"
        )
        
        for resource in result.get("resources", []):
            public_id = resource.get("public_id", "")
            if entry_id in public_id:
                # Extract folder path for cleanup
                parts = public_id.rsplit("/", 1)
                if len(parts) > 1:
                    folder_to_check = parts[0]
                
                # Delete from Cloudinary
                cloudinary.uploader.destroy(public_id, resource_type="image")
                print(f"🗑️ Deleted auto-dataset entry: {public_id}")
                
                # Check and cleanup empty folder
                if folder_to_check:
                    cleanup_empty_cloudinary_folder(folder_to_check)
                
                return {"status": "success"}
        
        return {"status": "error", "message": "Entry not found"}
    except Exception as e:
        print(f"⚠️ Failed to delete auto-dataset entry: {e}")
        return {"status": "error", "message": str(e)}