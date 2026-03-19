/**
 * 改进的区域提取算法
 * 基于边界线 + 编号检测
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class ImprovedAreaExtractor {
    constructor(imagePath) {
        this.imagePath = imagePath;
        this.width = 0;
        this.height = 0;
        this.data = null;
    }

    async load() {
        const { data, info } = await sharp(this.imagePath)
            .raw()
            .toBuffer({ resolveWithObject: true });
        
        this.width = info.width;
        this.height = info.height;
        this.data = data;
        
        console.log(`📷 圖片: ${this.width} x ${this.height}`);
        return this;
    }

    // 检测像素是否为边界线（白色/淡紫色）
    isBoundary(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        
        const idx = (y * this.width + x) * 3;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];
        
        // 边界线特征：浅紫色/白色
        return r > 220 && g > 220 && b > 220;
    }

    // 检测黑色区域（区域内部）
    isBlack(x, y) {
        const idx = (y * this.width + x) * 3;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];
        
        // 黑色区域特征：所有通道都小于 50
        return r < 50 && g < 50 && b < 50;
    }

    // 检测是否为编号像素（白色）
    isNumber(x, y) {
        if (this.isBoundary(x, y)) return false;
        
        const idx = (y * this.width + x) * 3;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];
        
        // 编号特征：白色（高亮度）
        return r > 230 && g > 230 && b > 230;
    }

    // 找到所有编号的位置
    findNumbers() {
        console.log('🔍 開始檢測編號...');
        
        const numbers = [];
        const visited = new Set();
        const step = 100;
        
        for (let y = step; y < this.height; y += step) {
            for (let x = step; x < this.width; x += step) {
                const key = `${x},${y}`;
                
                if (visited.has(key)) continue;
                if (!this.isNumber(x, y)) continue;
                
                // 找到这个数字的区域
                const numberRegion = this.floodFillNumber(x, y);
                
                if (numberRegion.pixels.length > 50) {
                    // 计算中心点
                    const center = this.calculateCenter(numberRegion.pixels);
                    
                    // 计算边界框
                    let minX = Infinity, maxX = -Infinity;
                    let minY = Infinity, maxY = -Infinity;
                    
                    numberRegion.pixels.forEach(([px, py]) => {
                        minX = Math.min(minX, px);
                        maxX = Math.max(maxX, px);
                        minY = Math.min(minY, py);
                        maxY = Math.max(maxY, py);
                    });
                    
                    numbers.push({
                        center: center,
                        bbox: {
                            x: minX,
                            y: minY,
                            width: maxX - minX + 1,
                            height: maxY - minY + 1
                        },
                        pixelCount: numberRegion.pixels.length
                    });
                    
                    // 标记为已访问（只标记采样点）
                    visited.add(key);
                }
            }
        }
        
        console.log(`✅ 找到 ${numbers.length} 個編號`);
        return numbers;
    }

    // 查找数字区域的像素
    floodFillNumber(startX, startY, maxPixels = 5000) {
        const pixels = [];
        const queue = [[startX, startY]];
        
        while (queue.length > 0 && pixels.length < maxPixels) {
            const [x, y] = queue.shift();
            
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
            if (!this.isNumber(x, y)) continue;
            
            pixels.push([x, y]);
            
            // 添加相邻像素
            queue.push([x + 1, y]);
            queue.push([x - 1, y]);
            queue.push([x, y + 1]);
            queue.push([x, y - 1]);
        }
        
        return { pixels };
    }

    // 基于边界线检测区域
    findAreas() {
        console.log('🔍 開始檢測區域...');
        
        const visited = new Uint8Array(this.width * this.height);
        const areas = [];
        const step = 30; // 采样间距
        
        for (let y = 0; y < this.height; y += step) {
            for (let x = 0; x < this.width; x += step) {
                const idx = y * this.width + x;
                
                if (visited[idx] || this.isBoundary(x, y)) continue;
                
                // 如果是黑色区域，执行区域检测
                if (this.isBlack(x, y)) {
                    const areaPixels = this.floodFill(x, y, visited, 100000);
                    
                    if (areaPixels.length > 500) {
                        // 计算边界
                        const boundary = this.extractBoundary(areaPixels);
                        const center = this.calculateCenter(areaPixels);
                        
                        areas.push({
                            id: areas.length + 1,
                            center: center,
                            boundary: boundary,
                            area: areaPixels.length
                        });
                    }
                }
            }
        }
        
        console.log(`✅ 找到 ${areas.length} 個區域`);
        return areas;
    }

    // 改进的泛洪填充（带 visited 数组）
    floodFill(startX, startY, visited, maxPixels = 50000) {
        const pixels = [];
        const queue = [[startX, startY]];
        
        while (queue.length > 0 && pixels.length < maxPixels) {
            const [x, y] = queue.shift();
            
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
            
            const idx = y * this.width + x;
            if (visited[idx]) continue;
            if (this.isBoundary(x, y)) continue;
            
            visited[idx] = 1;
            pixels.push([x, y]);
            
            queue.push([x + 1, y]);
            queue.push([x - 1, y]);
            queue.push([x, y + 1]);
            queue.push([x, y - 1]);
        }
        
        return { pixels };
    }

    // 提取边界
    extractBoundary(pixels) {
        const boundary = [];
        const pixelSet = new Set(pixels.map(([x, y]) => `${x},${y}`));
        
        pixels.forEach(([x, y]) => {
            // 检查是否为边界点
            const neighbors = [
                [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
                [x + 1, y + 1], [x - 1, y - 1], [x - 1, y + 1], [x + 1, y - 1]
            ];
            
            const isBoundary = neighbors.some(([nx, ny]) => {
                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
                    return true;
                }
                return !pixelSet.has(`${nx},${ny}`) || this.isBoundary(nx, ny);
            });
            
            if (isBoundary) {
                boundary.push([x, y]);
            }
        });
        
        return boundary;
    }

    // 计算中心点
    calculateCenter(pixels) {
        const sumX = pixels.reduce((sum, [x, y]) => sum + x, 0);
        const sumY = pixels.reduce((sum, [x, y]) => sum + y, 0);
        
        return {
            x: Math.round(sumX / pixels.length),
            y: Math.round(sumY / pixels.length)
        };
    }

    // 根据编号和区域匹配
    matchNumbersWithAreas(numbers, areas) {
        console.log('🔗 匹配編號與區域...');
        
        const matchedAreas = [];
        
        // 按照编号顺序（从上到下，从左到右）
        numbers.sort((a, b) => {
            if (Math.abs(a.center.y - b.center.y) < 30) {
                return a.center.x - b.center.x;
            }
            return a.center.y - b.center.y;
        });
        
        numbers.forEach((number, index) => {
            // 找到最接近的区域
            let closestArea = null;
            let minDist = Infinity;
            
            areas.forEach(area => {
                const dx = area.center.x - number.center.x;
                const dy = area.center.y - number.center.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < minDist) {
                    minDist = dist;
                    closestArea = area;
                }
            });
            
            if (closestArea && minDist < 100) {
                matchedAreas.push({
                    id: index + 1,
                    center: number.center,
                    area: closestArea
                });
            }
        });
        
        console.log(`✅ 匹配了 ${matchedAreas.length} 個編號與區域`);
        
        return matchedAreas;
    }
}

async function processMap(mapName, expectedAreas) {
    const mapsDir = path.join(__dirname, '..', 'public', 'maps');
    const inputPath = path.join(mapsDir, `${mapName}-1-89.png`);
    const outputPath = path.join(mapsDir, `${mapName}-areas-final.json`);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`處理地圖: ${mapName}`);
    console.log('='.repeat(60));
    
    const extractor = new ImprovedAreaExtractor(inputPath);
    await extractor.load();
    
    // 检测编号
    const numbers = extractor.findNumbers();
    
    // 检测区域
    const areas = extractor.findAreas();
    
    // 匹配编号和区域
    const matchedAreas = extractor.matchNumbersWithAreas(numbers, areas);
    
    // 如果匹配数量接近预期，保存结果
    const matchRate = matchedAreas.length / expectedAreas;
    
    console.log(`\n匹配率: ${(matchRate * 100).toFixed(1)}% (${matchedAreas.length}/${expectedAreas})`);
    
    if (matchRate > 0.5) {
        // 按编号排序
        matchedAreas.sort((a, b) => a.id - b.id);
        
        const output = {
            mapName: mapName,
            imageSize: [extractor.width, extractor.height],
            totalMatched: matchedAreas.length,
            expectedAreas: expectedAreas,
            areas: matchedAreas.map(a => ({
                id: a.id,
                center: a.center,
                polygon: a.area.boundary,
                area: a.area.area
            }))
        };
        
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`\n✅ 已保存: ${outputPath}`);
        
        return matchedAreas.length;
    } else {
        console.log(`⚠️ 匹配率太低 (${(matchRate * 100).toFixed(1)}%)，使用 Grid 方案`);
        return 0;
    }
}

async function main() {
    try {
        const nanzihCount = await processMap('nanzih', 89);
        const chiaotouCount = await processMap('chiaotou', 59);
        const tzuguanCount = await processMap('tzuguan', 65);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 完成！');
        console.log('='.repeat(60));
        console.log(`楠梓區: ${nanzihCount} 個區域 (預期: 89)`);
        console.log(`橋頭: ${chiaotouCount} 個區域 (預期: 59)`);
        console.log(`梓官: ${tzuguanCount} 個區域 (預期: 65)`);
        
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
        process.exit(1);
    }
}

main();
