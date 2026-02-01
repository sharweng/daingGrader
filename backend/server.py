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

# ============================================
# COLOR CONSISTENCY ANALYSIS FUNCTIONS
# ============================================

def analyze_color_consistency_with_masks(img: np.ndarray, masks, boxes) -> dict:
    """
    Analyze color consistency using segmentation masks for accurate fish-only analysis.
    
    This measures the visual uniformity of the dried fish surface by calculating
    standard deviations of pixel intensities. Only analyzes pixels within the mask.
    
    Returns:
        - consistency_score: 0-100 (higher = more uniform = better quality)
        - quality_grade: 'Export', 'Local', or 'Reject'
        - color_stats: detailed statistics for each fish region
    """
    if masks is None or len(masks) == 0:
        print("📦 No masks available, falling back to bounding box analysis")
        return analyze_color_consistency_with_boxes(img, boxes)
    
    print("🎭 Using segmentation masks for accurate color analysis")
    
    color_stats = []
    total_std = 0
    h, w = img.shape[:2]
    
    for i, mask in enumerate(masks):
        try:
            # Get mask data and resize to image dimensions
            mask_data = mask.data[0].cpu().numpy()
            
            # Resize mask to match image size if needed
            if mask_data.shape != (h, w):
                mask_resized = cv2.resize(mask_data.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
                mask_binary = (mask_resized > 0.5).astype(np.uint8)
            else:
                mask_binary = (mask_data > 0.5).astype(np.uint8)
            
            # Extract only the fish pixels using the mask
            fish_pixels = img[mask_binary == 1]
            
            if fish_pixels.size == 0:
                continue
            
            # Reshape to Nx3 for color analysis
            fish_pixels = fish_pixels.reshape(-1, 3)
            
            # Convert to LAB color space for better color analysis
            # Create a small image from fish pixels for conversion
            fish_pixels_img = fish_pixels.reshape(1, -1, 3).astype(np.uint8)
            lab_pixels = cv2.cvtColor(fish_pixels_img, cv2.COLOR_BGR2LAB).reshape(-1, 3)
            
            # Calculate statistics for each channel
            l_channel = lab_pixels[:, 0]  # Lightness
            a_channel = lab_pixels[:, 1]  # Green-Red
            b_channel = lab_pixels[:, 2]  # Blue-Yellow
            
            # Standard deviations (lower = more uniform)
            l_std = float(np.std(l_channel))
            a_std = float(np.std(a_channel))
            b_std = float(np.std(b_channel))
            
            # Mean values for color profile
            l_mean = float(np.mean(l_channel))
            a_mean = float(np.mean(a_channel))
            b_mean = float(np.mean(b_channel))
            
            # Combined standard deviation (weighted)
            combined_std = (l_std * 0.5) + (a_std * 0.25) + (b_std * 0.25)
            total_std += combined_std
            
            # RGB standard deviations
            rgb_std = [float(np.std(fish_pixels[:, c])) for c in range(3)]
            
            # Count pixels for coverage info
            pixel_count = np.sum(mask_binary)
            coverage_percent = (pixel_count / (h * w)) * 100
            
            color_stats.append({
                "region_index": i,
                "l_std": round(l_std, 2),
                "a_std": round(a_std, 2),
                "b_std": round(b_std, 2),
                "l_mean": round(l_mean, 2),
                "a_mean": round(a_mean, 2),
                "b_mean": round(b_mean, 2),
                "combined_std": round(combined_std, 2),
                "rgb_std": [round(s, 2) for s in rgb_std],
                "pixel_count": int(pixel_count),
                "coverage_percent": round(coverage_percent, 2)
            })
            
        except Exception as e:
            print(f"⚠️ Error analyzing mask region {i}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    if not color_stats:
        return {
            "consistency_score": 0,
            "quality_grade": "Unknown",
            "color_stats": [],
            "avg_std_deviation": 0
        }
    
    # Calculate average standard deviation across all fish
    avg_std = total_std / len(color_stats)
    
    # Convert std deviation to consistency score (0-100)
    consistency_score = min(100, max(0, 100 * np.exp(-avg_std / 35)))
    
    # Determine quality grade based on score
    if consistency_score >= 75:
        quality_grade = "Export"
    elif consistency_score >= 50:
        quality_grade = "Local"
    else:
        quality_grade = "Reject"
    
    return {
        "consistency_score": round(consistency_score, 1),
        "quality_grade": quality_grade,
        "color_stats": color_stats,
        "avg_std_deviation": round(avg_std, 2),
        "analysis_method": "segmentation"
    }


def analyze_color_consistency_with_boxes(img: np.ndarray, boxes) -> dict:
    """
    Fallback: Analyze color consistency using bounding boxes (less accurate).
    Used when segmentation masks are not available.
    """
    if boxes is None or len(boxes) == 0:
        return {
            "consistency_score": 0,
            "quality_grade": "Unknown",
            "color_stats": [],
            "avg_std_deviation": 0
        }
    
    print("📦 Using bounding box for color analysis (detection model)")
    
    color_stats = []
    total_std = 0
    
    for i, box in enumerate(boxes):
        try:
            # Get bounding box coordinates
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            
            # Ensure coordinates are within image bounds
            h, w = img.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            # Extract fish region (center 70% to reduce background)
            box_w, box_h = x2 - x1, y2 - y1
            margin_x, margin_y = int(box_w * 0.15), int(box_h * 0.15)
            x1, y1 = x1 + margin_x, y1 + margin_y
            x2, y2 = x2 - margin_x, y2 - margin_y
            
            fish_region = img[y1:y2, x1:x2]
            
            if fish_region.size == 0:
                continue
            
            # Convert to LAB color space
            lab_region = cv2.cvtColor(fish_region, cv2.COLOR_BGR2LAB)
            
            l_channel = lab_region[:, :, 0]
            a_channel = lab_region[:, :, 1]
            b_channel = lab_region[:, :, 2]
            
            l_std = float(np.std(l_channel))
            a_std = float(np.std(a_channel))
            b_std = float(np.std(b_channel))
            
            l_mean = float(np.mean(l_channel))
            a_mean = float(np.mean(a_channel))
            b_mean = float(np.mean(b_channel))
            
            combined_std = (l_std * 0.5) + (a_std * 0.25) + (b_std * 0.25)
            total_std += combined_std
            
            rgb_std = [float(np.std(fish_region[:, :, c])) for c in range(3)]
            
            color_stats.append({
                "region_index": i,
                "l_std": round(l_std, 2),
                "a_std": round(a_std, 2),
                "b_std": round(b_std, 2),
                "l_mean": round(l_mean, 2),
                "a_mean": round(a_mean, 2),
                "b_mean": round(b_mean, 2),
                "combined_std": round(combined_std, 2),
                "rgb_std": [round(s, 2) for s in rgb_std]
            })
            
        except Exception as e:
            print(f"⚠️ Error analyzing box region {i}: {e}")
            continue
    
    if not color_stats:
        return {
            "consistency_score": 0,
            "quality_grade": "Unknown",
            "color_stats": [],
            "avg_std_deviation": 0
        }
    
    avg_std = total_std / len(color_stats)
    consistency_score = min(100, max(0, 100 * np.exp(-avg_std / 35)))
    
    if consistency_score >= 75:
        quality_grade = "Export"
    elif consistency_score >= 50:
        quality_grade = "Local"
    else:
        quality_grade = "Reject"
    
    return {
        "consistency_score": round(consistency_score, 1),
        "quality_grade": quality_grade,
        "color_stats": color_stats,
        "avg_std_deviation": round(avg_std, 2),
        "analysis_method": "bounding_box"
    }


def draw_segmentation_results(img: np.ndarray, results, indices: list, model) -> np.ndarray:
    """
    Draw segmentation masks and labels on the image.
    Creates a semi-transparent colored overlay for each fish.
    """
    annotated_img = img.copy()
    h, w = img.shape[:2]
    
    masks = results[0].masks
    boxes = results[0].boxes
    
    # Colors for different fish (BGR format)
    colors = [
        (255, 107, 107),  # Red
        (78, 205, 196),   # Teal
        (69, 183, 209),   # Blue
        (150, 206, 180),  # Green
        (255, 234, 167),  # Yellow
        (221, 160, 221),  # Plum
    ]
    
    for i, idx in enumerate(indices):
        color = colors[i % len(colors)]
        
        if masks is not None and idx < len(masks):
            # Get mask and resize to image dimensions
            mask_data = masks[idx].data[0].cpu().numpy()
            if mask_data.shape != (h, w):
                mask_resized = cv2.resize(mask_data.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
                mask_binary = (mask_resized > 0.5).astype(np.uint8)
            else:
                mask_binary = (mask_data > 0.5).astype(np.uint8)
            
            # Create colored overlay
            colored_mask = np.zeros_like(annotated_img)
            colored_mask[mask_binary == 1] = color
            
            # Blend with original image (semi-transparent)
            annotated_img = cv2.addWeighted(annotated_img, 1, colored_mask, 0.4, 0)
            
            # Draw polygon outline
            contours, _ = cv2.findContours(mask_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(annotated_img, contours, -1, color, 2)
        
        # Draw label with fish type and confidence
        if boxes is not None and idx < len(boxes):
            box = boxes[idx]
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            fish_type = model.names[int(box.cls[0])]
            confidence = float(box.conf[0])
            
            # Label background
            label = f"{fish_type} {confidence:.0%}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.6
            thickness = 2
            (label_w, label_h), _ = cv2.getTextSize(label, font, font_scale, thickness)
            
            # Draw label background
            cv2.rectangle(annotated_img, (x1, y1 - label_h - 10), (x1 + label_w + 10, y1), color, -1)
            cv2.putText(annotated_img, label, (x1 + 5, y1 - 5), font, font_scale, (255, 255, 255), thickness)
    
    return annotated_img


def draw_color_analysis_image(img: np.ndarray, results, indices: list, model, color_analysis: dict) -> np.ndarray:
    """
    Draw segmentation masks with color consistency score overlay.
    This creates the second slide showing the polygon analysis.
    """
    annotated_img = img.copy()
    h, w = img.shape[:2]
    
    masks = results[0].masks
    boxes = results[0].boxes
    
    # Draw masks with color based on quality grade
    grade = color_analysis.get("quality_grade", "Unknown")
    score = color_analysis.get("consistency_score", 0)
    
    # Color based on grade
    if grade == "Export":
        mask_color = (80, 200, 120)  # Green
        grade_color = (80, 200, 120)
    elif grade == "Local":
        mask_color = (80, 180, 255)  # Orange/Yellow
        grade_color = (80, 180, 255)
    else:
        mask_color = (80, 80, 255)  # Red
        grade_color = (80, 80, 255)
    
    for i, idx in enumerate(indices):
        if masks is not None and idx < len(masks):
            # Get mask and resize to image dimensions
            mask_data = masks[idx].data[0].cpu().numpy()
            if mask_data.shape != (h, w):
                mask_resized = cv2.resize(mask_data.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
                mask_binary = (mask_resized > 0.5).astype(np.uint8)
            else:
                mask_binary = (mask_data > 0.5).astype(np.uint8)
            
            # Create colored overlay
            colored_mask = np.zeros_like(annotated_img)
            colored_mask[mask_binary == 1] = mask_color
            
            # Blend with original image (semi-transparent)
            annotated_img = cv2.addWeighted(annotated_img, 1, colored_mask, 0.5, 0)
            
            # Draw polygon outline (thicker)
            contours, _ = cv2.findContours(mask_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(annotated_img, contours, -1, mask_color, 3)
    
    # Draw color consistency score overlay at the bottom
    overlay_height = 120
    overlay = annotated_img.copy()
    cv2.rectangle(overlay, (0, h - overlay_height), (w, h), (0, 0, 0), -1)
    annotated_img = cv2.addWeighted(overlay, 0.7, annotated_img, 0.3, 0)
    
    # Draw score text
    font = cv2.FONT_HERSHEY_SIMPLEX
    
    # Main score
    score_text = f"Color Consistency: {score:.1f}%"
    font_scale = 0.9
    thickness = 2
    (text_w, text_h), _ = cv2.getTextSize(score_text, font, font_scale, thickness)
    text_x = (w - text_w) // 2
    text_y = h - overlay_height + 45
    cv2.putText(annotated_img, score_text, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)
    
    # Grade badge
    grade_text = f"Grade: {grade}"
    font_scale_grade = 1.1
    thickness_grade = 3
    (grade_w, grade_h), _ = cv2.getTextSize(grade_text, font, font_scale_grade, thickness_grade)
    grade_x = (w - grade_w) // 2
    grade_y = h - overlay_height + 90
    
    # Draw grade with color
    cv2.putText(annotated_img, grade_text, (grade_x, grade_y), font, font_scale_grade, grade_color, thickness_grade)
    
    return annotated_img


def draw_detection_boxes(img: np.ndarray, results, indices: list, model) -> np.ndarray:
    """
    Draw bounding boxes for detection display (first slide).
    """
    annotated_img = img.copy()
    boxes = results[0].boxes
    
    # Colors for different fish (BGR format)
    colors = [
        (255, 107, 107),  # Red
        (78, 205, 196),   # Teal
        (69, 183, 209),   # Blue
        (150, 206, 180),  # Green
        (255, 234, 167),  # Yellow
        (221, 160, 221),  # Plum
    ]
    
    for i, idx in enumerate(indices):
        color = colors[i % len(colors)]
        
        if boxes is not None and idx < len(boxes):
            box = boxes[idx]
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            fish_type = model.names[int(box.cls[0])]
            confidence = float(box.conf[0])
            
            # Draw bounding box
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), color, 3)
            
            # Label background
            label = f"{fish_type} {confidence:.0%}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.7
            thickness = 2
            (label_w, label_h), _ = cv2.getTextSize(label, font, font_scale, thickness)
            
            # Draw label background
            cv2.rectangle(annotated_img, (x1, y1 - label_h - 14), (x1 + label_w + 10, y1), color, -1)
            cv2.putText(annotated_img, label, (x1 + 5, y1 - 7), font, font_scale, (255, 255, 255), thickness)
    
    return annotated_img


def draw_combined_result_image(img: np.ndarray, results, indices: list, model, color_analysis: dict = None) -> np.ndarray:
    """
    Draw a single combined image with:
    - Bounding boxes around detected fish
    - Semi-transparent polygon masks (if available)
    - Color consistency score overlay at bottom
    """
    annotated_img = img.copy()
    h, w = img.shape[:2]
    
    boxes = results[0].boxes
    masks = results[0].masks
    has_masks = masks is not None and len(masks) > 0
    
    # Colors for different fish (BGR format)
    colors = [
        (255, 107, 107),  # Red/Coral
        (78, 205, 196),   # Teal
        (69, 183, 209),   # Blue
        (150, 206, 180),  # Green
        (255, 234, 167),  # Yellow
        (221, 160, 221),  # Plum
    ]
    
    # Determine grade color if we have color analysis
    if color_analysis:
        grade = color_analysis.get("quality_grade", "Unknown")
        if grade == "Export":
            grade_color = (80, 200, 120)  # Green (BGR)
        elif grade == "Local":
            grade_color = (80, 180, 255)  # Orange/Yellow (BGR)
        else:
            grade_color = (80, 80, 255)   # Red (BGR)
    
    # STEP 1: Draw semi-transparent polygon masks (if available)
    if has_masks:
        for i, idx in enumerate(indices):
            if idx < len(masks):
                color = colors[i % len(colors)]
                
                # Get mask and resize to image dimensions
                mask_data = masks[idx].data[0].cpu().numpy()
                if mask_data.shape != (h, w):
                    mask_resized = cv2.resize(mask_data.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
                    mask_binary = (mask_resized > 0.5).astype(np.uint8)
                else:
                    mask_binary = (mask_data > 0.5).astype(np.uint8)
                
                # Create colored overlay (semi-transparent fill)
                colored_mask = np.zeros_like(annotated_img)
                colored_mask[mask_binary == 1] = color
                annotated_img = cv2.addWeighted(annotated_img, 1, colored_mask, 0.3, 0)
                
                # Draw polygon outline
                contours, _ = cv2.findContours(mask_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                cv2.drawContours(annotated_img, contours, -1, color, 2)
    
    # STEP 2: Draw bounding boxes with labels on top
    for i, idx in enumerate(indices):
        color = colors[i % len(colors)]
        
        if boxes is not None and idx < len(boxes):
            box = boxes[idx]
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            fish_type = model.names[int(box.cls[0])]
            confidence = float(box.conf[0])
            
            # Draw bounding box
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), color, 3)
            
            # Label background
            label = f"{fish_type} {confidence:.0%}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.7
            thickness = 2
            (label_w, label_h), _ = cv2.getTextSize(label, font, font_scale, thickness)
            
            # Draw label background at top of box
            cv2.rectangle(annotated_img, (x1, y1 - label_h - 14), (x1 + label_w + 10, y1), color, -1)
            cv2.putText(annotated_img, label, (x1 + 5, y1 - 7), font, font_scale, (255, 255, 255), thickness)
    
    # STEP 3: Draw color consistency score overlay at bottom (if available)
    if color_analysis:
        score = color_analysis.get("consistency_score", 0)
        grade = color_analysis.get("quality_grade", "Unknown")
        
        # Create semi-transparent overlay bar at bottom
        overlay_height = 70
        overlay = annotated_img.copy()
        cv2.rectangle(overlay, (0, h - overlay_height), (w, h), (0, 0, 0), -1)
        annotated_img = cv2.addWeighted(overlay, 0.7, annotated_img, 0.3, 0)
        
        # Draw combined text
        font = cv2.FONT_HERSHEY_SIMPLEX
        
        # Left side: Color score
        score_text = f"Color: {score:.1f}%"
        cv2.putText(annotated_img, score_text, (20, h - 25), font, 0.8, (255, 255, 255), 2)
        
        # Right side: Grade badge
        grade_text = f"Grade: {grade}"
        (grade_w, _), _ = cv2.getTextSize(grade_text, font, 0.9, 2)
        cv2.putText(annotated_img, grade_text, (w - grade_w - 20, h - 25), font, 0.9, grade_color, 2)
    
    return annotated_img
    
    return annotated_img

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

def log_scan_analytics(fish_types: list, confidences: list, is_daing: bool, scan_id: str = None, color_analysis: dict = None):
    """Log scan analytics to MongoDB including color consistency data"""
    if scans_collection is None:
        print("⚠️ MongoDB not connected, skipping analytics")
        return
    
    try:
        scan_data = {
            "timestamp": datetime.now(),
            "is_daing": is_daing,
            "detections": [],
            "scan_id": scan_id,  # Link analytics to history entry
            "color_analysis": color_analysis or {}  # Color consistency data
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
    except Exception as e:
        print(f"⚠️ Failed to log analytics: {e}")

@app.post("/analyze")
async def analyze_fish(file: UploadFile = File(...), auto_save_dataset: bool = False):
  print(f"Received an image for AI Analysis... (auto_save_dataset: {auto_save_dataset})") 
  
  # 1. READ IMAGE
  contents = await file.read()
  nparr = np.frombuffer(contents, np.uint8)
  img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

  # 2. RUN AI INFERENCE (Segmentation Model)
  results = model(img)
  
  # 3. FILTER DETECTIONS BY CONFIDENCE THRESHOLD
  CONFIDENCE_THRESHOLD = 0.8
  
  # Get the detection boxes and masks from results
  boxes = results[0].boxes
  masks = results[0].masks  # Segmentation masks (None for detection models)
  
  # Check if this is a segmentation model
  has_masks = masks is not None and len(masks) > 0
  if has_masks:
    print("🎭 Segmentation model detected - using polygon masks")
  else:
    print("📦 Detection model detected - using bounding boxes only")
  
  # Variables for analytics
  detected_fish_types = []
  detected_confidences = []
  is_daing_detected = False
  filtered_indices = []
  result_img = None
  color_analysis = None
  
  # Filter detections based on confidence
  if boxes is not None and len(boxes) > 0:
    confidences = boxes.conf.cpu().numpy()
    high_conf_detections = confidences >= CONFIDENCE_THRESHOLD
    
    if not high_conf_detections.any():
      # NO DAING DETECTED
      result_img = img.copy()
      h, w = result_img.shape[:2]
      
      overlay = result_img.copy()
      cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
      cv2.addWeighted(overlay, 0.3, result_img, 0.7, 0, result_img)
      
      text = "NO DAING DETECTED"
      font = cv2.FONT_HERSHEY_SIMPLEX
      font_scale = 1.5
      thickness = 3
      
      (text_w, text_h), _ = cv2.getTextSize(text, font, font_scale, thickness)
      text_x = (w - text_w) // 2
      text_y = (h + text_h) // 2
      
      cv2.putText(result_img, text, (text_x, text_y), font, font_scale, (0, 0, 0), thickness + 2)
      cv2.putText(result_img, text, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)
      
      is_daing_detected = False
      print("⚠️ No high-confidence daing detected")
    else:
      # DAING DETECTED
      filtered_indices = [i for i, conf in enumerate(confidences) if conf >= CONFIDENCE_THRESHOLD]
      
      # Collect analytics data
      for idx in filtered_indices:
          fish_type = model.names[int(boxes.cls[idx])]
          confidence = float(boxes.conf[idx])
          detected_fish_types.append(fish_type)
          detected_confidences.append(confidence)
      
      # Perform color analysis
      if has_masks:
          filtered_masks = masks[filtered_indices]
          filtered_boxes = boxes[filtered_indices] if filtered_indices else None
          color_analysis = analyze_color_consistency_with_masks(img, filtered_masks, filtered_boxes)
      else:
          filtered_boxes = boxes[filtered_indices] if filtered_indices else None
          color_analysis = analyze_color_consistency_with_boxes(img, filtered_boxes)
      
      # Create SINGLE combined result image with boxes, masks, and score
      result_img = draw_combined_result_image(img, results, filtered_indices, model, color_analysis)
      
      is_daing_detected = True
      print(f"✅ Found {len(filtered_indices)} high-confidence daing detection(s)")
      if color_analysis:
          print(f"🎨 Color Analysis: Score={color_analysis['consistency_score']}% Grade={color_analysis['quality_grade']}")
  else:
    # No detections at all
    result_img = img.copy()
    h, w = result_img.shape[:2]
    
    overlay = result_img.copy()
    cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.3, result_img, 0.7, 0, result_img)
    
    text = "NO DAING DETECTED"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1.5
    thickness = 3
    
    (text_w, text_h), _ = cv2.getTextSize(text, font, font_scale, thickness)
    text_x = (w - text_w) // 2
    text_y = (h + text_h) // 2
    
    cv2.putText(result_img, text, (text_x, text_y), font, font_scale, (0, 0, 0), thickness + 2)
    cv2.putText(result_img, text, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)
    
    print("⚠️ No daing detected at all")

  # 4. ENCODE IMAGE
  success, encoded_result = cv2.imencode('.jpg', result_img)
  if not success:
    raise ValueError("Failed to encode result image")
  result_bytes = encoded_result.tobytes()
  
  # 5. UPLOAD TO CLOUDINARY & LOG HISTORY
  try:
    now = datetime.now()
    date_folder = now.strftime("%Y-%m-%d")
    history_folder = f"daing-history/{date_folder}"
    history_id = f"scan_{now.strftime('%Y%m%d_%H%M%S_%f')}"

    # Upload single combined result image
    result_upload = cloudinary.uploader.upload(
      io.BytesIO(result_bytes),
      folder=history_folder,
      public_id=history_id,
      resource_type="image"
    )
    result_url = result_upload.get("secure_url")

    add_history_entry({
      "id": history_id,
      "timestamp": now.isoformat(),
      "url": result_url,
      "folder": history_folder
    })
    print(f"📚 History saved: {history_folder}/{history_id}")
    
    # 6. LOG ANALYTICS TO MONGODB
    log_scan_analytics(detected_fish_types, detected_confidences, is_daing_detected, scan_id=history_id, color_analysis=color_analysis)
    
    # 7. AUTO-SAVE HIGH-CONFIDENCE IMAGES TO DATASET
    if auto_save_dataset and is_daing_detected and detected_confidences:
      max_confidence = max(detected_confidences) if detected_confidences else 0
      if max_confidence >= 0.85:
        try:
          dataset_folder = f"daing-dataset-auto/{date_folder}"
          dataset_id = f"auto_{now.strftime('%Y%m%d_%H%M%S_%f')}"
          
          cloudinary.uploader.upload(
            contents,
            folder=dataset_folder,
            public_id=dataset_id,
            resource_type="image"
          )
          print(f"📁 Auto-saved to dataset: {dataset_folder}/{dataset_id} (confidence: {max_confidence:.1%})")
        except Exception as dataset_error:
          print(f"⚠️ Failed to auto-save to dataset: {dataset_error}")
    
    # 8. RETURN JSON WITH SINGLE COMBINED IMAGE URL
    response_data = {
        "status": "success",
        "is_daing_detected": is_daing_detected,
        "result_image": result_url,
        "detections": [
            {"fish_type": ft, "confidence": conf} 
            for ft, conf in zip(detected_fish_types, detected_confidences)
        ],
        "color_analysis": color_analysis
    }
    
    return response_data
    
  except Exception as history_error:
    print(f"⚠️ Failed to save history: {history_error}")
    import traceback
    traceback.print_exc()
    
    # Return at least the result image on error
    return StreamingResponse(io.BytesIO(result_bytes), media_type="image/jpeg")


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
    """Get analytics summary from MongoDB including color consistency data"""
    if scans_collection is None:
        return {
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
        
        # Color Consistency Analysis
        # Average consistency score across all scans with color data
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
        
        # Color consistency by fish type (average score per fish type)
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
        return {
            "status": "error",
            "message": str(e),
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