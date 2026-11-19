"use strict";

const $ = id => document.getElementById(id);
const all = query => [...document.querySelectorAll(query)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const SIDES = 72;
const defaults = {name:"Contour Study 01", material:"oak", pattern:"terrain", width:180, length:140, thickness:18, depth:10, heightmap:null};
const materials = {
  oak:{label:"Oak",rgb:[190,139,85], wood:true},
  walnut:{label:"Walnut", rgb:[129,85,58], wood:true},
  limestone:{label:"Limestone",rgb:[187,177,153], wood:false},
  slate:{label:"Slate",rgb:[103,114,117],wood:false},
};
const patterns = {terrain:"Terrain", ripple:"Ripple", flute:"Fluted", custom:"Heightmap"};
let design = {...defaults};
let page = "studio", activeChapter = 0;
let toastTimer;

function status(message, error = false) {
  clearTimeout(toastTimer);
  $("status").textContent = message;
  $("status").dataset.error = String(error);
  toastTimer = setTimeout(() => { $("status").textContent = ""; }, error ? 8500 : 4800);
}

const chapters = [
  {
    title:"Safety and scope", kicker:"BEFORE YOU START",
    intro:"Operate only after training on the exact machine and controller. Keep its manufacturer’s instructions and the shop’s emergency procedures at the machine.",
    items:[
      ["Guards and interlocks","Never bypass them. Keep people outside the operating and ejection zones, and keep hands clear of moving tools and axes."],
      ["Operator protection","Follow the shop’s risk assessment for eye, hearing, and respiratory protection. Secure loose clothing, jewelry, and hair."],
      ["Loss of control","Know the location of the emergency stop and your shop’s response procedure. Do not restart after a fault until its cause is resolved and restart is authorized."],
    ],
    source:["OSHA: Router hazards and controls","https://www.osha.gov/etools/woodworking/production/machines-tools/routers"]
  },
  {
    title:"Pre-start checklist", kicker:"SETUP REVIEW",
    intro:"Use this as a reminder alongside the manufacturer’s pre-start procedure. Checks reset when you reload the dashboard. They are not machine interlocks and do not verify readiness.",
    checks:[
      "Machine, cutter, and workholding are approved for this material.",
      "Guards, interlocks, and emergency controls have been checked as specified.",
      "Stock is secured and clamps clear the programmed movement.",
      "Material-specific dust or slurry controls are available and working.",
      "Work origin, stock dimensions, and controller program match the CAM setup.",
      "Toolpaths and clearance have been reviewed by the trained operator."
    ]
  },
  {
    title:"Wood carving", kicker:"MATERIAL / WOOD",
    intro:"Wood routing can eject chips and generate significant airborne dust. Use the machine only with approved tools, approved stock, and working extraction.",
    items:[
      ["Inspect the blank","Reject stock with defects or foreign objects that make it unsuitable for the setup. Match the cutter and workholding to the job."],
      ["Manage dust at the source","Use the designated extraction and enclosure. If extraction fails, stop under your shop’s procedure and resolve the fault before continuing."],
      ["Check the intended finish","Use an approved test piece where appropriate. Grain direction and stock condition can change the finish."],
    ],
    source:["OSHA: Wood dust and local exhaust","https://www.osha.gov/etools/woodworking/production/wood-dust"]
  },
  {
    title:"Stone carving", kicker:"MATERIAL / STONE",
    intro:"Some stone releases respirable crystalline silica when machined. Confirm the material, exposure controls, tooling, and suitability of the machine before any work.",
    items:[
      ["Use the designated stone setup","Do not assume a wood router can cut stone. Use compatible tooling and stock support approved for the machine."],
      ["Control exposure","Use engineering controls specified by your exposure assessment. Use water only on equipment designed and approved for wet operation."],
      ["Clean up safely","Follow the shop’s silica and slurry procedures. Do not dry sweep or blow potentially silica-containing dust with compressed air."],
    ],
    source:["OSHA: Silica hazards and controls","https://www.osha.gov/silica-crystalline/background-info"]
  },
  {
    title:"CAM and CNC handoff", kicker:"DESIGN → CAM → CNC",
    intro:"Carvebench exports a single-sided, closed relief mesh. STL contains geometry only; it does not include toolpaths, cutting speeds, compensation, or controller commands.",
    items:[
      ["Import in millimeters","STL does not encode units. Select millimeters and verify dimensions, orientation, and that the flat base is at Z = 0."],
      ["Define the real setup","In CAM, set stock, origin, clamps, tooling and machining operations for the exact machine and material. The mesh origin is a design reference, not a machine work offset."],
      ["Simulate and verify","Check for collisions, insufficient clearance, and overtravel with the actual stock, tool, and fixtures represented. Confirm the finished form is machinable with your chosen tools."],
      ["Post-process for your controller","Use a validated post-processor. Review the posted output and follow the machine’s approved prove-out procedure before cutting."],
    ],
    ordered:true,
    source:["Autodesk: Mesh import and unit selection","https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-insert-a-mesh-body-into-Fusion-360.html"]
  },
  {
    title:"Shutdown and maintenance", kicker:"AFTER THE JOB",
    intro:"Use the manufacturer’s shutdown sequence and wait for all movement to stop before accessing the work area.",
    items:[
      ["Remove and inspect the work","Use the approved access procedure. Note defects, unusual vibration, or other faults before the next run."],
      ["Isolate before servicing","Follow site energy-isolation procedures if maintenance or clearing a jam exposes anyone to unexpected motion or stored energy. An emergency stop is not energy isolation."],
      ["Clean and record","Use the approved cleanup method for the material. Record maintenance, tool damage, and unresolved faults for the next operator."],
    ],
  },
];
const checked = new Set();

function showChapter(index, focus = false) {
  activeChapter = index;
  all(".chapter-button").forEach((button,i) => button.setAttribute("aria-current", String(i === index)));
  const item = chapters[index], article = $("chapterContent");
  const tag = item.ordered ? "ol" : "ul";
  article.innerHTML = `<div class="eyebrow"><span></span> ${item.kicker}</div><h2>${item.title}</h2><p>${item.intro}</p>` +
    (item.items ? `<${tag}>${item.items.map(([title,text]) => `<li><strong>${title}:</strong> ${text}</li>`).join("")}</${tag}>` :
    `<ul class="check-items">${item.checks.map((text,i) => `<li><label><input type="checkbox" data-check="${i}" ${checked.has(i) ? "checked":""}>${text}</label></li>`).join("")}</ul><p id="checkCount" class="mono" aria-live="polite"></p>`) +
    (item.source ? `<a href="${item.source[1]}" target="_blank" rel="noopener noreferrer">${item.source[0]} <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>` : "");
  if (item.checks) {
    const update = () => { $("checkCount").textContent = `${checked.size} / ${item.checks.length} reviewed`; };
    all("[data-check]").forEach(input => input.addEventListener("change", () => { const i = +input.dataset.check; input.checked ? checked.add(i) : checked.delete(i); update(); }));
    update();
  }
  if (focus) article.focus();
}

function navigate(target, chapter, focus = true) {
  const changed = page !== target;
  page = target;
  for (const name of ["studio","manual","files"]) $(name).hidden = name !== target;
  all("[data-page]").forEach(button => {
    const current = button.dataset.page === target;
    button.classList.toggle("active",current);
    if (current) {
      button.setAttribute("aria-current","page");
      $("crumb").textContent = button.textContent.trim();
    } else button.removeAttribute("aria-current");
  });
  if (target === "manual") showChapter(chapter ?? activeChapter);
  if (target === "studio") renderSoon();
  if (changed && focus) {
    clearTimeout(toastTimer);
    $("status").textContent = "";
    $("content").focus({preventScroll:true});
    window.scrollTo(0,0);
  }
}

$("chapters").innerHTML = chapters.map((v,i) => `<button class="chapter-button" data-chapter="${i}"><span>${String(i+1).padStart(2,"0")}</span>${v.title}</button>`).join("");
all("[data-chapter]").forEach(button => button.addEventListener("click",() => showChapter(+button.dataset.chapter,true)));
all("[data-page]").forEach(button => button.addEventListener("click",() => navigate(button.dataset.page)));
all("[data-open-chapter]").forEach(button => button.addEventListener("click",() => navigate("manual",+button.dataset.openChapter)));

function profile(u,v,pattern) {
  if (pattern === "ripple") {
    const r = Math.hypot((u-.49)*1.02,(v-.51)*.82);
    return (.52 + .44*Math.cos(52*r)) * (.89-.58*r);
  }
  if (pattern === "flute") {
    const s = 2*Math.PI*(u*5 + .26*Math.sin(v*5.1) + .18*v);
    return .20 + .71*Math.pow((1+Math.cos(s))*.5,1.45);
  }
  const g = (x,y,sx,sy) => Math.exp(-(((u-x)/sx)**2 + ((v-y)/sy)**2));
  const t = .87*g(.34,.64,.24,.30)+.7*g(.68,.38,.27,.17)+.58*g(.70,.74,.15,.17)+.22*g(.22,.30,.20,.19) +
    .055*Math.sin(20*u+14*v+2.1*Math.sin(v*8-u*5))+.043*Math.cos(30*v-12*u)*Math.sin(16*u+9*v);
  const level=t*13, fraction=level-Math.floor(level);
  const rise=clamp((fraction-.54)/.42,0,1);
  return (Math.floor(level)+rise*rise*(3-2*rise))/13;
}

let geometry;
function model() {
  const n = SIDES, {width,length,thickness,depth,pattern,heightmap} = design;
  const baseZ = thickness-depth, v = [], top = [], sides = [], bottom = [];
  const samples = [];
  let low=Infinity, high=-Infinity;
  for (let j=0;j<=n;j++) for (let i=0;i<=n;i++) {
    const sample = pattern === "custom" ? heightmap[j*(n+1)+i]/255 : profile(i/n,j/n,pattern);
    samples.push(sample); low=Math.min(low,sample); high=Math.max(high,sample);
  }
  for (let j=0;j<=n;j++) for (let i=0;i<=n;i++) {
    const sample = samples[j*(n+1)+i];
    const h = pattern === "custom" ? sample : (sample-low)/(high-low || 1);
    v.push([i/n*width,j/n*length,baseZ+depth*h]);
  }
  for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
    const a=y*(n+1)+x, b=a+1, c=a+n+1, d=c+1;
    top.push([a,b,d],[a,d,c]);
  }
  const rim = [];
  for (let i=0;i<n;i++) rim.push(i);
  for (let j=0;j<n;j++) rim.push(j*(n+1)+n);
  for (let i=n;i>0;i--) rim.push(n*(n+1)+i);
  for (let j=n;j>0;j--) rim.push(j*(n+1));
  const rimStart=v.length;
  for (const idx of rim) v.push([v[idx][0],v[idx][1],0]);
  const center = v.push([width/2,length/2,0])-1;
  for (let i=0;i<rim.length;i++) {
    const j=(i+1)%rim.length, a=rim[i], b=rim[j], c=rimStart+i,d=rimStart+j;
    sides.push([a,c,d],[a,d,b]);
    bottom.push([center,d,c]);
  }
  return {v, top, sides, bottom};
}

