/**
 * 基於地圖編號生成區域 Polygon 數據
 * 
 * 假設：
 * 1. 區域按編號順序排列（從左到右，從上到下）
 * 2. 地圖尺寸已知
 * 3. 可以手動調整特殊區域的位置
 */

const fs = require('fs');
const path = require('path');

// 地圖配置
const maps = [
  {
    name: '楠梓區',
    range: [1, 89],
    imageSize: [7884, 5512], // 從實際圖片獲取
    gridSize: [10, 9], // 10 列 x 9 行 = 90 個格子（實際 89 個區域）
    outputFile: 'nanzih-areas.json'
  },
  {
    name: '橋頭',
    range: [90, 148],
    imageSize: [4827, 4534],
    gridSize: [8, 8], // 8 列 x 8 行 = 64 個格子（實際 59 個區域）
    outputFile: 'chiaotou-areas.json'
  },
  {
    name: '梓官',
    range: [149, 213],
    imageSize: [4828, 4038],
    gridSize: [10, 7], // 10 列 x 7 行 = 70 個格子（實際 65 個區域）
    outputFile: 'tzuguan-areas.json'
  }
];

/**
 * 為單個地圖生成區域 polygons
 */
function generatePolygons(config) {
  const [width, height] = config.imageSize;
  const [cols, rows] = config.gridSize;
  const [startId, endId] = config.range;
  
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const padding = 5; // 邊距
  
  const areas = [];
  let currentId = startId;
  
  for (let row = 0; row < rows && currentId <= endId; row++) {
    for (let col = 0; col < cols && currentId <= endId; col++) {
      const x1 = col * cellWidth + padding;
      const y1 = row * cellHeight + padding;
      const x2 = (col + 1) * cellWidth - padding;
      const y2 = (row + 1) * cellHeight - padding;
      
      // Polygon 座標（Leaflet 格式：[y, x]）
      const polygon = [
        [y1, x1],
        [y1, x2],
        [y2, x2],
        [y2, x1]
      ];
      
      areas.push({
        id: currentId.toString(),
        polygon: polygon,
        center: [(y1 + y2) / 2, (x1 + x2) / 2],
        bounds: [[y1, x1], [y2, x2]]
      });
      
      currentId++;
    }
  }
  
  return {
    mapName: config.name,
    imageSize: config.imageSize,
    gridSize: config.gridSize,
    areas: areas
  };
}

// 生成所有地圖的區域數據
maps.forEach(config => {
  const data = generatePolygons(config);
  const outputPath = path.join(__dirname, '..', 'public', 'maps', config.outputFile);
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`✅ ${config.name}: ${data.areas.length} 個區域 → ${config.outputFile}`);
});

console.log('\n完成！請檢查 public/maps/*.json 文件');
