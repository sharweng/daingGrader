from fastapi import FastAPI, UploadFile, File, Form
import cv2
import numpy as np
import io
import os
from pathlib import Path
from starlette.responses import StreamingResponse

# install command = py -3.12 -m pip install fastapi uvicorn python-multipart numpy opencv-python
# running command = py -3.12 -m uvicorn server:app --host 0.0.0.0 --port 8000   

app = FastAPI()

# Create dataset directory structure
DATASET_DIR = Path("dataset")
DATASET_DIR.mkdir(exist_ok=True)

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

  # 3. SEND BACK PROCESSED IMAGE
  _, encoded_img = cv2.imencode('.jpg', img)
  return StreamingResponse(io.BytesIO(encoded_img.tobytes()), media_type="image/jpeg")

@app.post("/upload-dataset")
async def upload_dataset(
  file: UploadFile = File(...),
  fish_type: str = Form(...),
  condition: str = Form(...)
):
  """
  Endpoint for data gathering mode.
  Saves images to organized folders: dataset/{fish_type}/{condition}/
  """
  print(f"📸 Data Gathering: {fish_type} - {condition}")
  
  # Create organized folder structure
  save_dir = DATASET_DIR / fish_type / condition
  save_dir.mkdir(parents=True, exist_ok=True)
  
  # Read and save the image
  contents = await file.read()
  
  # Generate unique filename with timestamp
  from datetime import datetime
  timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
  filename = f"{fish_type}_{condition}_{timestamp}.jpg"
  file_path = save_dir / filename
  
  # Save the file
  with open(file_path, "wb") as f:
    f.write(contents)
  
  print(f"✅ Saved to: {file_path}")
  
  return {
    "status": "success",
    "message": f"Image saved to {save_dir}",
    "filename": filename,
    "path": str(file_path)
  }