function normal(a,b,c) {
  const x=b[0]-a[0], y=b[1]-a[1], z=b[2]-a[2], X=c[0]-a[0],Y=c[1]-a[1],Z=c[2]-a[2];
  const p=y*Z-z*Y, q=z*X-x*Z, r=x*Y-y*X, l=Math.hypot(p,q,r)||1;
  return [p/l,q/l,r/l];
}

const canvas=$("scene"), ctx=canvas.getContext("2d");
const iso = {yaw:-.53, pitch:.66, zoom:1};
let camera = {...iso}, cameraMode = "iso", frame = 0, drag = null;
function renderSoon() {
  if (!frame) frame = requestAnimationFrame(() => { frame=0; render(); });
}
function line(x1,y1,x2,y2,color,width=1) {
  ctx.strokeStyle=color; ctx.lineWidth=width; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
}
function poly(points) {
  ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
}
function render() {
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if (!w || !h || !ctx) return;
  if (!geometry) geometry = model();
  const dpr=Math.min(2,devicePixelRatio||1);
  if (canvas.width!==Math.round(w*dpr) || canvas.height!==Math.round(h*dpr)) {
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const bg=ctx.createLinearGradient(0,0,w,h);
  bg.addColorStop(0,"#f3f2ea"); bg.addColorStop(1,"#dfdfd5");
  ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
  const {width,length,thickness}=design;
  const {yaw,pitch,zoom}=camera, A=Math.cos(yaw), B=Math.sin(yaw), C=Math.cos(pitch), D=Math.sin(pitch);
  const wide=Math.abs(A)*width+Math.abs(B)*length;
  const tall=(Math.abs(B)*width+Math.abs(A)*length)*D+thickness*C;
  const s=Math.min(w*.77/wide,h*.79/tall)*zoom;
  const cx=w*.5,cy=h*.53;
  const project=(x,y,z) => {
    const X=x-width/2,Y=y-length/2,Z=z-thickness/2;
    const r=X*B+Y*A;
    return [cx+(X*A-Y*B)*s,cy-(r*D+Z*C)*s,r*C-Z*D];
  };
  const step = 28/s;
  const extent=Math.ceil(Math.hypot(w,h)/(step*s*D)/2)+4;
  for(let i=-extent;i<=extent;i++) {
    const p=i*step, end=extent*step;
    const rgb=i%5===0?"#a6a99a55":"#a6a99a35";
    const a=project(width/2+p,length/2-end,0), b=project(width/2+p,length/2+end,0);
    const c=project(width/2-end,length/2+p,0), d=project(width/2+end,length/2+p,0);
    line(...a.slice(0,2),...b.slice(0,2),rgb);
    line(...c.slice(0,2),...d.slice(0,2),rgb);
  }
  const corners=[[0,0],[width,0],[width,length],[0,length]].map(([x,y])=>project(x,y,0));
  ctx.save();
  ctx.filter="blur(13px)"; ctx.fillStyle="#28231664";
  poly(corners.map(([x,y])=>[x+6,y+13])); ctx.fill(); ctx.restore();

  const {v,top,sides}=geometry, proj=v.map(p=>project(...p)), colored=[];
  const mat=materials[design.material];
  const cameraDir=[-B*C,-A*C,D];
  const makeFace=(t,isTop) => {
    const [a,b,c]=t, pa=v[a],pb=v[b],pc=v[c], no=normal(pa,pb,pc);
    if (!isTop && no[0]*cameraDir[0]+no[1]*cameraDir[1]+no[2]*cameraDir[2]<.000001) return;
    const points=[proj[a],proj[b],proj[c]], z=(points[0][2]+points[1][2]+points[2][2])/3;
    const x=(pa[0]+pb[0]+pc[0])/3/width, y=(pa[1]+pb[1]+pc[1])/3/length;
    let light;
    if (isTop) light=.42+.63*(no[0]*(-.52)+no[1]*(-.48)+no[2]*.7);
    else light=.48+.19*(-no[0])+.08*(-no[1]);
    const fleck=Math.sin(x*74+y*219)*Math.cos(x*171-y*91);
    const texture=mat.wood ?
      (Math.sin(y*202+2.1*Math.sin(x*7+y*11)+.6*Math.sin(x*21+y*14))*.04 +
       Math.sin(y*431+1.5*Math.cos(x*13+y*6))*.02 + fleck*.012) :
      (fleck*.033+Math.cos(x*56-y*49)*Math.sin(x*37+y*58)*.027);
    const heightTone=isTop ? (.12*((pa[2]+pb[2]+pc[2])/3-(thickness-design.depth))/design.depth) : 0;
    light = clamp(light+texture+heightTone, .29,1.19);
    const color=`rgb(${mat.rgb.map(k=>Math.round(clamp(k*light,0,255))).join(",")})`;
    colored.push({points,z,color});
  };
  top.forEach(t=>makeFace(t,true));
  sides.forEach(t=>makeFace(t,false));
  colored.sort((a,b)=>b.z-a.z);
  for(const {points,color} of colored) {
    poly(points); ctx.fillStyle=color; ctx.strokeStyle=color; ctx.lineWidth=.62;ctx.stroke();ctx.fill();
  }
  const ox=26, oy=h-29;
  const ax=(x,y,z,letter,color) => {
    const Q=project(width/2+x,length/2+y,thickness/2+z);
    const len=Math.hypot(Q[0]-cx,Q[1]-cy) || 1;
    const px=(Q[0]-cx)/len,py=(Q[1]-cy)/len;
    if (len<.001) return;
    line(ox,oy,ox+px*17,oy+py*17,color,1.2);
    ctx.font="10px 'IBM Plex Mono', monospace";
    ctx.fillStyle=color;ctx.fillText(letter,ox+px*23-3,oy+py*23+3);
  };
  ax(1,0,0,"X","#9b482d"); ax(0,1,0,"Y","#4c694f"); ax(0,0,1,"Z","#4f6378");
  ctx.beginPath(); ctx.arc(ox,oy,2,0,2*Math.PI);ctx.fillStyle="#56594f";ctx.fill();
}

function setCamera(mode) {
  cameraMode=mode;
  camera=mode==="top" ? {yaw:0,pitch:Math.PI/2,zoom:1} : {...iso};
  updateView();
}
function updateView() {
  all("[data-view]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.view===cameraMode)));
  $("zoomIn").disabled=camera.zoom>=2.9;
  $("zoomOut").disabled=camera.zoom<=.55;
  renderSoon();
}
function orbit(dx,dy) {
  cameraMode="orbit";
  camera.yaw+=dx;
  camera.pitch=clamp(camera.pitch+dy,.22,Math.PI/2);
  updateView();
}
function zoom(scale) { camera.zoom=clamp(camera.zoom*scale,.55,2.9);updateView(); }
all("[data-view]").forEach(button => button.addEventListener("click",()=>setCamera(button.dataset.view)));
$("zoomIn").addEventListener("click",()=>zoom(1.2));
$("zoomOut").addEventListener("click",()=>zoom(1/1.2));
$("resetView").addEventListener("click",()=>setCamera("iso"));
canvas.addEventListener("pointerdown",e => {
  if (!e.isPrimary || e.button!==0) return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove",e=>{
  if (!drag || e.pointerId!==drag.id) return;
  orbit((e.clientX-drag.x)*.012,(e.clientY-drag.y)*.009);
  drag.x=e.clientX;drag.y=e.clientY;
});
canvas.addEventListener("lostpointercapture",()=>{drag=null;});
canvas.addEventListener("keydown",e=>{
  const moves={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,.09],ArrowDown:[0,-.09]};
  if (moves[e.key]) {e.preventDefault();orbit(...moves[e.key]);}
  if (e.key==="+" || e.key==="=" || e.key==="-") {e.preventDefault();zoom(e.key==="-"?1/1.2:1.2);}
});
new ResizeObserver(renderSoon).observe($("viewport"));
document.fonts?.ready.then(renderSoon);

const dimFields=["width","length","thickness"];
function syncForm() {
  $("projectName").value=design.name;
  $("material").value=design.material;
  for(const key of dimFields) $(key).value=design[key];
  $("depth").max=Math.max(.1,Math.round((design.thickness-.5)*10)/10);
  $("depth").value=design.depth;
  syncLabels();
}
function syncLabels() {
  $("depthValue").value=`${design.depth} mm`;
  $("patternName").textContent=patterns[design.pattern];
  $("canvasLabel").textContent=`${materials[design.material].label.toUpperCase()} / BAS-RELIEF`;
  $("modelSize").textContent=`${design.width} × ${design.length} × ${design.thickness} mm`;
  all("[data-pattern]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.pattern===design.pattern)));
}
function refreshGeometry() { geometry=null; syncLabels();renderSoon(); }
$("designForm").addEventListener("submit",e=>e.preventDefault());
$("projectName").addEventListener("input",()=> { design.name=$("projectName").value; });
$("material").addEventListener("change",()=>{design.material=$("material").value;syncLabels();renderSoon();});
for (const key of dimFields) $(key).addEventListener("input",()=>{
  const el=$(key);
  if(!el.validity.valid) return;
  design[key]=el.valueAsNumber;
  if(key==="thickness"){
    $("depth").max=Math.round((design.thickness-.5)*10)/10;
    design.depth=Math.min(design.depth,+$("depth").max);
    $("depth").value=design.depth;
  }
  refreshGeometry();
});
$("depth").addEventListener("input",()=>{design.depth=$("depth").valueAsNumber;refreshGeometry();});
all("[data-pattern]").forEach(button=>button.addEventListener("click",()=>{
  design.pattern=button.dataset.pattern;design.heightmap=null;refreshGeometry();
}));
$("loadHeight").addEventListener("click",()=>$("heightFile").click());
$("heightFile").addEventListener("change",async e=>{
  const file=e.target.files[0]; e.target.value="";
  if(!file)return;
  if(!(/\.(png|jpe?g)$/i.test(file.name)) || file.size>10*1024*1024) {
    status("Choose a PNG or JPEG heightmap under 10 MB.",true);return;
  }
  let bitmap;
  try{
    bitmap=await createImageBitmap(file);
    const c=document.createElement("canvas");c.width=c.height=SIDES+1;
    const tc=c.getContext("2d",{willReadFrequently:true});tc.fillStyle="#000";tc.fillRect(0,0,c.width,c.height);
    tc.drawImage(bitmap,0,0,c.width,c.height);
    const data=tc.getImageData(0,0,c.width,c.height).data, values=[];
    for (let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) {
      const i=((c.height-1-y)*c.width+x)*4;
      values.push(Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]));
    }
    design.heightmap=values;design.pattern="custom";refreshGeometry();
    status("Heightmap imported. Brighter pixels create higher areas.");
  }catch{status("This image could not be decoded. Try a different PNG or JPEG.",true);}
  finally{bitmap?.close();}
});

