import cv2
import numpy as np
import json
import sys

def extract_zones_to_json(image_path, output_json_path):
    # 1. 讀取圖片
    img = cv2.imread(image_path)
    if img is None:
        print(f"找不到圖片：{image_path}")
        return 0
    
    print(f"圖片尺寸: {img.shape[1]} x {img.shape[0]}")
    
    # 2. 轉換為 HSV
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # 3. 測試多個紫色範圍
    # 紫色在 HSV 中通常是 H: 130-170, S: 50-255, V: 50-255
    
    # 方法 1: 寬鬆的紫色範圍
    lower_purple1 = np.array([120, 30, 30])
    upper_purple1 = np.array([180, 255, 255])
    
    # 方法 2: 更寬鬆的範圍（包括藍紫色）
    lower_purple2 = np.array([100, 20, 20])
    upper_purple2 = np.array([180, 255, 255])
    
    # 方法 3: 檢測所有非白色/非黑色像素
    # 假設紫色是中等亮度的顏色
    lower_color = np.array([0, 20, 20])
    upper_color = np.array([180, 255, 255])
    
    # 使用方法 2
    mask = cv2.inRange(hsv, lower_purple2, upper_purple2)
    
    # 計算紫色像素數量
    purple_pixels = cv2.countNonZero(mask)
    total_pixels = img.shape[0] * img.shape[1]
    print(f"紫色像素: {purple_pixels:,} ({(purple_pixels / total_pixels * 100):.2f}%)")
    
    # 4. 形態學處理
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)
    mask = cv2.erode(mask, kernel, iterations=1)
    
    # 5. 尋找輪廓
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    
    print(f"檢測到 {len(contours)} 個輪廓")
    
    # 6. 過濾和簡化輪廓
    zones_data = {
        "type": "PixelFeatureCollection",
        "features": []
    }
    zone_id = 1
    
    # 收集所有有效輪廓
    valid_contours = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        # 調整面積閾值
        if area > 500:  # 降低閾值
            valid_contours.append((area, cnt))
    
    # 按面積排序
    valid_contours.sort(reverse=True, key=lambda x: x[0])
    
    print(f"有效區域（面積 > 500）: {len(valid_contours)} 個")
    
    # 只取前 100 個最大的區域
    for area, cnt in valid_contours[:100]:
        # 簡化多邊形
        epsilon = 0.01 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        
        # 轉換座標
        points = []
        for pt in approx:
            x, y = int(pt[0][0]), int(pt[0][1])
            points.append([x, y])
        
        # 確保封閉
        if len(points) > 0 and points[0] != points[-1]:
            points.append(points[0])
        
        if len(points) >= 4:  # 至少是三角形（含閉合點）
            feature = {
                "id": str(zone_id),
                "geometry": {
                    "type": "Polygon",
                    "pixel_coordinates": [points]
                },
                "properties": {
                    "area": int(area)
                }
            }
            zones_data["features"].append(feature)
            zone_id += 1
    
    # 7. 輸出 JSON
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(zones_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 成功！共擷取了 {zone_id - 1} 個區塊")
    print(f"💾 已儲存至: {output_json_path}")
    
    return zone_id - 1

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("用法: python3 extract-zones-cv2.py <輸入圖片> <輸出JSON>")
        sys.exit(1)
    
    input_image = sys.argv[1]
    output_json = sys.argv[2]
    
    extract_zones_to_json(input_image, output_json)
