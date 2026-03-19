/**
 * 从边界线图片中提取区域 polygons
 * 边界线图片：黑色背景，白色边界线
 * 需要找到黑色连通区域（不是白色边界线）
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractAreasFromBoundaries(imagePath, outputPath) {
    console.log(`\n處理: ${path.basename(imagePath)}`);
    
    // 讀取圖片
    const { data, info } = await sharp(imagePath)
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const { width, height, channels } = info;
    console.log(`尺寸: ${width} x ${height}`);
    console.log(`通道: ${channels}`);
    
    // 統計黑白像素
    let whitePixels = 0;
    let blackPixels = 0;
    
    for (let i = 0; i < data.length; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // 白色邊界線
        if (r > 200 && g > 200 && b > 200) {
            whitePixels++;
        } else {
            blackPixels++;
        }
    }
    
    console.log(`白色像素（邊界線）: ${whitePixels.toLocaleString()} (${(whitePixels / (width * height) * 100).toFixed(2)}%)`);
    console.log(`黑色像素（區域內部）: ${blackPixels.toLocaleString()} (${(blackPixels / (width * height) * 100).toFixed(2)}%)`);
    
    // 使用種子填充算法找到黑色連通區域
    const visited = new Uint8Array(width * height);
    const areas = [];
    
    // 採樣間距
    const step = 50;
    let areaCount = 0;
    
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = y * width + x;
            
            // 跳過已訪問或邊界線
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
            
            // 找到新區域，使用種子填充
            const areaPixels = floodFill(data, width, height, channels, x, y, visited);
            
            if (areaPixels.length > 500) {
                areaCount++;
                
                // 計算中心點和邊界
                const center = calculateCenter(areaPixels);
                const boundary = extractBoundary(areaPixels, width, height, data, channels);
                
                areas.push({
                    id: areaCount,
                    center: center,
                    boundary: boundary,
                    pixelCount: areaPixels.length
                });
                
                if (areaCount % 10 === 0) {
                    console.log(`  已找到 ${areaCount} 個區域...`);
                }
            }
        }
    }
    
    console.log(`✅ 總共找到 ${areas.length} 個區域`);
    
    // 按位置排序（從左到右，從上到下）
    areas.sort((a, b) => {
        if (Math.abs(a.center.y - b.center.y) < 100) {
            return a.center.x - b.center.x;
        }
        return a.center.y - b.center.y;
    });
    
    // 重新編號
    areas.forEach((area, index) => {
        area.id = index + 1;
    });
    
    // 保存結果
    const output = {
        imageSize: [width, height],
        totalAreas: areas.length,
        areas: areas.map(a => ({
            id: a.id,
            center: [a.center.y, a.center.x],
            polygon: simplifyBoundary(a.boundary, 20),
            pixelCount: a.pixelCount
        }))
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`💾 已保存: ${outputPath}\n`);
    
    return areas.length;
}

// 種子填充算法
function floodFill(data, width, height, channels, startX, startY, visited) {
    const pixels = [];
    const queue = [[startX, startY]];
    
    while (queue.length > 0 && pixels.length < 100000) {
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
            [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
        ];
        
        const isBoundary = neighbors.some(([nx, ny]) => {
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                return true;
            }
            return !pixelSet.has(`${nx},${ny}`);
        });
        
        if (isBoundary) {
            boundary.push([y, x]); // [y, x] for Leaflet
        }
    });
    
    return boundary;
}

// 簡化邊界
function simplifyBoundary(boundary, tolerance) {
    if (boundary.length < 10) return boundary;
    
    // 簡單採樣
    const step = Math.max(1, Math.floor(boundary.length / 100));
    const simplified = [];
    
    for (let i = 0; i < boundary.length; i += step) {
        simplified.push(boundary[i]);
    }
    
    // 確保閉合
    if (simplified.length > 0 && simplified[0] !== simplified[simplified.length - 1]) {
        simplified.push(simplified[0]);
    }
    
    return simplified;
}

async function main() {
    const mapsDir = path.join(__dirname, '..', 'public', 'maps');
    
    const maps = [
        { input: 'nanzih-boundaries.png', output: 'nanzih-areas-real.json' },
        { input: 'chiaotou-boundaries.png', output: 'chiaotou-areas-real.json' },
        { input: 'tzuguan-boundaries.png', output: 'tzuguan-areas-real.json' }
    ];
    
    for (const map of maps) {
        const inputPath = path.join(mapsDir, map.input);
        const outputPath = path.join(mapsDir, map.output);
        
        if (fs.existsSync(inputPath)) {
            await extractAreasFromBoundaries(inputPath, outputPath);
        } else {
            console.log(`⚠️  找不到: ${map.input}`);
        }
    }
    
    console.log('🎉 完成！');
}

main().catch(console.error);