function ready() {
  if (!$("projectName").value.trim()) $("projectName").setCustomValidity("Enter a project name.");
  const valid=$("designForm").checkValidity();
  if(!valid){navigate("studio");$("designForm").reportValidity();status("Correct the highlighted design field before downloading.",true);}
  $("projectName").setCustomValidity("");
  return valid;
}
function fileName() {
  return design.name.trim().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"") || "carvebench-project";
}
function download(blob,name) {
  const url=URL.createObjectURL(blob), anchor=document.createElement("a");
  anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function save() {
  if(!ready())return;
  const file={format:"carvebench-relief",version:1,units:"mm", ...design, name:design.name.trim()};
  download(new Blob([JSON.stringify(file,null,2)],{type:"application/json"}),`${fileName()}.json`);
  status("Editable project download requested.");
}
function exportSTL() {
  if(!ready())return;
  if(!geometry) geometry=model();
  const {v,top,sides,bottom}=geometry, faces=[...top,...sides,...bottom];
  const buf=new ArrayBuffer(84+faces.length*50), view=new DataView(buf);
  new Uint8Array(buf,0,80).set(new TextEncoder().encode("Carvebench relief | millimeter coordinates | geometry only"));
  view.setUint32(80,faces.length,true);
  let offset=84;
  for (const [i,j,k] of faces) {
    for(const p of [normal(v[i],v[j],v[k]),v[i],v[j],v[k]]) for (const val of p) {view.setFloat32(offset,val,true);offset+=4;}
    offset+=2;
  }
  download(new Blob([buf],{type:"model/stl"}),`${fileName()}.stl`);
  status("STL download requested. Choose millimeters when importing in CAM.");
}
for (const id of ["save","saveFile"]) $(id).addEventListener("click",save);
for (const id of ["export","exportFile"]) $(id).addEventListener("click",exportSTL);
$("importProject").addEventListener("click",()=>$("projectFile").click());
function isTenth(x,min,max) { return Number.isFinite(x) && x>=min && x<=max && Math.abs(x*10-Math.round(x*10))<.000001; }
function isProject(p) {
  return p && p.format==="carvebench-relief" && p.version===1 && p.units==="mm" &&
    typeof p.name==="string" && p.name.trim().length>0 && p.name.length<=80 &&
    Object.hasOwn(materials,p.material) && Object.hasOwn(patterns,p.pattern) &&
    isTenth(p.width,10,2000) && isTenth(p.length,10,2000) && isTenth(p.thickness,1,300) &&
    isTenth(p.depth,.1,Math.round((p.thickness-.5)*10)/10) &&
    (p.pattern!=="custom" || (Array.isArray(p.heightmap) && p.heightmap.length===(SIDES+1)**2 &&
      p.heightmap.every(v=>Number.isInteger(v) && v>=0 && v<=255)));
}
$("projectFile").addEventListener("change",async e=>{
  const file=e.target.files[0];e.target.value="";
  if(!file)return;
  if(file.size>1024*1024) {status("This project exceeds the 1 MB file limit.",true);return;}
  try {
    const p=JSON.parse(await file.text());
    if(!isProject(p)) throw new Error("Invalid project");
    design=Object.fromEntries(Object.keys(defaults).map(key=>[key,p[key]]));
    if(design.pattern!=="custom")design.heightmap=null;
    syncForm();geometry=null;setCamera("iso");navigate("studio");
    status(`Opened ${design.name}.`);
  }catch{ status("Could not open this file. Choose a valid Carvebench project JSON.",true); }
});
syncForm();updateView();renderSoon();
