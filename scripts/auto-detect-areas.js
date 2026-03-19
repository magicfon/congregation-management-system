/**
 * 自動檢測邊界線並提取區域 polygons
 * 使用種子填充算法找到連通區域
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class AreaDetector {
    constructor(imagePath) {
        this.imagePath = imagePath;
        this.width = 0;
        this.height = 0;
        this.data = null;
    }

    async load() {
        // 讀取黑白邊界線圖片
        const { data, info } = await sharp(this.imagePath)
            .raw()
            .toBuffer({ resolveWithObject: true });
        
        this.width = info.width;
        this.height = info.height;
        this.data = data;
        
        console.log(`📐 圖片尺寸: ${this.width} x ${this.height}`);
        console.log(`📊 總像素: ${(this.width * this.height).toLocaleString()}`);
        
        return this;
    }

    // 檢查像素是否為白色（邊界線）
    isBoundary(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return true; // 邊界視為邊界線
        }
        
        const idx = (y * this.width + x) * 3;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];
        
        // 白色 = 邊界線
        return r > 200 && g > 200 && b > 200;
    }

    // 找到所有區域
    findAllAreas() {
        console.log('🔍 開始檢測區域...');
        
        const visited = new Set();
        const areas = [];
        const step = 100; // 採樣間距（增大以加快速度）
        
        let areaCount = 0;
        
        for (let y = 0; y < this.height; y += step) {
            for (let x = 0; x < this.width; x += step) {
                const key = `${x},${y}`;
                
                // 跳過已訪問或邊界線
                if (visited.has(key) || this.isBoundary(x, y)) {
                    continue;
                }
                
                // 種子填充找到區域（限制最大像素數）
                const areaPixels = this.floodFill(x, y, 50000); // 最多 50000 像素
                
                if (areaPixels.length < 500) {
                    // 太小的區域，可能是噪點
                    continue;
                }
                
                // 標記為已訪問（只標記採樣點附近）
                areaPixels.forEach(([px, py]) => {
                    if (px % step === 0 && py % step === 0) {
                        visited.add(`${px},${py}`);
                    }
                });
                
                // 提取邊界
                const boundary = this.extractBoundary(areaPixels);
                
                areas.push({
                    id: areaCount + 1,
                    center: this.calculateCenter(areaPixels),
                    boundary: boundary,
                    area: areaPixels.length
                });
                
                areaCount++;
                
                if (areaCount % 10 === 0) {
                    console.log(`  已找到 ${areaCount} 個區域...`);
                }
            }
        }
        
        console.log(`✅ 總共找到 ${areas.length} 個區域`);
        
        return areas;
    }

    // 種子填充算法找到連通區域（帶限制）
    floodFill(startX, startY, maxPixels = 50000) {
        const visited = new Set();
        const area = [];
        const queue = [[startX, startY]];
        
        while (queue.length > 0 && area.length < maxPixels) {
            const [x, y] = queue.shift();
            const key = `${x},${y}`;
            
            if (visited.has(key)) continue;
            if (this.isBoundary(x, y)) continue;
            
            visited.add(key);
            area.push([x, y]);
            
            // 添加相鄰像素
            queue.push([x + 1, y]);
            queue.push([x - 1, y]);
            queue.push([x, y + 1]);
            queue.push([x, y - 1]);
        }
        
        return area;
    }

    // 提取區域邊界（簡化版）
    extractBoundary(pixels) {
        // 簡化：只保留邊界點
        const boundary = [];
        const pixelSet = new Set(pixels.map(([x, y]) => `${x},${y}`));
        
        pixels.forEach(([x, y]) => {
            // 檢查是否為邊界點（至少有一個相鄰點不在區域內）
            const neighbors = [
                [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
            ];
            
            const isBoundary = neighbors.some(([nx, ny]) => {
                return !pixelSet.has(`${nx},${ny}`) || this.isBoundary(nx, ny);
            });
            
            if (isBoundary) {
                boundary.push([x, y]);
            }
        });
        
        return boundary;
    }

    // 計算區域中心
    calculateCenter(pixels) {
        const sumX = pixels.reduce((sum, [x, y]) => sum + x, 0);
        const sumY = pixels.reduce((sum, [x, y]) => sum + y, 0);
        
        return {
            x: Math.round(sumX / pixels.length),
            y: Math.round(sumY / pixels.length)
        };
    }

    // 簡化 polygon（Douglas-Peucker 算法）
    simplifyPolygon(points, tolerance = 10) {
        if (points.length < 3) return points;
        
        // 找到最大距離的點
        let maxDist = 0;
        let maxIndex = 0;
        
        const start = points[0];
        const end = points[points.length - 1];
        
        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.perpendicularDistance(points[i], start, end);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }
        
        // 遞歸簡化
        if (maxDist > tolerance) {
            const left = this.simplifyPolygon(points.slice(0, maxIndex + 1), tolerance);
            const right = this.simplifyPolygon(points.slice(maxIndex), tolerance);
            return [...left.slice(0, -1), ...right];
        } else {
            return [start, end];
        }
    }

    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd[0] - lineStart[0];
        const dy = lineEnd[1] - lineStart[1];
        
        const lineLengthSquared = dx * dx + dy * dy;
        
        if (lineLengthSquared === 0) {
            return Math.sqrt(
                Math.pow(point[0] - lineStart[0], 2) +
                Math.pow(point[1] - lineStart[1], 2)
            );
        }
        
        const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lineLengthSquared;
        const clampedT = Math.max(0, Math.min(1, t));
        
        const nearestX = lineStart[0] + clampedT * dx;
        const nearestY = lineStart[1] + clampedT * dy;
        
        return Math.sqrt(
            Math.pow(point[0] - nearestX, 2) +
            Math.pow(point[1] - nearestY, 2)
        );
    }
}

async function processMap(mapName, startId) {
    const inputPath = path.join(__dirname, '..', 'public', 'maps', `${mapName}-boundaries.png`);
    const outputPath = path.join(__dirname, '..', 'public', 'maps', `${mapName}-areas-auto.json`);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`處理地圖: ${mapName}`);
    console.log('='.repeat(60));
    
    const detector = new AreaDetector(inputPath);
    await detector.load();
    
    const areas = detector.findAllAreas();
    
    // 按中心點排序（從左到右，從上到下）
    areas.sort((a, b) => {
        if (Math.abs(a.center.y - b.center.y) < 100) {
            return a.center.x - b.center.x;
        }
        return a.center.y - b.center.y;
    });
    
    // 重新編號
    areas.forEach((area, index) => {
        area.id = startId + index;
    });
    
    // 簡化邊界
    areas.forEach(area => {
        area.polygon = detector.simplifyPolygon(area.boundary, 20);
        delete area.boundary; // 移除原始邊界數據
    });
    
    // 保存結果
    const output = {
        mapName: mapName,
        imageSize: [detector.width, detector.height],
        totalAreas: areas.length,
        areas: areas.map(a => ({
            id: a.id,
            center: [a.center.y, a.center.x], // [y, x] for Leaflet
            polygon: a.polygon.map(p => [p[1], p[0]]), // [[y, x], ...]
            area: a.area
        }))
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n✅ 已保存: ${outputPath}`);
    console.log(`📊 區域數量: ${areas.length}`);
    console.log(`🔢 編號範圍: ${startId} - ${startId + areas.length - 1}`);
    
    return areas.length;
}

async function main() {
    try {
        // 處理三張地圖
        const nanzihCount = await processMap('nanzih', 1);
        const chiaotouCount = await processMap('chiaotou', 90);
        const tzuguanCount = await processMap('tzuguan', 149);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 所有地圖處理完成！');
        console.log('='.repeat(60));
        console.log(`楠梓區: ${nanzihCount} 個區域 (1-${nanzihCount})`);
        console.log(`橋頭: ${chiaotouCount} 個區域 (90-${89 + chiaotouCount})`);
        console.log(`梓官: ${tzuguanCount} 個區域 (149-${148 + tzuguanCount})`);
        console.log('\n下一步：');
        console.log('1. 檢查生成的 JSON 文件');
        console.log('2. 在瀏覽器中測試效果');
        console.log('3. 手動調整不準確的區域');
        
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
        process.exit(1);
    }
}

main();
