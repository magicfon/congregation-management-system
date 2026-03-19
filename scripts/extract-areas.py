#!/usr/bin/env python3
"""
從地圖圖片中提取區域邊界線和編號
使用 OpenCV 進行邊緣檢測和輪廓提取
"""

import cv2
import numpy as np
import json
from pathlib import Path

def extract_areas(image_path, output_path):
    """提取地圖中的區域邊界線和編號"""
    
    # 讀取圖片
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"無法讀取圖片: {image_path}")
        return None
    
    print(f"圖片大小: {img.shape}")
    
    # 轉換為 HSV 色彩空間，更容易分離藍紫色
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # 定義藍紫色的 HSV 範圍
    # 藍紫色: H=130-170, S=50-255, V=50-255
    lower_purple = np.array([120, 30, 30])
    upper_purple = np.array([180, 255, 255])
    
    # 創建藍紫色遮罩
    mask = cv2.inRange(hsv, lower_purple, upper_purple)
    
    # 形態學操作：閉運算（連接斷開的線）
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    
    # 邊緣檢測
    edges = cv2.Canny(mask, 50, 150, apertureSize=3)
    
    # 找輪廓
    contours, hierarchy = cv2.findContours(
        edges, 
        cv2.RETR_TREE, 
        cv2.CHAIN_APPROX_SIMPLE
    )
    
    print(f"找到 {len(contours)} 個輪廓")
    
    # 過濾輪廓：只保留合理的區域
    min_area = 1000  # 最小面積
    max_area = img.shape[0] * img.shape[1] * 0.5  # 最大面積（圖片的一半）
    
    areas = []
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        
        if min_area < area < max_area:
            # 簡化輪廓
            epsilon = 0.01 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # 獲取邊界框
            x, y, w, h = cv2.boundingRect(contour)
            
            # 提取區域中心（用於 OCR）
            center_x = x + w // 2
            center_y = y + h // 2
            
            areas.append({
                'id': i,
                'contour': approx.tolist(),
                'bbox': [x, y, w, h],
                'center': [center_x, center_y],
                'area': area
            })
    
    print(f"過濾後剩餘 {len(areas)} 個有效區域")
    
    # 保存結果
    output = {
        'image_size': [img.shape[1], img.shape[0]],
        'areas': areas
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"結果已保存到: {output_path}")
    
    # 繪製調試圖片
    debug_img = img.copy()
    cv2.drawContours(debug_img, contours, -1, (0, 255, 0), 2)
    
    for area in areas:
        x, y, w, h = area['bbox']
        cv2.rectangle(debug_img, (x, y), (x+w, y+h), (255, 0, 0), 2)
    
    debug_path = str(output_path).replace('.json', '_debug.png')
    cv2.imwrite(debug_path, debug_img)
    print(f"調試圖片已保存到: {debug_path}")
    
    return output

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 3:
        print("用法: python extract-areas.py <input_image> <output_json>")
        sys.exit(1)
    
    input_image = sys.argv[1]
    output_json = sys.argv[2]
    
    result = extract_areas(input_image, output_json)
    
    if result:
        print(f"\n成功提取 {len(result['areas'])} 個區域")
