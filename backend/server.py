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
from dotenv import load_dotenv

# install command = pip install -r backend/requirements.txt
# running command = py -3.12 -m uvicorn server:app --host 0.0.0.0 --port 8000  

# Load environment variables
load_dotenv()

# Configure Cloudinary
cloudinary.config(
  cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
  api_key=os.getenv("CLOUDINARY_API_KEY"),
  api_secret=os.getenv("CLOUDINARY_API_SECRET")
) 

app = FastAPI()

# Create dataset directory structure (optional fallback)
DATASET_DIR = Path("dataset")
DATASET_DIR.mkdir(exist_ok=True)

# History log file for scanned images
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
  # keep latest 200 entries
  _write_history_entries(entries[:200])

@app.post("/analyze")
async def analyze_fish(file: UploadFile = File(...)):
  print("Received an image from the app!") 
  
  # 1. READ IMAGE
  contents = await file.read()
  nparr = np.frombuffer(contents, np.uint8)
  img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

  # 2. MOCK AI (Draw a Green Box to prove it works)
  height, width, _ = img.shape
  cv2.rectangle(img, (50, 50), (width - 50, height - 50), (0, 255, 0), 5)
  cv2.putText(img, "SERVER CONNECTED", (60, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

  # 3. SEND BACK PROCESSED IMAGE + STORE HISTORY
  success, encoded_img = cv2.imencode('.jpg', img)
  if not success:
    raise ValueError("Failed to encode image")

  image_bytes = encoded_img.tobytes()

  # Upload analyzed photo to Cloudinary history bucket
  try:
    now = datetime.now()
    date_folder = now.strftime("%Y-%m-%d")
    history_folder = f"daing-history/{date_folder}"
    history_id = f"scan_{now.strftime('%Y%m%d_%H%M%S_%f')}"

    upload_result = cloudinary.uploader.upload(
      image_bytes,
      folder=history_folder,
      public_id=history_id,
      resource_type="image"
    )

    add_history_entry({
      "id": history_id,
      "timestamp": now.isoformat(),
      "url": upload_result.get("secure_url"),
      "folder": history_folder,
    })
    print(f"📚 History saved: {history_folder}/{history_id}")
  except Exception as history_error:
    print(f"⚠️ Failed to upload history image: {history_error}")

  return StreamingResponse(io.BytesIO(image_bytes), media_type="image/jpeg")

@app.post("/upload-dataset")
async def upload_dataset(
  file: UploadFile = File(...),
  fish_type: str = Form(...),
  condition: str = Form(...)
):
  """
  Endpoint for data gathering mode.
  Saves images to Cloudinary in two folder structures:
  1. {fish_type}/{condition}/
  2. date/{date}/{fish_type}/{condition}/
  """
  print(f"📸 Data Gathering: {fish_type} - {condition}")
  
  # Read the image
  contents = await file.read()
  
  # Generate unique filename with timestamp
  timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
  filename = f"{fish_type}_{condition}_{timestamp}"
  
  # Get current date for folder structure
  date_folder = datetime.now().strftime("%Y-%m-%d")
  
  try:
    # Upload 1: fish_type/condition/
    folder_path_1 = f"daing-dataset/{fish_type}/{condition}"
    upload_result_1 = cloudinary.uploader.upload(
      contents,
      folder=folder_path_1,
      public_id=filename,
      resource_type="image"
    )
    print(f"✅ Uploaded to Cloudinary: {folder_path_1}/{filename}")
    
    # Upload 2: date/YYYY-MM-DD/fish_type/condition/
    folder_path_2 = f"daing-dataset/date/{date_folder}/{fish_type}/{condition}"
    upload_result_2 = cloudinary.uploader.upload(
      contents,
      folder=folder_path_2,
      public_id=filename,
      resource_type="image"
    )
    print(f"✅ Uploaded to Cloudinary: {folder_path_2}/{filename}")
    
    return {
      "status": "success",
      "message": "Image uploaded to Cloudinary (2 locations)",
      "filename": filename,
      "uploads": [
        {
          "path": folder_path_1,
          "url": upload_result_1.get("secure_url")
        },
        {
          "path": folder_path_2,
          "url": upload_result_2.get("secure_url")
        }
      ]
    }
  
  except Exception as e:
    print(f"❌ Error uploading to Cloudinary: {str(e)}")
    return {
      "status": "error",
      "message": f"Failed to upload to Cloudinary: {str(e)}"
    }


@app.get("/history")
def get_history():
  return {
    "status": "success",
    "entries": _read_history_entries()
  }
