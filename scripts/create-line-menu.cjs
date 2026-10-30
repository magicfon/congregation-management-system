// Deterministic vector layout for the three role menus (ADR-0102).
// Renders with Microsoft JhengHei when installed, otherwise Noto Sans CJK TC.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const font='Microsoft JhengHei, Noto Sans CJK TC, sans-serif';
const tiles={
 bulletin:{title:'公佈欄',subtitle:'聚會與會眾資訊',color:'#c6acf7',icon:'<rect x="-39" y="-46" width="78" height="92" rx="10"/><path d="M-20-25H20M-20-5H20M-20 15H4"/>'},
 dashboard:{title:'我的看板',subtitle:'個人進度與待辦',color:'#92b9ff',icon:'<rect x="-44" y="-38" width="88" height="76" rx="10"/><path d="M-44-10H44M-12-10V38M4 8H28M4 24H20"/>'},
 assignments:{title:'我的委派',subtitle:'本人的服務安排',color:'#f3c779',icon:'<rect x="-44" y="-35" width="88" height="80" rx="12"/><path d="M-24-47V-22M24-47V-22M-44-8H44M-20 17-7 30 22 6"/>'},
 territory:{title:'傳道地圖',subtitle:'查看與申請地圖',color:'#71d5ba',icon:'<path d="M-44-34-15-44 15-34 44-44V34L15 44-15 34-44 44Z"/><path d="M-15-44V34M15-34V44"/>'},
 handoffs:{title:'地圖交接',subtitle:'待交接的地圖',color:'#f0a37a',icon:'<path d="M-40-14H34M20-30 36-14 20 2"/><path d="M40 18H-34M-20 2-36 18-20 34"/>'},
 report:{title:'區域回報',subtitle:'回報完成情況',color:'#7fd0f0',icon:'<rect x="-38" y="-46" width="76" height="92" rx="10"/><path d="M-18-46V-36H18V-46M-20 0-6 14 22-14"/>'},
 manage:{title:'管理入口',subtitle:'服務・週中・公告',color:'#b9c4d4',icon:'<circle r="16"/><path d="M0-44V-30M0 30V44M-44 0H-30M30 0H44M-31-31-21-21M21 21 31 31M-31 31-21 21M21-21 31-31"/>'},
};
// Rows of tile keys; src/lib/line-rich-menu.ts uses the same layout.
const menus={
 sister:{width:1000,rows:[['bulletin','dashboard'],['assignments','territory']]},
 brother:{width:999,rows:[['bulletin','dashboard','assignments'],['territory','handoffs','report']]},
 admin:{width:1332,rows:[['bulletin','dashboard','assignments','territory'],['handoffs','report','manage']]},
};
const H=674,rowH=337;
function render({width:W,rows}){
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0e1827"/>${rows.flatMap((keys,r)=>keys.map((key,i)=>{const t=tiles[key],cellW=Math.floor(W/keys.length),x=i*cellW,y=r*rowH,cx=cellW/2;return `<g transform="translate(${x} ${y})"><rect x="12" y="12" width="${cellW-24}" height="313" rx="25" fill="#192638"/><circle cx="${cx}" cy="100" r="66" fill="${t.color}" opacity=".08"/><g transform="translate(${cx} 100)" fill="none" stroke="${t.color}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round">${t.icon}</g><text x="${cx}" y="224" text-anchor="middle" fill="#f2f5fa" font-family="${font}" font-weight="700" font-size="46">${t.title}</text><text x="${cx}" y="270" text-anchor="middle" fill="#a6b4c6" font-family="${font}" font-size="25">${t.subtitle}</text></g>`})).join('')}</svg>`;
}
(async()=>{const dir=path.join(process.cwd(),'public','line');fs.mkdirSync(dir,{recursive:true});
 for(const [kind,menu] of Object.entries(menus)){const svg=render(menu);fs.writeFileSync(path.join(dir,`rich-menu-${kind}.svg`),svg);await sharp(Buffer.from(svg)).png({compressionLevel:9}).toFile(path.join(dir,`rich-menu-${kind}.png`));}
 console.log('Created sister/brother/admin LINE menu PNGs');})().catch(e=>{console.error(e);process.exitCode=1});
