/**
 * 将检测结果转换为标注工具可用的格式
 * 为每个区域生成一个简单的矩形 polygon（基于 center）
 */

const fs = require('fs');
const path = require('path');

function convertToEditableFormat(inputPath, outputPath, boxSize = 50) {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    console.log(`處理: ${path.basename(inputPath)}`);
    console.log(`區域數: ${data.areas.length}`);
    
    const output = {
        imageSize: data.imageSize,
        totalAreas: data.areas.length,
        areas: data.areas.map(area => {
            const center = area.center || [area.center.y, area.center.x];
            const cy = center[0];
            const cx = center[1];
            
            // 生成简单的矩形 polygon
            const polygon = [
                [cy - boxSize, cx - boxSize],
                [cy - boxSize, cx + boxSize],
                [cy + boxSize, cx + boxSize],
                [cy + boxSize, cx - boxSize],
                [cy - boxSize, cx - boxSize] // 闭合
            ];
            
            return {
                id: area.id,
                center: center,
                polygon: polygon,
                pixelCount: area.pixelCount
            };
        })
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`✅ 已轉換: ${outputPath}`);
    console.log(`   檔案大小: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

const mapsDir = path.join(__dirname, '..', 'public', 'maps');

// 转换三个地图
[
    { input: 'nanzih-areas-detected.json', output: 'nanzih-areas-editable.json' },
    { input: 'chiaotou-areas-detected.json', output: 'chiaotou-areas-editable.json' },
    { input: 'tzuguan-areas-detected.json', output: 'tzuguan-areas-editable.json' }
].forEach(({ input, output }) => {
    const inputPath = path.join(mapsDir, input);
    const outputPath = path.join(mapsDir, output);
    
    if (fs.existsSync(inputPath)) {
        convertToEditableFormat(inputPath, outputPath);
    } else {
        console.log(`⚠️  找不到: ${input}`);
    }
});

console.log('\n🎉 轉換完成！');
console.log('\n下一步：');
console.log('1. 在瀏覽器中打開標註工具');
console.log('2. 載入 *_editable.json 文件');
console.log('3. 調整不準確的區域');
console.log('4. 導出最終 JSON');
