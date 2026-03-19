const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractTzuguanWithPolygons() {
    const mapsDir = path.join(__dirname, '..', 'public', 'maps');
    const inputPath = path.join(mapsDir, 'tzuguan-boundaries.png');
    const outputPath = path.join(mapsDir, 'tzuguan-areas-detected.json');
    
    console.log('處理梓官（包含邊界）...');
    
    const { data, info } = await sharp(inputPath)
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const { width, height, channels } = info;
    console.log(`尺寸: ${width} x ${height}`);
    
    const visited = new Uint8Array(width * height);
    const areas = [];
    const step = 50;
    const minArea = 5000;
    
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = y * width + x;
            if (visited[idx]) continue;
            
            const pixelIdx = idx * channels;
            const r = data[pixelIdx];
            const g = data[pixelIdx + 1];
            const b = data[pixelIdx + 2];
            
            if (r > 200 && g > 200 && b > 200) {
                visited[idx] = 1;
                continue;
            }
            
            const areaPixels = [];
            const queue = [[x, y]];
            
            while (queue.length > 0 && areaPixels.length < 100000) {
                const [cx, cy] = queue.shift();
                if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
                
                const cidx = cy * width + cx;
                if (visited[cidx]) continue;
                
                const cpixelIdx = cidx * channels;
                const cr = data[cpixelIdx];
                const cg = data[cpixelIdx + 1];
                const cb = data[cpixelIdx + 2];
                
                if (cr > 200 && cg > 200 && cb > 200) continue;
                
                visited[cidx] = 1;
                areaPixels.push([cx, cy]);
                
                queue.push([cx + 1, cy]);
                queue.push([cx - 1, cy]);
                queue.push([cx, cy + 1]);
                queue.push([cx, cy - 1]);
            }
            
            if (areaPixels.length >= minArea) {
                const sumX = areaPixels.reduce((sum, [px, py]) => sum + px, 0);
                const sumY = areaPixels.reduce((sum, [px, py]) => sum + py, 0);
                
                // 提取边界
                const pixelSet = new Set(areaPixels.map(([px, py]) => `${px},${py}`));
                const boundary = [];
                
                areaPixels.forEach(([px, py]) => {
                    const neighbors = [
                        [px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]
                    ];
                    
                    const isBoundary = neighbors.some(([nx, ny]) => {
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
                        return !pixelSet.has(`${nx},${ny}`);
                    });
                    
                    if (isBoundary) {
                        boundary.push([py, px]); // [y, x]
                    }
                });
                
                areas.push({
                    center: { x: sumX / areaPixels.length, y: sumY / areaPixels.length },
                    boundary: boundary,
                    pixelCount: areaPixels.length
                });
                
                process.stdout.write(`\r檢測到 ${areas.length} 個區域...`);
            }
        }
    }
    
    console.log(`\n\n總共檢測到 ${areas.length} 個區域`);
    
    areas.sort((a, b) => b.pixelCount - a.pixelCount);
    const selected = areas.slice(0, 65);
    
    selected.sort((a, b) => {
        if (Math.abs(a.center.y - b.center.y) < 100) return a.center.x - b.center.x;
        return a.center.y - b.center.y;
    });
    
    // 简化边界
    const output = {
        imageSize: [width, height],
        totalDetected: areas.length,
        selectedCount: selected.length,
        areas: selected.map((a, i) => {
            const simplified = [];
            const step = 50;
            
            for (let j = 0; j < a.boundary.length; j += step) {
                simplified.push(a.boundary[j]);
            }
            
            if (simplified.length > 0 && simplified[0] !== simplified[simplified.length - 1]) {
                simplified.push(simplified[0]);
            }
            
            return {
                id: i + 1,
                center: [a.center.y, a.center.x],
                polygon: simplified,
                pixelCount: a.pixelCount
            };
        })
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`✅ 已保存: ${outputPath}`);
    console.log(`   檔案大小: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

extractTzuguanWithPolygons().catch(console.error);
