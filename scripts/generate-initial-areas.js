/**
 * 使用 Grid 假設法生成初始區域數據
 * 用戶可以在瀏覽器中調整不準確的區域
 */

const fs = require('fs');
const path = require('path');

// 地圖配置（根據實際情況調整）
const maps = [
  {
    name: '楠梓區',
    range: [1, 89],
    imageSize: [7884, 5512],
    gridSize: [10, 9], // 10 列 x 9 行
    padding: 10,
    outputFile: 'nanzih-areas.json'
  },
  {
    name: '橋頭',
    range: [90, 148],
    imageSize: [4827, 4534],
    gridSize: [8, 8], // 8 列 x 8 行
    padding: 10,
    outputFile: 'chiaotou-areas.json'
  },
  {
    name: '梓官',
    range: [149, 213],
    imageSize: [4828, 4038],
    gridSize: [10, 7], // 10 列 x 7 行
    padding: 10,
    outputFile: 'tzuguan-areas.json'
  }
];

function generateAreas(config) {
  const [width, height] = config.imageSize;
  const [cols, rows] = config.gridSize;
  const [startId, endId] = config.range;
  const padding = config.padding;
  
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  
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
        [y2, x1],
        [y1, x1] // 閉合
      ];
      
      areas.push({
        id: currentId,
        center: [(y1 + y2) / 2, (x1 + x2) / 2],
        polygon: polygon,
        bbox: [x1, y1, x2 - x1, y2 - y1]
      });
      
      currentId++;
    }
  }
  
  return {
    mapName: config.name,
    imageSize: config.imageSize,
    gridSize: config.gridSize,
    totalAreas: areas.length,
    range: config.range,
    areas: areas
  };
}

// 生成所有地圖
const mapsDir = path.join(__dirname, '..', 'public', 'maps');

maps.forEach(config => {
  const data = generateAreas(config);
  const outputPath = path.join(mapsDir, config.outputFile);
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`✅ ${config.name}: ${data.totalAreas} 個區域 (ID ${config.range[0]}-${config.range[1]})`);
  console.log(`   Grid: ${config.gridSize[0]} x ${config.gridSize[1]}`);
  console.log(`   Cell: ${Math.round(config.imageSize[0] / config.gridSize[0])} x ${Math.round(config.imageSize[1] / config.gridSize[1])} px`);
  console.log(`   保存到: ${config.outputFile}\n`);
});

console.log('🎉 完成！');
console.log('\n下一步：');
console.log('1. 在瀏覽器中查看地圖熱力圖');
console.log('2. 使用標註工具調整不準確的區域');
console.log('3. 導出調整後的 JSON 並替換現有文件');
