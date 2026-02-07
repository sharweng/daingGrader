"""
Mold Detection and Spatial Distribution Analysis Module
========================================================
Detects mold presence, severity, and spatial distribution on dried fish surfaces.

The system detects whether or not mold is present and classifies severity as:
- None: No visible mold contamination
- Low: Minor surface contamination (<5% coverage)
- Moderate: Noticeable contamination (5-15% coverage)
- Severe: Heavy contamination (>15% coverage)

Spatial analysis maps mold locations to anatomical zones (head, body, belly, tail)
to identify which parts are most susceptible to early spoilage.
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional


def analyze_mold_with_masks(img: np.ndarray, masks, boxes) -> Dict:
    """
    Analyze mold presence and distribution using segmentation masks.
    
    Args:
        img: BGR image array
        masks: Segmentation masks from YOLO model
        boxes: Bounding boxes from YOLO model
        
    Returns:
        dict with mold analysis results including severity and spatial distribution
    """
    if masks is None or len(masks) == 0:
        print("📦 No masks available, using bounding box for mold analysis")
        return analyze_mold_with_boxes(img, boxes)
    
    print("🦠 Analyzing mold using segmentation masks")
    
    fish_results = []
    h, w = img.shape[:2]
    
    for i, mask in enumerate(masks):
        try:
            # Get mask data and resize to image dimensions
            mask_data = mask.data[0].cpu().numpy()
            if mask_data.shape != (h, w):
                mask_resized = cv2.resize(mask_data.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
                mask_binary = (mask_resized > 0.5).astype(np.uint8)
            else:
                mask_binary = (mask_data > 0.5).astype(np.uint8)
            
            # Analyze mold in this fish region
            mold_info = analyze_single_fish_mold(img, mask_binary, i)
            if mold_info:
                fish_results.append(mold_info)
            
        except Exception as e:
            print(f"⚠️ Error analyzing mold in mask {i}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    return aggregate_mold_results(fish_results, (h, w))


def analyze_mold_with_boxes(img: np.ndarray, boxes) -> Dict:
    """
    Fallback mold detection using bounding boxes when masks aren't available.
    
    Args:
        img: BGR image array
        boxes: Bounding boxes from YOLO model
        
    Returns:
        dict with mold analysis results
    """
    if boxes is None or len(boxes) == 0:
        return create_empty_mold_result()
    
    print("📦 Using bounding boxes for mold detection")
    
    fish_results = []
    h, w = img.shape[:2]
    
    for i, box in enumerate(boxes):
        try:
            # Get box coordinates with margin reduction
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            # Extract fish region with reduced margins
            box_w, box_h = x2 - x1, y2 - y1
            margin_x, margin_y = int(box_w * 0.1), int(box_h * 0.1)
            inner_x1, inner_y1 = x1 + margin_x, y1 + margin_y
            inner_x2, inner_y2 = x2 - margin_x, y2 - margin_y
            
            fish_region = img[inner_y1:inner_y2, inner_x1:inner_x2]
            if fish_region.size == 0:
                continue
            
            # Create mask for the region
            region_mask = np.ones(fish_region.shape[:2], dtype=np.uint8)
            
            # Analyze mold
            mold_info = analyze_single_fish_mold(fish_region, region_mask, i, offset=(inner_x1, inner_y1))
            if mold_info:
                fish_results.append(mold_info)
            
        except Exception as e:
            print(f"⚠️ Error analyzing mold in box {i}: {e}")
            continue
    
    return aggregate_mold_results(fish_results, (h, w))


def analyze_single_fish_mold(img: np.ndarray, mask: np.ndarray, region_index: int, offset: Tuple[int, int] = (0, 0)) -> Optional[Dict]:
    """
    Analyze mold characteristics within a single fish region.
    
    Mold detection uses multiple color-based criteria:
    1. Dark discoloration spots (fungal growth appears dark)
    2. Green/blue/gray hue detection (common mold colors)
    3. Abnormal color deviation in LAB space
    4. Surface irregularity patterns
    
    Args:
        img: BGR image (full image or cropped region)
        mask: Binary mask for the fish region
        region_index: Index of this fish in the detection
        offset: (x, y) offset for coordinate mapping
        
    Returns:
        dict with mold analysis for this fish
    """
    # Get fish pixels only
    fish_pixels = img[mask == 1]
    if fish_pixels.size == 0:
        return None
    
    h, w = mask.shape[:2] if len(mask.shape) == 2 else mask.shape[:2]
    total_fish_pixels = np.sum(mask)
    
    # Convert to different color spaces for mold detection
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Detect mold using multiple methods
    mold_mask = detect_mold_patches(img, hsv, lab, gray, mask)
    
    # Calculate mold coverage
    mold_pixel_count = np.sum(mold_mask > 0)
    mold_coverage_percent = (mold_pixel_count / total_fish_pixels * 100) if total_fish_pixels > 0 else 0
    
    # Determine severity based on coverage
    severity = classify_mold_severity(mold_coverage_percent, mold_mask)
    
    # Analyze spatial distribution
    spatial_data = analyze_spatial_distribution(mold_mask, mask, region_index, offset)
    
    # Find individual mold patches for detailed analysis
    mold_contours = find_mold_contours(mold_mask)
    
    # Calculate mold characteristics
    mold_characteristics = analyze_mold_characteristics(img, mold_mask, mask)
    
    # Convert numpy types to native Python types for JSON serialization
    coverage_float = float(mold_coverage_percent)
    
    return {
        "region_index": int(region_index),
        "mold_detected": bool(coverage_float > 0.5),  # Convert to native Python bool
        "mold_coverage_percent": round(coverage_float, 2),
        "severity": severity,
        "patch_count": int(len(mold_contours)),
        "spatial_distribution": spatial_data,
        "characteristics": mold_characteristics,
        "mold_mask_coords": get_mold_coordinates(mold_mask, offset)  # For visualization
    }


def detect_mold_patches(bgr: np.ndarray, hsv: np.ndarray, lab: np.ndarray, gray: np.ndarray, fish_mask: np.ndarray) -> np.ndarray:
    """
    Detect mold patches using improved color and texture analysis.
    
    This improved version is more conservative to reduce false positives.
    Mold on dried fish typically appears as:
    - Dark spots (black/brown fungal growth)
    - Greenish-blue discoloration (clear mold indicator)
    - Gray fuzzy patches with distinct texture
    
    Args:
        bgr: BGR image
        hsv: HSV color space image
        lab: LAB color space image
        gray: Grayscale image
        fish_mask: Binary mask for fish area
        
    Returns:
        Binary mask of detected mold patches
    """
    h, w = bgr.shape[:2]
    
    # Initialize combined mold mask
    mold_mask = np.zeros((h, w), dtype=np.uint8)
    
    # Get fish-only regions for analysis
    fish_gray = cv2.bitwise_and(gray, gray, mask=fish_mask)
    fish_hsv = cv2.bitwise_and(hsv, hsv, mask=cv2.merge([fish_mask, fish_mask, fish_mask]))
    fish_lab = cv2.bitwise_and(lab, lab, mask=cv2.merge([fish_mask, fish_mask, fish_mask]))
    
    # Calculate fish statistics for adaptive thresholding
    fish_pixels = gray[fish_mask > 0]
    if fish_pixels.size == 0:
        return mold_mask
    
    fish_mean = np.mean(fish_pixels)
    fish_std = np.std(fish_pixels)
    
    # =====================================================
    # METHOD 1: Significant Dark Spots (Conservative)
    # Only detect spots MUCH darker than surrounding fish
    # =====================================================
    
    # Adaptive threshold based on fish brightness
    blur = cv2.GaussianBlur(gray, (31, 31), 0)
    dark_threshold = max(40, fish_mean - 2.5 * fish_std)  # More conservative
    
    # Dark spots relative to local area AND absolute darkness
    dark_relative = (blur.astype(np.float32) - gray.astype(np.float32) > 35).astype(np.uint8) * 255
    dark_absolute = (gray < dark_threshold).astype(np.uint8) * 255
    
    # Combine: must be both locally dark AND absolutely dark
    dark_spots = cv2.bitwise_and(dark_relative, dark_absolute)
    
    # =====================================================
    # METHOD 2: Green/Blue Mold (Strong indicator)
    # These are clear signs of mold - be more sensitive here
    # =====================================================
    
    # Extract HSV channels
    h_channel = hsv[:, :, 0]
    s_channel = hsv[:, :, 1]
    v_channel = hsv[:, :, 2]
    
    # Green mold (most common) - hue between 35-85, with decent saturation
    green_mold = (
        (h_channel >= 35) & (h_channel <= 85) & 
        (s_channel >= 40) & (v_channel >= 30) & (v_channel <= 180)
    ).astype(np.uint8) * 255
    
    # Blue-green mold - hue between 80-130
    blue_green_mold = (
        (h_channel >= 80) & (h_channel <= 130) & 
        (s_channel >= 35) & (v_channel >= 30) & (v_channel <= 180)
    ).astype(np.uint8) * 255
    
    # =====================================================
    # METHOD 3: LAB Anomaly Detection (Conservative)
    # Detect colors that clearly deviate from normal fish
    # =====================================================
    
    l_channel = lab[:, :, 0]  # Lightness
    a_channel = lab[:, :, 1]  # Green-Red axis (128=neutral)
    b_channel = lab[:, :, 2]  # Blue-Yellow axis (128=neutral)
    
    # Very greenish areas (a < 115 means green tint)
    # Combined with low lightness = likely mold
    greenish_mold = (
        (a_channel < 115) & (l_channel < 120) & (l_channel > 20)
    ).astype(np.uint8) * 255
    
    # =====================================================
    # COMBINE METHODS (Conservative - require multiple indicators)
    # =====================================================
    
    # Primary indicators (strong mold signals)
    primary_mold = cv2.bitwise_or(green_mold, blue_green_mold)
    primary_mold = cv2.bitwise_or(primary_mold, greenish_mold)
    
    # Secondary indicator (needs confirmation)
    # Dark spots only count if they overlap with color anomaly OR are very significant
    significant_dark = cv2.erode(dark_spots, np.ones((5, 5), np.uint8), iterations=1)
    
    # Combine all
    mold_mask = cv2.bitwise_or(primary_mold, significant_dark)
    
    # Apply fish mask
    mold_mask = cv2.bitwise_and(mold_mask, fish_mask * 255)
    
    # =====================================================
    # AGGRESSIVE NOISE REDUCTION
    # =====================================================
    
    # Morphological operations to clean up
    kernel_small = np.ones((5, 5), np.uint8)
    kernel_large = np.ones((9, 9), np.uint8)
    
    # Close gaps to connect nearby detections
    mold_mask = cv2.morphologyEx(mold_mask, cv2.MORPH_CLOSE, kernel_large)
    
    # Remove isolated small spots (noise)
    mold_mask = cv2.morphologyEx(mold_mask, cv2.MORPH_OPEN, kernel_small)
    
    # Additional dilation to merge nearby patches
    mold_mask = cv2.dilate(mold_mask, kernel_small, iterations=1)
    mold_mask = cv2.erode(mold_mask, kernel_small, iterations=1)
    
    # Remove small detections - MUCH higher threshold to reduce boxes
    contours, _ = cv2.findContours(mold_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = 500  # Increased from 50 - only show significant patches
    cleaned_mask = np.zeros_like(mold_mask)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area >= min_area:
            # Fill the contour to create solid regions
            cv2.drawContours(cleaned_mask, [cnt], -1, 255, -1)
    
    return cleaned_mask


def classify_mold_severity(coverage_percent: float, mold_mask: np.ndarray) -> str:
    """
    Classify mold severity based on coverage percentage and distribution.
    
    Severity levels:
    - None: <0.5% coverage (negligible/no mold)
    - Low: 0.5-5% coverage (minor contamination)
    - Moderate: 5-15% coverage (noticeable contamination)
    - Severe: >15% coverage (heavy contamination, likely reject)
    
    Args:
        coverage_percent: Percentage of fish surface covered by mold
        mold_mask: Binary mask of detected mold
        
    Returns:
        Severity classification string
    """
    if coverage_percent < 0.5:
        return "None"
    elif coverage_percent < 5.0:
        return "Low"
    elif coverage_percent < 15.0:
        return "Moderate"
    else:
        return "Severe"


def analyze_spatial_distribution(mold_mask: np.ndarray, fish_mask: np.ndarray, region_index: int, offset: Tuple[int, int] = (0, 0)) -> Dict:
    """
    Analyze spatial distribution of mold patches across anatomical zones.
    
    Zones:
    - head: Front 25% of fish
    - body_upper: Upper middle section
    - belly: Lower middle section (most susceptible to spoilage)
    - tail: Rear 25% of fish
    
    Args:
        mold_mask: Binary mask of detected mold
        fish_mask: Binary mask of fish region
        region_index: Index of this fish
        offset: Coordinate offset for global mapping
        
    Returns:
        dict with spatial distribution data
    """
    # Find fish boundaries
    fish_contours, _ = cv2.findContours(fish_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not fish_contours:
        return {"zones": {}, "center_coords": None, "total_patches": 0}
    
    # Get fish bounding box and center
    fish_contour = max(fish_contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(fish_contour)
    center_x, center_y = x + w // 2, y + h // 2
    
    # Define anatomical zones
    zones = {
        "head": {"patch_count": 0, "coverage_pixels": 0, "fish_pixels": 0},
        "body_upper": {"patch_count": 0, "coverage_pixels": 0, "fish_pixels": 0},
        "belly": {"patch_count": 0, "coverage_pixels": 0, "fish_pixels": 0},
        "tail": {"patch_count": 0, "coverage_pixels": 0, "fish_pixels": 0}
    }
    
    # Calculate fish pixels per zone
    for zone_name in zones.keys():
        zone_mask = create_zone_mask(fish_mask.shape, x, y, w, h, zone_name)
        zones[zone_name]["fish_pixels"] = int(np.sum(cv2.bitwise_and(zone_mask, fish_mask)))
    
    # Find mold contours and classify by zone
    mold_contours = find_mold_contours(mold_mask)
    
    for contour in mold_contours:
        M = cv2.moments(contour)
        if M["m00"] == 0:
            continue
        
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        
        # Classify zone
        zone = classify_anatomical_zone(cx, cy, x, y, w, h)
        
        if zone in zones:
            zones[zone]["patch_count"] += 1
            zones[zone]["coverage_pixels"] += cv2.contourArea(contour)
    
    # Calculate coverage percentage per zone
    for zone_name, zone_data in zones.items():
        if zone_data["fish_pixels"] > 0:
            zone_data["coverage_percent"] = round(
                float(zone_data["coverage_pixels"] / zone_data["fish_pixels"]) * 100, 2
            )
        else:
            zone_data["coverage_percent"] = 0.0
        # Ensure all values are native Python types
        zone_data["patch_count"] = int(zone_data["patch_count"])
        zone_data["coverage_pixels"] = int(zone_data["coverage_pixels"])
        zone_data["fish_pixels"] = int(zone_data["fish_pixels"])
    
    return {
        "zones": zones,
        "center_coords": (int(center_x + offset[0]), int(center_y + offset[1])),
        "total_patches": int(len(mold_contours)),
        "fish_bounds": {"x": int(x + offset[0]), "y": int(y + offset[1]), "w": int(w), "h": int(h)}
    }


def create_zone_mask(shape: Tuple[int, int], x: int, y: int, w: int, h: int, zone_name: str) -> np.ndarray:
    """
    Create a binary mask for a specific anatomical zone.
    
    Zones are defined relative to fish bounding box:
    - head: Left 25%
    - body_upper: Middle 50%, top half
    - belly: Middle 50%, bottom half
    - tail: Right 25%
    """
    mask = np.zeros(shape, dtype=np.uint8)
    
    if zone_name == "head":
        x1, y1 = x, y
        x2, y2 = x + int(w * 0.25), y + h
    elif zone_name == "body_upper":
        x1, y1 = x + int(w * 0.25), y
        x2, y2 = x + int(w * 0.75), y + int(h * 0.5)
    elif zone_name == "belly":
        x1, y1 = x + int(w * 0.25), y + int(h * 0.5)
        x2, y2 = x + int(w * 0.75), y + h
    elif zone_name == "tail":
        x1, y1 = x + int(w * 0.75), y
        x2, y2 = x + w, y + h
    else:
        return mask
    
    mask[y1:y2, x1:x2] = 255
    return mask


def classify_anatomical_zone(patch_x: int, patch_y: int, fish_x: int, fish_y: int, fish_w: int, fish_h: int) -> str:
    """
    Classify which anatomical zone a mold patch belongs to.
    
    Args:
        patch_x, patch_y: Coordinates of patch center
        fish_x, fish_y: Top-left corner of fish bounding box
        fish_w, fish_h: Width and height of fish bounding box
        
    Returns:
        Zone name
    """
    # Relative position within fish (0 to 1)
    rel_x = (patch_x - fish_x) / fish_w if fish_w > 0 else 0.5
    rel_y = (patch_y - fish_y) / fish_h if fish_h > 0 else 0.5
    
    # Classify based on position
    if rel_x < 0.25:
        return "head"
    elif rel_x > 0.75:
        return "tail"
    elif rel_y < 0.5:
        return "body_upper"
    else:
        return "belly"


def find_mold_contours(mold_mask: np.ndarray, min_area: int = 10) -> List:
    """
    Find individual mold patch contours.
    
    Args:
        mold_mask: Binary mask of mold patches
        min_area: Minimum contour area to consider
        
    Returns:
        List of contours
    """
    contours, _ = cv2.findContours(mold_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return [c for c in contours if cv2.contourArea(c) >= min_area]


def analyze_mold_characteristics(img: np.ndarray, mold_mask: np.ndarray, fish_mask: np.ndarray) -> Dict:
    """
    Analyze characteristics of detected mold patches.
    
    Returns:
        dict with mold characteristics (color profile, texture)
    """
    mold_pixels = img[mold_mask > 0]
    if mold_pixels.size == 0:
        return {
            "dominant_color": None,
            "color_variance": 0,
            "avg_darkness": 0
        }
    
    # Reshape for analysis
    mold_pixels = mold_pixels.reshape(-1, 3)
    
    # Calculate average color (BGR)
    avg_color = np.mean(mold_pixels, axis=0)
    
    # Convert to HSV for better color description
    avg_color_img = avg_color.reshape(1, 1, 3).astype(np.uint8)
    avg_hsv = cv2.cvtColor(avg_color_img, cv2.COLOR_BGR2HSV)[0, 0]
    
    # Classify dominant color
    h, s, v = avg_hsv
    if s < 30:
        dominant_color = "gray"
    elif h < 15 or h > 165:
        dominant_color = "red-brown"
    elif 15 <= h < 45:
        dominant_color = "yellow-brown"
    elif 45 <= h < 75:
        dominant_color = "green"
    elif 75 <= h < 105:
        dominant_color = "blue-green"
    else:
        dominant_color = "blue"
    
    # Calculate color variance
    color_variance = float(np.mean(np.std(mold_pixels, axis=0)))
    
    # Calculate average darkness
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mold_gray = gray[mold_mask > 0]
    avg_darkness = 255 - float(np.mean(mold_gray)) if mold_gray.size > 0 else 0
    
    return {
        "dominant_color": dominant_color,
        "color_variance": round(color_variance, 2),
        "avg_darkness": round(avg_darkness, 1),
        "avg_hsv": [int(h), int(s), int(v)]
    }


def get_mold_coordinates(mold_mask: np.ndarray, offset: Tuple[int, int] = (0, 0)) -> List[Dict]:
    """
    Get coordinates of mold patches for visualization.
    
    Returns:
        List of patch info with bounding boxes
    """
    contours = find_mold_contours(mold_mask)
    patches = []
    
    for i, contour in enumerate(contours):
        x, y, w, h = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)
        
        patches.append({
            "id": int(i),
            "x": int(x + offset[0]),
            "y": int(y + offset[1]),
            "width": int(w),
            "height": int(h),
            "area": int(area)
        })
    
    return patches


def aggregate_mold_results(fish_results: List[Dict], image_shape: Tuple[int, int]) -> Dict:
    """
    Aggregate mold analysis results across all detected fish.
    
    Args:
        fish_results: List of individual fish mold analysis results
        image_shape: (height, width) of the image
        
    Returns:
        Aggregated mold analysis results
    """
    if not fish_results:
        return create_empty_mold_result()
    
    # Calculate overall metrics
    total_coverage = sum(r["mold_coverage_percent"] for r in fish_results)
    avg_coverage = float(total_coverage / len(fish_results))
    
    # Count fish with mold detected
    fish_with_mold = int(sum(1 for r in fish_results if r["mold_detected"]))
    
    # Determine overall severity (worst case)
    severity_priority = {"Severe": 4, "Moderate": 3, "Low": 2, "None": 1}
    severities = [r["severity"] for r in fish_results]
    overall_severity = max(severities, key=lambda x: severity_priority.get(x, 0))
    
    # Aggregate spatial distribution
    spatial_summary = aggregate_spatial_data(fish_results)
    
    # Total patch count
    total_patches = int(sum(r["patch_count"] for r in fish_results))
    
    # Collect all mold characteristics
    characteristics_summary = aggregate_characteristics(fish_results)
    
    return {
        "overall_severity": overall_severity,
        "avg_coverage_percent": round(avg_coverage, 2),
        "fish_analyzed": int(len(fish_results)),
        "fish_with_mold": fish_with_mold,
        "total_patches": total_patches,
        "fish_results": fish_results,
        "spatial_summary": spatial_summary,
        "characteristics": characteristics_summary,
        "analysis_method": "segmentation" if len(fish_results) > 0 else "none"
    }


def aggregate_spatial_data(fish_results: List[Dict]) -> Dict:
    """
    Aggregate spatial distribution data across all fish.
    """
    zone_summary = {
        "head": {"total_patches": 0, "total_coverage": 0, "fish_affected": 0},
        "body_upper": {"total_patches": 0, "total_coverage": 0, "fish_affected": 0},
        "belly": {"total_patches": 0, "total_coverage": 0, "fish_affected": 0},
        "tail": {"total_patches": 0, "total_coverage": 0, "fish_affected": 0}
    }
    
    for fish_result in fish_results:
        spatial_data = fish_result.get("spatial_distribution", {})
        zones = spatial_data.get("zones", {})
        
        for zone_name, zone_data in zones.items():
            if zone_name in zone_summary:
                patch_count = zone_data.get("patch_count", 0)
                zone_summary[zone_name]["total_patches"] += patch_count
                zone_summary[zone_name]["total_coverage"] += zone_data.get("coverage_pixels", 0)
                if patch_count > 0:
                    zone_summary[zone_name]["fish_affected"] += 1
    
    # Ensure all values are native Python types
    for zone_name in zone_summary:
        zone_summary[zone_name]["total_patches"] = int(zone_summary[zone_name]["total_patches"])
        zone_summary[zone_name]["total_coverage"] = int(zone_summary[zone_name]["total_coverage"])
        zone_summary[zone_name]["fish_affected"] = int(zone_summary[zone_name]["fish_affected"])
    
    # Determine most affected zone
    most_affected = max(zone_summary.keys(), 
                       key=lambda z: zone_summary[z]["total_patches"])
    
    return {
        "zones": zone_summary,
        "total_fish_analyzed": int(len(fish_results)),
        "most_affected_zone": most_affected if zone_summary[most_affected]["total_patches"] > 0 else None
    }


def aggregate_characteristics(fish_results: List[Dict]) -> Dict:
    """
    Aggregate mold characteristics across all fish.
    """
    dominant_colors = []
    total_darkness = 0
    count = 0
    
    for result in fish_results:
        chars = result.get("characteristics", {})
        if chars.get("dominant_color"):
            dominant_colors.append(chars["dominant_color"])
            total_darkness += chars.get("avg_darkness", 0)
            count += 1
    
    # Find most common color
    if dominant_colors:
        from collections import Counter
        color_counts = Counter(dominant_colors)
        most_common_color = color_counts.most_common(1)[0][0]
    else:
        most_common_color = None
    
    return {
        "most_common_color": most_common_color,
        "avg_darkness": round(float(total_darkness / count), 1) if count > 0 else 0.0,
        "color_distribution": dict(Counter(dominant_colors)) if dominant_colors else {}
    }


def create_empty_mold_result() -> Dict:
    """
    Create an empty mold analysis result structure.
    """
    return {
        "overall_severity": "None",
        "avg_coverage_percent": 0.0,
        "fish_analyzed": 0,
        "fish_with_mold": 0,
        "total_patches": 0,
        "fish_results": [],
        "spatial_summary": {
            "zones": {
                "head": {"total_patches": 0, "total_coverage": 0, "fish_affected": 0},
                "body_upper": {"total_patches": 0, "total_coverage": 0, "fish_affected": 0},
                "belly": {"total_patches": 0, "total_coverage": 0, "fish_affected": 0},
                "tail": {"total_patches": 0, "total_coverage": 0, "fish_affected": 0}
            },
            "total_fish_analyzed": 0,
            "most_affected_zone": None
        },
        "characteristics": {
            "most_common_color": None,
            "avg_darkness": 0,
            "color_distribution": {}
        },
        "analysis_method": "none"
    }
