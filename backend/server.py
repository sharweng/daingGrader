from fastapi import FastAPI, UploadFile, File
import cv2
import numpy as np
import io
from starlette.responses import StreamingResponse

# running command = py -3.12 -m uvicorn server:app --host 0.0.0.0 --port 8000   

app = FastAPI()

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