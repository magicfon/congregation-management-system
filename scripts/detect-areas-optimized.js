/**
 * 改进的区域检测算法
 * 策略：检测所有区域 → 按面积排序 → 只保留最大的 N 个
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractAreasFromBoundaries(imagePath, expectedCount, outputPath) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`處理: ${path.basename(imagePath)}`);
    console.log(`預期區域數: ${expectedCount}`);
    console.log('='.repeat(60));
    
    // 讀取邊界線圖片
    const { data, info } = await sharp(imagePath)
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const { width, height, channels } = info;
    console.log(`📐 圖片尺寸: ${width} x ${height}`);
    
    // 統計黑白像素
    let whitePixels = 0;
    let blackPixels = 0;
    
    for (let i = 0; i < data.length; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (r > 200 && g > 200 && b > 200) {
            whitePixels++;
        } else {
            blackPixels++;
        }
    }
    
    console.log(`⚪ 白色邊界線: ${whitePixels.toLocaleString()} (${(whitePixels / (width * height) * 100).toFixed(2)}%)`);
    console.log(`⚫ 黑色區域: ${blackPixels.toLocaleString()} (${(blackPixels / (width * height) * 100).toFixed(2)}%)`);
    
    // 種子填充算法
    const visited = new Uint8Array(width * height);
    const areas = [];
    const step = 30; // 採樣間距
    const minArea = 5000; // 最小面積（過濾噪點）
    
    let detectedCount = 0;
    
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = y * width + x;
            
            if (visited[idx]) continue;
            
            // 檢查是否為黑色（區域內部）
            const pixelIdx = idx * channels;
            const r = data[pixelIdx];
            const g = data[pixelIdx + 1];
            const b = data[pixelIdx + 2];
            
            if (r > 200 && g > 200 && b > 200) {
                // 白色邊界線，跳過
                visited[idx] = 1;
                continue;
            }
            
            // 種子填充
            const areaPixels = floodFill(data, width, height, channels, x, y, visited, 100000);
            
            if (areaPixels.length >= minArea) {
                detectedCount++;
                
                // 計算中心點
                const center = calculateCenter(areaPixels);
                
                // 提取邊界
                const boundary = extractBoundary(areaPixels, width, height, data, channels);
                
                areas.push({
                    center: center,
                    boundary: boundary,
                    pixelCount: areaPixels.length
                });
                
                if (detectedCount % 10 === 0) {
                    console.log(`  已檢測到 ${detectedCount} 個區域...`);
                }
            }
        }
    }
    
    console.log(`\n✅ 總共檢測到 ${areas.length} 個區域`);
    
    // 按面積排序（從大到小）
    areas.sort((a, b) => b.pixelCount - a.pixelCount);
    
    // 只保留最大的 N 個
    const selectedAreas = areas.slice(0, expectedCount);
    
    console.log(`📊 選擇最大的 ${selectedAreas.length} 個區域`);
    
    // 按位置重新排序（從左到右，從上到下）
    selectedAreas.sort((a, b) => {
        if (Math.abs(a.center.y - b.center.y) < 100) {
            return a.center.x - b.center.x;
        }
        return a.center.y - b.center.y;
    });
    
    // 簡化邊界並分配 ID
    selectedAreas.forEach((area, index) => {
        area.id = index + 1;
        area.simplifiedBoundary = simplifyBoundary(area.boundary, 50);
        delete area.boundary; // 移除原始邊界
    });
    
    // 保存結果
    const output = {
        imageSize: [width, height],
        totalDetected: areas.length,
        selectedCount: selectedAreas.length,
        areas: selectedAreas.map(a => ({
            id: a.id,
            center: [a.center.y, a.center.x], // [y, x] for Leaflet
            polygon: a.simplifiedBoundary.map(p => [p[1], p[0]]), // [[y, x], ...]
            pixelCount: a.pixelCount
        }))
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 已保存: ${outputPath}`);
    console.log(`   檔案大小: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
    
    return selectedAreas.length;
}

// 種子填充算法
function floodFill(data, width, height, channels, startX, startY, visited, maxPixels) {
    const pixels = [];
    const queue = [[startX, startY]];
    
    while (queue.length > 0 && pixels.length < maxPixels) {
        const [x, y] = queue.shift();
        
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        
        const idx = y * width + x;
        if (visited[idx]) continue;
        
        const pixelIdx = idx * channels;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        
        // 白色邊界線
        if (r > 200 && g > 200 && b > 200) continue;
        
        visited[idx] = 1;
        pixels.push([x, y]);
        
        queue.push([x + 1, y]);
        queue.push([x - 1, y]);
        queue.push([x, y + 1]);
        queue.push([x, y - 1]);
    }
    
    return pixels;
}

// 計算中心點
function calculateCenter(pixels) {
    const sumX = pixels.reduce((sum, [x, y]) => sum + x, 0);
    const sumY = pixels.reduce((sum, [x, y]) => sum + y, 0);
    
    return {
        x: Math.round(sumX / pixels.length),
        y: Math.round(sumY / pixels.length)
    };
}

// 提取邊界
function extractBoundary(pixels, width, height, data, channels) {
    const pixelSet = new Set(pixels.map(([x, y]) => `${x},${y}`));
    const boundary = [];
    
    pixels.forEach(([x, y]) => {
        const neighbors = [
            [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
            [x + 1, y + 1], [x - 1, y - 1], [x - 1, y + 1], [x + 1, y - 1]
        ];
        
        const isBoundary = neighbors.some(([nx, ny]) => {
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                return true;
            }
            return !pixelSet.has(`${nx},${ny}`);
        });
        
        if (isBoundary) {
            boundary.push([x, y]);
        }
    });
    
    return boundary;
}

// 簡化邊界
function simplifyBoundary(boundary, step) {
    if (boundary.length < step) return boundary;
    
    const simplified = [];
    
    for (let i = 0; i < boundary.length; i += step) {
        simplified.push(boundary[i]);
    }
    
    // 確保閉合
    if (simplified.length > 0 && 
        (simplified[0][0] !== simplified[simplified.length - 1][0] ||
         simplified[0][1] !== simplified[simplified.length - 1][1])) {
        simplified.push(simplified[0]);
    }
    
    return simplified;
}

async function main() {
    const mapsDir = path.join(__dirname, '..', 'public', 'maps');
    
    const maps = [
        { 
            input: 'nanzih-boundaries.png', 
            output: 'nanzih-areas-detected.json',
            expected: 89
        },
        { 
            input: 'chiaotou-boundaries.png', 
            output: 'chiaotou-areas-detected.json',
            expected: 59
        },
        { 
            input: 'tzuguan-boundaries.png', 
            output: 'tzuguan-areas-detected.json',
            expected: 65
        }
    ];
    
    for (const map of maps) {
        const inputPath = path.join(mapsDir, map.input);
        const outputPath = path.join(mapsDir, map.output);
        
        if (fs.existsSync(inputPath)) {
            await extractAreasFromBoundaries(inputPath, map.expected, outputPath);
        } else {
            console.log(`⚠️  找不到: ${map.input}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 檢測完成！');
    console.log('='.repeat(60));
    console.log('\n下一步：');
    console.log('1. 在瀏覽器中查看檢測結果');
    console.log('2. 使用標註工具調整不準確的區域');
    console.log('3. 導出調整後的 JSON 並更新');
}

main().catch(console.error);
