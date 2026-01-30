from fastapi import FastAPI, UploadFile, File, Form
import cv2
import numpy as np
import io
import os
import json
from pathlib import Path
from starlette.responses import StreamingResponse
from datetime import datetime
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv
from ultralytics import YOLO  # <--- NEW IMPORT

# Load environment variables
load_dotenv()

# Configure Cloudinary
cloudinary.config(
  cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
  api_key=os.getenv("CLOUDINARY_API_KEY"),
  api_secret=os.getenv("CLOUDINARY_API_SECRET")
) 

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

# Dataset & History Setup
DATASET_DIR = Path("dataset")
DATASET_DIR.mkdir(exist_ok=True)
HISTORY_FILE = Path("history_log.json")

def _read_history_entries():
  if not HISTORY_FILE.exists():
    return []
  try:
    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
      return json.load(f)
  except json.JSONDecodeError:
    return []

def _write_history_entries(entries):
  with open(HISTORY_FILE, "w", encoding="utf-8") as f:
    json.dump(entries, f, indent=2)

def add_history_entry(entry):
  entries = _read_history_entries()
  entries.insert(0, entry)
  _write_history_entries(entries[:200])

def remove_history_entry(entry_id: str):
  entries = _read_history_entries()
  filtered = [e for e in entries if e.get("id") != entry_id]
  if len(filtered) == len(entries):
    return None
  _write_history_entries(filtered)
  removed = next(e for e in entries if e.get("id") == entry_id)
  return removed

@app.post("/analyze")
async def analyze_fish(file: UploadFile = File(...)):
  print("Received an image for AI Analysis...") 
  
  # 1. READ IMAGE
  contents = await file.read()
  nparr = np.frombuffer(contents, np.uint8)
  img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

  # 2. RUN AI INFERENCE (The Real Deal)
  # This replaces the manual cv2.rectangle code
  results = model(img)
  
  # 3. DRAW BOXES & LABELS
  # plot() automatically draws the boxes, names, and confidence scores
  annotated_img = results[0].plot() 

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
    # Fallback to JSON file if Cloudinary fails
    return {"status": "success", "entries": _read_history_entries()}

@app.delete("/history/{entry_id}")
def delete_history(entry_id: str):
  """Delete from both Cloudinary and local JSON"""
  try:
    # Try to get folder info from JSON first
    entry = remove_history_entry(entry_id)
    
    # If not in JSON, try to find it in Cloudinary by searching
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
            # Found it! Delete from Cloudinary
            cloudinary.uploader.destroy(public_id, resource_type="image")
            return {"status": "success"}
      except Exception as search_error:
        print(f"⚠️ Failed to search Cloudinary: {search_error}")
      
      return {"status": "error", "message": "Entry not found"}
    
    # Delete from Cloudinary using the folder info from JSON
    public_id = f"{entry.get('folder')}/{entry_id}" if entry.get("folder") else entry_id
    cloudinary.uploader.destroy(public_id, resource_type="image")
    return {"status": "success"}
  except Exception as e:
    print(f"⚠️ Failed to delete: {e}")
    return {"status": "error", "message": str(e)}