// CommonJS 格式
const fs = require('fs');
const path = require('path');

const mapsDir = path.join(__dirname, '..', 'public', 'maps');

// 为每个检测到的区域生成简化的 polygon（基于 center 的矩形框）
const files = [
    { input: 'nanzih-areas-detected.json', output: 'nanzih-areas-with-polygons.json' },
    { input: 'chiaotou-areas-detected.json', output: 'chiaotou-areas-with-polygons.json' },
    { input: 'tzuguan-areas-detected.json', output: 'tzuguan-areas-with-polygons.json' }
];

files.forEach(function(file) {
    var inputPath = path.join(mapsDir, file.input);
    var outputPath = path.join(mapsDir, file.output);
    
    if (!fs.existsSync(inputPath)) {
        console.log('⚠️  找不到: ' + file.input);
        return;
    }
    
    console.log('處理: ' + file.input);
    
    var data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    if (!data.areas || !Array.isArray(data.areas)) {
        console.log('❌ 無效格式');
        return;
    }
    
    // 为每个区域生成 polygon
    data.areas.forEach(function(area) {
        if (!area.polygon && area.center) {
            var centerY = area.center[0];
            var centerX = area.center[1];
            
            // 根据区域大小调整框的大小
            var boxSize = 150; // 默认 150 像素
            
            // 如果有 pixelCount，可以根据面积调整框的大小
            if (area.pixelCount) {
                boxSize = Math.sqrt(area.pixelCount) * 0.6; // 面积平方根的 60%
                boxSize = Math.max(50, Math.min(300, boxSize)); // 限制在 50-300 之间
            }
            
            // 生成矩形 polygon [y, x]
            area.polygon = [
                [centerY - boxSize/2, centerX - boxSize/2],
                [centerY - boxSize/2, centerX + boxSize/2],
                [centerY + boxSize/2, centerX + boxSize/2],
                [centerY + boxSize/2, centerX - boxSize/2],
                [centerY - boxSize/2, centerX - boxSize/2] // 閉合
            ];
        }
    });
    
    // 更新文件
    var output = {
        imageSize: data.imageSize,
        totalDetected: data.totalDetected || data.areas.length,
        selectedCount: data.areas.length,
        areas: data.areas
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log('  ✅ 已保存: ' + file.output);
    console.log('     檔案大小: ' + (fs.statSync(outputPath).size / 1024).toFixed(1) + ' KB');
});

console.log('\n🎉 完成！');
