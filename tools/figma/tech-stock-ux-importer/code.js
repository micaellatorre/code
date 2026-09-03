figma.showUI(__html__, { width: 420, height: 620, themeColors: true });

const COLORS = {
  root: '#07111F', raised: '#0D1A2B', raised2: '#101F33', border: '#1E2C40',
  text: '#F8FAFC', muted: '#94A3B8', primary: '#1478FF', partner: '#7C3AED',
  success: '#22C55E', warning: '#F59E0B', danger: '#EF4444'
};

function rgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255 };
}
function solid(hex, opacity=1) { return { type:'SOLID', color:rgb(hex), opacity }; }
async function font(style='Regular') { await figma.loadFontAsync({ family:'Inter', style }); }
async function textNode(value, size=14, style='Regular', color=COLORS.text) {
  await font(style); const t=figma.createText(); t.fontName={family:'Inter',style}; t.fontSize=size; t.characters=value; t.fills=[solid(color)]; return t;
}
function pageName(platform) { return platform === 'mobile' ? '06 Mobile Interfaces' : '05 Desktop Interfaces'; }
async function ensurePage(name) {
  const found=figma.root.children.find(p=>p.name===name);
  if (found) return found;
  const p=figma.createPage(); p.name=name; return p;
}
async function ensureCorePages() {
  const names=['00 Foundations','01 Atoms','02 Molecules','03 Organisms','04 Templates','05 Desktop Interfaces','06 Mobile Interfaces','07 Walkthroughs','08 Reference Boards'];
  for (const n of names) await ensurePage(n);
}
function deleteNamed(page,name){ const node=page.children.find(n=>n.name===name); if(node) node.remove(); }
function setAuto(frame, direction='VERTICAL', gap=12, pad=20) {
  frame.layoutMode=direction; frame.itemSpacing=gap; frame.paddingTop=pad; frame.paddingRight=pad; frame.paddingBottom=pad; frame.paddingLeft=pad;
  frame.primaryAxisSizingMode='AUTO'; frame.counterAxisSizingMode='FIXED';
}
async function pill(label,color=COLORS.primary){
  const f=figma.createFrame(); f.name='Badge / '+label; setAuto(f,'HORIZONTAL',8,8); f.cornerRadius=999; f.fills=[solid(color,.15)]; f.strokes=[solid(color,.4)];
  const t=await textNode(label,11,'Semi Bold',color); f.appendChild(t); return f;
}
async function metaRow(label,value){
  const r=figma.createFrame(); r.layoutMode='HORIZONTAL'; r.itemSpacing=10; r.fills=[]; r.counterAxisSizingMode='AUTO'; r.primaryAxisSizingMode='AUTO';
  const l=await textNode(label,11,'Semi Bold',COLORS.muted); const v=await textNode(value||'—',11,'Regular',COLORS.text); r.appendChild(l); r.appendChild(v); return r;
}
async function componentCard(c){
  const f=figma.createFrame(); f.name=c.level+' / '+c.name; setAuto(f,'VERTICAL',7,14); f.cornerRadius=12; f.fills=[solid(COLORS.raised2)]; f.strokes=[solid(COLORS.border)]; f.resize(320,120);
  const top=figma.createFrame(); top.layoutMode='HORIZONTAL'; top.itemSpacing=8; top.fills=[]; top.primaryAxisSizingMode='AUTO'; top.counterAxisSizingMode='AUTO';
  top.appendChild(await textNode(c.name,13,'Semi Bold')); top.appendChild(await pill(c.level, c.level==='Atom'?COLORS.primary:c.level==='Molecule'?'#06B6D4':c.level==='Organism'?COLORS.partner:'#64748B'));
  f.appendChild(top); const d=await textNode(c.responsibility||'',11,'Regular',COLORS.muted); d.resize(285,40); d.textAutoResize='HEIGHT'; f.appendChild(d); return f;
}
async function decodeBase64(data){
  return figma.base64Decode(data.split(',').pop());
}
async function addReferenceImage(parent, imagePayload, width){
  if(!imagePayload) return;
  try{
    const bytes=await decodeBase64(imagePayload.data); const img=figma.createImage(bytes);
    const rect=figma.createRectangle(); rect.name='Reference / '+imagePayload.name; rect.resize(width, Math.round(width/(imagePayload.aspect||1.6))); rect.cornerRadius=12;
    rect.fills=[{type:'IMAGE',scaleMode:'FIT',imageHash:img.hash}]; parent.appendChild(rect);
  }catch(e){ console.warn('Reference image failed', e); }
}
async function buildScreen(screen, imageMap){
  const page=await ensurePage(pageName(screen.platform)); await figma.setCurrentPageAsync(page);
  const nodeName=screen.id+' · '+screen.title; deleteNamed(page,nodeName);
  const mobile=screen.platform==='mobile'; const W=mobile?390:1440; const H=mobile?844:900;
  const f=figma.createFrame(); f.name=nodeName; f.resize(W,H); f.fills=[solid(COLORS.root)]; f.cornerRadius=mobile?28:20;
  f.layoutMode='VERTICAL'; f.itemSpacing=18; f.paddingTop=mobile?24:32; f.paddingRight=mobile?20:32; f.paddingBottom=mobile?24:32; f.paddingLeft=mobile?20:32;
  f.appendChild(await textNode(screen.title,mobile?24:30,'Bold'));
  const meta=figma.createFrame(); meta.layoutMode='VERTICAL'; meta.itemSpacing=5; meta.fills=[]; meta.primaryAxisSizingMode='AUTO'; meta.counterAxisSizingMode='AUTO';
  meta.appendChild(await metaRow('URL',screen.url)); meta.appendChild(await metaRow('Repo',screen.repoPath)); meta.appendChild(await metaRow('Entidad',screen.entity)); f.appendChild(meta);
  const accent=screen.entity && screen.entity.toLowerCase().includes('partner') ? COLORS.partner : COLORS.primary;
  const strip=figma.createFrame(); strip.name='Domain Header'; strip.layoutMode='HORIZONTAL'; strip.itemSpacing=10; strip.fills=[]; strip.primaryAxisSizingMode='AUTO'; strip.counterAxisSizingMode='AUTO';
  strip.appendChild(await pill(screen.platform==='mobile'?'Mobile First':'Desktop',accent)); strip.appendChild(await pill(screen.status && screen.status.startsWith('Existente')?'Existing route':'UX migration', screen.status&&screen.status.startsWith('Existente')?COLORS.success:COLORS.warning)); f.appendChild(strip);
  const body=figma.createFrame(); body.name='Editable UX Structure'; body.layoutMode=mobile?'VERTICAL':'HORIZONTAL'; body.itemSpacing=12; body.fills=[]; body.primaryAxisSizingMode='AUTO'; body.counterAxisSizingMode='FIXED'; body.resize(W-(mobile?40:64), mobile?540:540); f.appendChild(body);
  const comps=(screen.components||[]).filter(c=>c.level!=='Template');
  if(mobile){ for(const c of comps.slice(0,6)) body.appendChild(await componentCard(c)); }
  else {
    const left=figma.createFrame(); left.name='Primary Workspace'; left.layoutMode='VERTICAL'; left.itemSpacing=10; left.fills=[]; left.resize(650,520);
    const right=figma.createFrame(); right.name='Context / Preview'; right.layoutMode='VERTICAL'; right.itemSpacing=10; right.fills=[]; right.resize(650,520);
    for(let i=0;i<comps.length;i++){ (i%2===0?left:right).appendChild(await componentCard(comps[i])); }
    body.appendChild(left); body.appendChild(right);
  }
  const asset=imageMap && imageMap[screen.referenceAsset]; if(asset) await addReferenceImage(f,asset,mobile?350:700);
  const story=screen.userStories&&screen.userStories[0]; if(story){const s=await textNode('User story · '+story,11,'Regular',COLORS.muted);s.resize(W-(mobile?40:64),60);s.textAutoResize='HEIGHT';f.appendChild(s);}
  return f;
}
async function buildLibrary(manifest){
  await ensureCorePages();
  const levels={Atom:'01 Atoms',Molecule:'02 Molecules',Organism:'03 Organisms',Template:'04 Templates'};
  const unique=new Map();
  (manifest.screens||[]).forEach(s=>(s.components||[]).forEach(c=>unique.set(c.level+'::'+c.name,c)));
  const positions={Atom:0,Molecule:0,Organism:0,Template:0};
  for(const c of unique.values()){
    const page=await ensurePage(levels[c.level]||'02 Molecules'); await figma.setCurrentPageAsync(page); const name=c.level+' / '+c.name; deleteNamed(page,name);
    const comp=figma.createComponent(); comp.name=name; comp.resize(c.level==='Atom'?220:c.level==='Molecule'?320:c.level==='Organism'?520:680,c.level==='Atom'?110:c.level==='Molecule'?160:c.level==='Organism'?240:400); comp.cornerRadius=16; comp.fills=[solid(COLORS.raised)]; comp.strokes=[solid(COLORS.border)];
    const i=positions[c.level]++; comp.x=(i%3)*760; comp.y=Math.floor(i/3)*470;
    const title=await textNode(c.name,c.level==='Atom'?16:20,'Semi Bold'); title.x=20; title.y=20; comp.appendChild(title);
    const desc=await textNode(c.responsibility||'',12,'Regular',COLORS.muted);desc.x=20;desc.y=54;desc.resize(comp.width-40,80);desc.textAutoResize='HEIGHT';comp.appendChild(desc);
  }
}
figma.ui.onmessage=async(msg)=>{
  try{
    if(msg.type==='IMPORT'){
      const manifest=msg.manifest; await buildLibrary(manifest); const map={}; (msg.images||[]).forEach(i=>map[i.name]=i);
      let count=0; const frames=[];
      for(const screen of manifest.screens||[]){ const f=await buildScreen(screen,map); frames.push(f); count++; figma.ui.postMessage({type:'PROGRESS',count,total:manifest.screens.length,title:screen.title}); }
      const p=await ensurePage('05 Desktop Interfaces'); await figma.setCurrentPageAsync(p); if(frames.length) figma.viewport.scrollAndZoomIntoView(frames.filter(f=>f.parent===p).slice(0,4));
      figma.ui.postMessage({type:'DONE',count});
    }
  }catch(err){figma.ui.postMessage({type:'ERROR',message:String(err&&err.stack||err)});}
};
