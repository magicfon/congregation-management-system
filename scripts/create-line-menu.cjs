// Deterministic vector layout for the LINE menus (ADR-0107).
// Renders with Microsoft JhengHei when installed, otherwise Noto Sans CJK TC.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const font='Microsoft JhengHei, Noto Sans CJK TC, sans-serif';
const tiles={
 bulletin:{title:'公佈欄',subtitle:'聚會與會眾資訊',color:'#c6acf7',icon:'<rect x="-39" y="-46" width="78" height="92" rx="10"/><path d="M-20-25H20M-20-5H20M-20 15H4"/>'},
 dashboard:{title:'我的看板',subtitle:'個人進度與待辦',color:'#92b9ff',icon:'<rect x="-44" y="-38" width="88" height="76" rx="10"/><path d="M-44-10H44M-12-10V38M4 8H28M4 24H20"/>'},
 assignments:{title:'我的委派',subtitle:'本人的服務安排',color:'#f3c779',icon:'<rect x="-44" y="-35" width="88" height="80" rx="12"/><path d="M-24-47V-22M24-47V-22M-44-8H44M-20 17-7 30 22 6"/>'},
 territory:{title:'傳道地圖',subtitle:'查看與申請地圖',color:'#71d5ba',icon:'<path d="M-44-34-15-44 15-34 44-44V34L15 44-15 34-44 44Z"/><path d="M-15-44V34M15-34V44"/>'},
 report:{title:'區域回報',subtitle:'回報完成情況',color:'#7fd0f0',icon:'<rect x="-38" y="-46" width="76" height="92" rx="10"/><path d="M-18-46V-36H18V-46M-20 0-6 14 22-14"/>'},
 handoffs:{title:'地圖交接',subtitle:'待交接的地圖',color:'#f0a37a',icon:'<path d="M-40-14H34M20-30 36-14 20 2"/><path d="M40 18H-34M-20 2-36 18-20 34"/>'},
 schedules:{title:'傳道行程',subtitle:'預排與帶領',color:'#92b9ff',icon:'<rect x="-44" y="-35" width="88" height="80" rx="12"/><path d="M-24-47V-22M24-47V-22M-44-8H44M-24 12H-8M8 12H24M-24 28H-8"/>'},
 myRequests:{title:'領圖申請',subtitle:'我的申請進度',color:'#e9a6d0',icon:'<rect x="-38" y="-46" width="76" height="92" rx="10"/><path d="M-20-22H20M-20-4H20M-20 14H2M10 30 18 38 34 22"/>'},
 allocation:{title:'地圖分配',subtitle:'分發與收回',color:'#71d5ba',icon:'<path d="M0 44C-20 22-32 6-32-10A32 32 0 0 1 32-10C32 6 20 22 0 44Z"/><circle cy="-10" r="11"/>'},
 requests:{title:'領圖申請',subtitle:'審核申請',color:'#e9a6d0',icon:'<rect x="-38" y="-46" width="76" height="92" rx="10"/><path d="M-20-22H20M-20-4H20M-20 14H2M10 30 18 38 34 22"/>'},
 roster:{title:'服務安排',subtitle:'管理排班',color:'#f3c779',icon:'<circle cx="-14" cy="-18" r="16"/><path d="M-44 40C-44 16-30 6-14 6S16 16 16 40"/><path d="M20-24H44M20-8H44M28 8H44"/>'},
 midweek:{title:'週中編排',subtitle:'編排週中聚會',color:'#f0a37a',icon:'<rect x="-40" y="-46" width="80" height="92" rx="10"/><path d="M-22-24H22M-22-6H22M-22 12H22M-22 30H4"/>'},
 announcements:{title:'管理公告',subtitle:'會眾公告',color:'#7fd0f0',icon:'<path d="M-40-12V12H-20L20 38V-38L-20-12Z"/><path d="M32-14C38-8 38 8 32 14"/>'},
 members:{title:'成員管理',subtitle:'權限與連結',color:'#b9c4d4',icon:'<circle cx="-14" cy="-16" r="16"/><path d="M-44 40C-44 16-30 6-14 6S16 16 16 40"/><circle cx="24" cy="-10" r="12"/><path d="M22 10C34 10 44 18 44 36"/>'},
};
// Same pages as src/lib/line-rich-menu.ts. tab: null = no tab bar (default menu for sisters).
const general=[['bulletin','dashboard'],['assignments','territory']];
const menus={
 sister:{width:1000,height:674,tab:null,rows:general},
 'brother-general':{width:1332,height:900,tab:'general',rows:general},
 'brother-manage':{width:1332,height:900,tab:'manage',rows:[['report','handoffs'],['schedules','myRequests']]},
 'admin-general':{width:1332,height:900,tab:'general',rows:general},
 'admin-manage':{width:1332,height:900,tab:'manage',rows:[['report','handoffs','allocation','requests'],['roster','midweek','announcements','members']]},
};
const BAR=110;
function tile(t,x,y,w,h){const cx=w/2,s=h/337;return `<g transform="translate(${x} ${y})"><rect x="12" y="12" width="${w-24}" height="${h-24}" rx="25" fill="#192638"/><circle cx="${cx}" cy="${100*s}" r="66" fill="${t.color}" opacity=".08"/><g transform="translate(${cx} ${100*s})" fill="none" stroke="${t.color}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round">${t.icon}</g><text x="${cx}" y="${224*s}" text-anchor="middle" fill="#f2f5fa" font-family="${font}" font-weight="700" font-size="46">${t.title}</text><text x="${cx}" y="${270*s}" text-anchor="middle" fill="#a6b4c6" font-family="${font}" font-size="25">${t.subtitle}</text></g>`}
function tabs(W,active){const half=W/2;return ['general','manage'].map((key,i)=>{const on=key===active,x=i*half;return `<g transform="translate(${x} 0)"><rect x="12" y="12" width="${half-24}" height="${BAR-12}" rx="22" fill="${on?'#2a3b54':'#0e1827'}" stroke="${on?'#92b9ff':'#2a3b54'}" stroke-width="3"/><text x="${half/2}" y="${BAR/2+20}" text-anchor="middle" fill="${on?'#f2f5fa':'#7d8ba0'}" font-family="${font}" font-weight="700" font-size="42">${key==='general'?'一般':'管理'}</text></g>`}).join('')}
function render({width:W,height:H,tab,rows}){
 const top=tab?BAR:0,rowH=(H-top)/rows.length;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0e1827"/>${tab?tabs(W,tab):''}${rows.flatMap((keys,r)=>keys.map((key,i)=>{const w=Math.floor(W/keys.length);return tile(tiles[key],i*w,top+r*rowH,w,rowH)})).join('')}</svg>`;
}
(async()=>{const dir=path.join(process.cwd(),'public','line');fs.mkdirSync(dir,{recursive:true});
 for(const [kind,menu] of Object.entries(menus)){const svg=render(menu);fs.writeFileSync(path.join(dir,`rich-menu-${kind}.svg`),svg);await sharp(Buffer.from(svg)).png({compressionLevel:9}).toFile(path.join(dir,`rich-menu-${kind}.png`));}
 console.log('Created LINE menu PNGs:',Object.keys(menus).join(', '));})().catch(e=>{console.error(e);process.exitCode=1});
