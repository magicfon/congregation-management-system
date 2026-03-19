#!/usr/bin/env python3
"""
沿著邊界線提取每個區域的 polygon 座標
用於 Leaflet 地圖顯示
"""

import cv2
import numpy as np
import json
import sys
from pathlib import Path

def extract_area_polygons(image_path, output_json):
    """從邊界線圖片中提取每個區域的 polygon"""
    
    print(f"處理圖片: {image_path}")
    
    # 讀取邊界線圖片（黑白）
    img = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        print(f"錯誤: 無法讀取圖片 {image_path}")
        return None
    
    print(f"圖片尺寸: {img.shape}")
    
    # 二值化
    _, binary = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
    
    # 找輪廓
    contours, hierarchy = cv2.findContours(
        binary, 
        cv2.RETR_CCOMP,  # 使用兩層級層次結構
        cv2.CHAIN_APPROX_SIMPLE
    )
    
    print(f"找到 {len(contours)} 個輪廓")
    
    # 過濾區域
    img_area = img.shape[0] * img.shape[1]
    min_area = img_area * 0.0001  # 最小 0.01%
    max_area = img_area * 0.3     # 最大 30%
    
    areas = []
    
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        
        # 過濾太大或太小的區域
        if area < min_area or area > max_area:
            continue
        
        # 獲取邊界框
        x, y, w, h = cv2.boundingRect(contour)
        
        # 計算中心點
        center_x = x + w // 2
        center_y = y + h // 2
        
        # 簡化輪廓
        epsilon = 0.005 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # 轉換為 [y, x] 格式（Leaflet 使用 [lat, lng]）
        polygon = []
        for point in approx:
            px, py = point[0]
            polygon.append([float(py), float(px)])
        
        # 確保 polygon 是封閉的
        if len(polygon) > 2 and polygon[0] != polygon[-1]:
            polygon.append(polygon[0])
        
        areas.append({
            'contour_id': i,
            'bbox': [x, y, w, h],
            'center': [center_y, center_x],
            'area': area,
            'polygon': polygon
        })
    
    print(f"過濾後剩餘 {len(areas)} 個區域")
    
    # 按面積排序（假設面積相近的區域是連續的）
    areas.sort(key=lambda a: a['area'], reverse=True)
    
    # 保存結果
    output = {
        'image_size': [img.shape[1], img.shape[0]],  # [width, height]
        'total_areas': len(areas),
        'areas': areas
    }
    
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"✅ 結果已保存到: {output_json}")
    
    # 繪製調試圖片
    debug_img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    
    for i, area in enumerate(areas):
        # 繪製 polygon
        pts = np.array([[int(p[1]), int(p[0])] for p in area['polygon']], np.int32)
        cv2.polylines(debug_img, [pts], True, (0, 255, 0), 2)
        
        # 繪製編號
        cx, cy = area['center'][1], area['center'][0]
        cv2.putText(debug_img, str(i+1), (int(cx), int(cy)), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
    
    debug_path = str(output_json).replace('.json', '_debug.png')
    cv2.imwrite(debug_path, debug_img)
    print(f"✅ 調試圖片已保存到: {debug_path}")
    
    return areas

if __name__ == '__main__':
    maps_dir = Path('/home/node/.openclaw/workspace/projects/congregation-management-system/public/maps')
    
    # 處理三張地圖
    maps = [
        ('nanzih-boundaries.png', 'nanzih-areas.json'),
        ('chiaotou-boundaries.png', 'chiaotou-areas.json'),
        ('tzuguan-boundaries.png', 'tzuguan-areas.json')
    ]
    
    for input_file, output_file in maps:
        input_path = maps_dir / input_file
        output_path = maps_dir / output_file
        
        if input_path.exists():
            print(f"\n{'='*60}")
            extract_area_polygons(input_path, output_path)
        else:
            print(f"⚠️ 跳過: {input_path} 不存在")
