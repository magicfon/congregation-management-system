// Deterministic vector layout; render on a machine with Microsoft JhengHei installed.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const cells=[
 {x:0,y:0,title:'公佈欄',subtitle:'聚會與會眾資訊',color:'#c6acf7',icon:'<rect x="-39" y="-46" width="78" height="92" rx="10"/><path d="M-20-25H20M-20-5H20M-20 15H4"/>'},
 {x:500,y:0,title:'我的看板',subtitle:'查看個人進度與待辦',color:'#92b9ff',icon:'<rect x="-44" y="-38" width="88" height="76" rx="10"/><path d="M-44-10H44M-12-10V38M4 8H28M4 24H20"/>'},
 {x:0,y:337,title:'我的委派',subtitle:'查看本人的服務安排',color:'#f3c779',icon:'<rect x="-44" y="-35" width="88" height="80" rx="12"/><path d="M-24-47V-22M24-47V-22M-44-8H44M-20 17-7 30 22 6"/>'},
 {x:500,y:337,title:'傳道地圖',subtitle:'地圖交接與傳道進度',color:'#71d5ba',icon:'<path d="M-44-34-15-44 15-34 44-44V34L15 44-15 34-44 44Z"/><path d="M-15-44V34M15-34V44"/>'},
];
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="674" viewBox="0 0 1000 674"><rect width="1000" height="674" fill="#0e1827"/>${cells.map(c=>`<g transform="translate(${c.x} ${c.y})"><rect x="12" y="12" width="476" height="313" rx="25" fill="#192638"/><circle cx="250" cy="100" r="66" fill="${c.color}" opacity=".08"/><g transform="translate(250 100)" fill="none" stroke="${c.color}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round">${c.icon}</g><text x="250" y="224" text-anchor="middle" fill="#f2f5fa" font-family="Microsoft JhengHei" font-weight="700" font-size="46">${c.title}</text><text x="250" y="270" text-anchor="middle" fill="#a6b4c6" font-family="Microsoft JhengHei" font-size="25">${c.subtitle}</text></g>`).join('')}</svg>`;
(async()=>{const dir=path.join(process.cwd(),'public','line');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'rich-menu-v1.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(dir,'rich-menu-v1.png'));console.log('Created 1000 × 674 LINE menu PNG');})().catch(e=>{console.error(e);process.exitCode=1});
