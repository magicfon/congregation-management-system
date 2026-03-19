import json
import sys

def convert_cv2_to_marker(input_json, output_json):
    """将 CV2 检测结果转换为标注工具格式"""
    
    with open(input_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    print(f"读取到 {len(features)} 个区域")
    
    # 按面积排序（从大到小）
    features.sort(key=lambda x: x.get('properties', {}).get('area', 0), reverse=True)
    
    areas = []
    for i, feature in enumerate(features):
        coords = feature['geometry']['pixel_coordinates'][0]
        
        # 计算中心点
        x_coords = [p[0] for p in coords]
        y_coords = [p[1] for p in coords]
        center_x = sum(x_coords) / len(x_coords)
        center_y = sum(y_coords) / len(y_coords)
        
        # 转换为标注工具格式
        # 标注工具使用 [y, x] 格式
        area_data = {
            "id": i + 1,
            "center": [center_y, center_x],
            "polygon": [[p[1], p[0]] for p in coords],  # [y, x]
            "area": feature.get('properties', {}).get('area', 0)
        }
        
        areas.append(area_data)
    
    # 保存
    output = {
        "totalAreas": len(areas),
        "areas": areas
    }
    
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 已转换为标注工具格式: {output_json}")
    print(f"   区域数量: {len(areas)}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("用法: python3 convert-cv2-to-marker.py <输入JSON> <输出JSON>")
        sys.exit(1)
    
    convert_cv2_to_marker(sys.argv[1], sys.argv[2])
