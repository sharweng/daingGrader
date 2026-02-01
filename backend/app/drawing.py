"""
Image Drawing/Visualization Module
===================================
Functions for drawing segmentation masks, bounding boxes,
and analysis overlays on detection result images.
"""

import cv2
import numpy as np


def draw_segmentation_results(img: np.ndarray, results, indices: list, model) -> np.ndarray:
    """
    Draw segmentation masks and labels on the image.
    Creates a semi-transparent colored overlay for each fish.
    
    Args:
        img: Original BGR image
        results: YOLO inference results
        indices: List of detection indices to draw
        model: YOLO model for class names
        
    Returns:
        Annotated image with masks and labels
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


def draw_detection_boxes(img: np.ndarray, results, indices: list, model) -> np.ndarray:
    """
    Draw bounding boxes for detection display.
    
    Args:
        img: Original BGR image
        results: YOLO inference results
        indices: List of detection indices to draw
        model: YOLO model for class names
        
    Returns:
        Annotated image with bounding boxes
    """
    annotated_img = img.copy()
    boxes = results[0].boxes
    
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
    
    Args:
        img: Original BGR image
        results: YOLO inference results
        indices: List of detection indices to draw
        model: YOLO model for class names
        color_analysis: Optional color consistency analysis results
        
    Returns:
        Combined annotated image
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
    grade_color = (255, 255, 255)  # Default white
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


def draw_no_detection_image(img: np.ndarray) -> np.ndarray:
    """
    Draw 'NO DAING DETECTED' overlay on image.
    
    Args:
        img: Original BGR image
        
    Returns:
        Image with no detection message overlay
    """
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
    
    return result_img
