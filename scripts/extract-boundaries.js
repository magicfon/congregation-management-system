/**
 * 使用 Sharp 提取地圖邊界線
 * 
 * 步驟：
 * 1. 讀取圖片
 * 2. 轉換為 HSV 色彩空間
 * 3. 分離藍紫色邊界線
 * 4. 檢測區域輪廓
 * 5. 識別區域編號（需要 OCR，這裡簡化處理）
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractPurpleBoundaries(imagePath, outputPath) {
  try {
    // 獲取圖片信息
    const metadata = await sharp(imagePath).metadata();
    console.log(`📷 圖片: ${path.basename(imagePath)}`);
    console.log(`   尺寸: ${metadata.width} x ${metadata.height}`);
    
    // 讀取圖片為 Buffer
    const { data, info } = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    console.log(`   色彩空間: ${info.channels} 通道`);
    
    // 創建輸出 buffer
    const output = Buffer.alloc(data.length);
    
    let purplePixelCount = 0;
    
    // 遍歷每個像素，檢測藍紫色
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // 檢測藍紫色：R 和 G 較低，B 較高
      // 藍紫色特徵：B > R, B > G, 且 B > 150
      const isPurple = (
        b > 150 && 
        b > r * 1.2 && 
        b > g * 1.2 &&
        Math.abs(r - g) < 50 // R 和 G 接近
      );
      
      if (isPurple) {
        output[i] = 255;     // R
        output[i + 1] = 255; // G
        output[i + 2] = 255; // B
        purplePixelCount++;
      } else {
        output[i] = 0;       // R
        output[i + 1] = 0;   // G
        output[i + 2] = 0;   // B
      }
    }
    
    console.log(`   藍紫色像素: ${purplePixelCount.toLocaleString()} (${(purplePixelCount / (data.length / 3) * 100).toFixed(2)}%)`);
    
    // 保存處理後的圖片
    await sharp(output, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 3
      }
    })
    .png()
    .toFile(outputPath);
    
    console.log(`   ✅ 已保存: ${path.basename(outputPath)}`);
    
    return {
      width: info.width,
      height: info.height,
      purplePixels: purplePixelCount
    };
    
  } catch (error) {
    console.error(`   ❌ 錯誤: ${error.message}`);
    return null;
  }
}

async function main() {
  const mapsDir = path.join(__dirname, '..', 'public', 'maps');
  
  const maps = [
    { input: 'nanzih-1-89.png', output: 'nanzih-boundaries.png' },
    { input: 'chiaotou-90-148.png', output: 'chiaotou-boundaries.png' },
    { input: 'tzuguan-149-213.png', output: 'tzuguan-boundaries.png' }
  ];
  
  for (const map of maps) {
    const inputPath = path.join(mapsDir, map.input);
    const outputPath = path.join(mapsDir, map.output);
    
    if (fs.existsSync(inputPath)) {
      await extractPurpleBoundaries(inputPath, outputPath);
    } else {
      console.log(`⚠️  找不到: ${map.input}`);
    }
  }
}

main().catch(console.error);
