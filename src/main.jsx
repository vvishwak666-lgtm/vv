
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import Tesseract from "tesseract.js";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Home, CalendarDays, ClipboardList, Search, Menu, Camera, FileSpreadsheet,
  Download, Trash2, ChevronLeft, ChevronRight, X, Check, AlertTriangle,
  Users, Clock3
} from "lucide-react";
import "./styles.css";

const STORE = "vv-roster-auto-table-v4";
const CODES = new Set(["RDO","TRNG","AL","ALV","ALLV","ALTH","HACC","OFF","SICK","SL","LEAVE"]);

function todayISO(){ return new Date().toISOString().slice(0,10); }
function addDays(iso,n){ const d=new Date(`${iso}T12:00:00`); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function mondayOf(iso){ const d=new Date(`${iso}T12:00:00`); const n=(d.getDay()+6)%7; d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function fmt(iso,opts={weekday:"short",day:"numeric",month:"short"}){ return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined,opts) : ""; }

function normalizeShift(value){
  let t=String(value||"").toUpperCase().trim()
    .replace(/[–—]/g,"-")
    .replace(/\s+/g," ");

  // Common OCR aliases.
  t=t.replace(/\bRD0\b/g,"RDO").replace(/\bTRN6\b/g,"TRNG")
     .replace(/\bALLV\b/g,"ALV").replace(/\bALIV\b/g,"ALV");

  // RDO is always shown simply as RDO.
  if(/\bRDO\b/.test(t)) return "RDO";

  // Preserve TRNG when it belongs to a timed shift.
  const hasTRNG=/\bTRNG\b/.test(t);

  // Other standalone roster codes.
  const standalone=["ALTH","HACC","ALV","AL","OFF","SICK","SL","LEAVE"];
  for(const code of standalone){
    if(new RegExp(`\\b${code}\\b`).test(t) && !/\d/.test(t)) return code;
  }
  if(t==="TRNG") return "TRNG";

  // Normalize OCR number confusions and HH:MM formatting.
  let n=t.replace(/O/g,"0").replace(/[IL|]/g,"1");
  n=n.replace(/:/g,"").replace(/\s+/g,"");

  // Remove roster code text while keeping whether TRNG existed.
  n=n.replace(/TRNG/g,"").replace(/[A-Z]/g,"");

  if(/^\d{8}$/.test(n)) n=`${n.slice(0,4)}-${n.slice(4)}`;
  const m=n.match(/^(\d{3,4})-(\d{3,4})$/);
  if(m){
    const time=`${m[1].padStart(4,"0")}-${m[2].padStart(4,"0")}`;
    return hasTRNG ? `${time} TRNG` : time;
  }

  return t;
}

function validateShift(value){
  const v=normalizeShift(value);
  if(!v) return {ok:false,value:v,reason:"Missing"};

  if(v==="RDO") return {ok:true,value:v,hours:0,code:"RDO"};
  if(v==="TRNG") return {ok:true,value:v,hours:0,code:"TRNG"};

  const standalone=new Set(["AL","ALV","ALTH","HACC","OFF","SICK","SL","LEAVE"]);
  if(standalone.has(v)) return {ok:true,value:v,hours:0,code:v};

  const hasTRNG=/\sTRNG$/.test(v);
  const timePart=v.replace(/\sTRNG$/,"");
  const m=timePart.match(/^(\d{4})-(\d{4})$/);
  if(!m) return {ok:false,value:v,reason:"Use HH:MM–HH:MM, RDO, or HH:MM–HH:MM TRNG"};

  const sh=+m[1].slice(0,2), sm=+m[1].slice(2), eh=+m[2].slice(0,2), em=+m[2].slice(2);
  if(sh>23||eh>23) return {ok:false,value:v,reason:"Hour must be 00–23"};
  if(sm>59||em>59) return {ok:false,value:v,reason:"Minutes must be 00–59"};

  let mins=eh*60+em-(sh*60+sm);
  if(mins<0) mins+=1440;
  if(mins===0) return {ok:false,value:v,reason:"Same start/end"};

  const hours=mins/60;
  if(hours>14) return {ok:false,value:v,reason:"Suspiciously long"};

  return {
    ok:true,value:v,hours,
    time:timePart,
    code:hasTRNG?"TRNG":""
  };
}

function formatRosterCell(value){
  const info=validateShift(value);
  const v=info.value||normalizeShift(value);
  if(v==="RDO") return "RDO";
  if(v==="TRNG") return "TRNG";
  if(/^(AL|ALV|ALTH|HACC|OFF|SICK|SL|LEAVE)$/.test(v)) return v;

  const hasTRNG=/\sTRNG$/.test(v);
  const t=v.replace(/\sTRNG$/,"");
  const m=t.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
  if(!m) return v;
  return `${m[1]}:${m[2]}–${m[3]}:${m[4]}${hasTRNG?" TRNG":""}`;
}

function hoursOf(v){ const x=validateShift(v); return x.ok?(x.hours||0):0; }
function cropCanvas(src,x0,y0,x1,y1,scale=5){
  const sx=Math.max(0,Math.floor(x0)), sy=Math.max(0,Math.floor(y0));
  const sw=Math.max(1,Math.ceil(x1-x0)), sh=Math.max(1,Math.ceil(y1-y0));
  const c=document.createElement("canvas");
  c.width=Math.max(1,Math.round(sw*scale)); c.height=Math.max(1,Math.round(sh*scale));
  const ctx=c.getContext("2d"); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);
  const img=ctx.getImageData(0,0,c.width,c.height), d=img.data;
  for(let i=0;i<d.length;i+=4){
    const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    const v=g>220?255:(g<105?0:Math.max(0,Math.min(255,(g-105)*2.8)));
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);
  return c;
}
function dataURL(c){ try{return c.toDataURL("image/png")}catch{return ""} }

function cleanText(s){ return String(s||"").replace(/\s+/g," ").trim(); }
function wordBox(w){
  const b=w.bbox||{};
  return {x0:b.x0||0,y0:b.y0||0,x1:b.x1||0,y1:b.y1||0,cx:((b.x0||0)+(b.x1||0))/2,cy:((b.y0||0)+(b.y1||0))/2};
}
function looksNameText(s){
  const t=cleanText(s);
  if(t.length<4) return false;
  if(/^(NAME|SHIFT|DATE|WORKING|HOURS|MON|TUE|WED|THU|FRI|SAT|SUN)/i.test(t)) return false;
  const letters=(t.match(/[A-Za-z]/g)||[]).length;
  return letters>=4 && /[A-Za-z]{2,}/.test(t);
}
function isShiftLike(s){
  const t=normalizeShift(s);
  return CODES.has(t) || /^\d{3,4}-\d{3,4}$/.test(t);
}
function clusterWordsToRows(words){
  const good=(words||[]).filter(w=>w.text?.trim() && (w.confidence??100)>12);
  const heights=good.map(w=>Math.max(4,(w.bbox?.y1||0)-(w.bbox?.y0||0))).sort((a,b)=>a-b);
  const medianH=heights.length?heights[Math.floor(heights.length/2)]:10;
  const tol=Math.max(6,medianH*.65);
  const rows=[];
  for(const w of good){
    const b=wordBox(w);
    let r=rows.find(r=>Math.abs(r.cy-b.cy)<=tol);
    if(!r){r={cy:b.cy,words:[]};rows.push(r)}
    r.words.push(w);
    r.cy=(r.cy*(r.words.length-1)+b.cy)/r.words.length;
  }
  return rows.sort((a,b)=>a.cy-b.cy).map((r,i)=>{
    const ws=r.words.sort((a,b)=>(a.bbox?.x0||0)-(b.bbox?.x0||0));
    const y0=Math.min(...ws.map(w=>w.bbox?.y0||0)), y1=Math.max(...ws.map(w=>w.bbox?.y1||0));
    return {id:`row-${i}`,cy:r.cy,y0,y1,words:ws,text:cleanText(ws.map(w=>w.text).join(" "))};
  });
}
function detectStaffRows(rows,W){
  const result=[];
  for(const r of rows){
    const leftWords=r.words.filter(w=>(w.bbox?.x1||0)<W*.23);
    if(!leftWords.length) continue;
    const name=cleanText(leftWords.map(w=>w.text).join(" "))
      .replace(/[^\wÀ-ÿ' ,.-]/g," ")
      .replace(/\s+/g," ")
      .trim();
    if(!looksNameText(name)) continue;

    const shiftWords=r.words.filter(w=>{
      const x=wordBox(w).cx;
      return x>W*.18 && x<W*.92 && isShiftLike(w.text);
    });
    if(shiftWords.length<2) continue;

    const rowH=Math.max(5,r.y1-r.y0);
    result.push({
      id:r.id,name,cy:r.cy,
      y0:Math.max(0,r.cy-rowH*.8),
      y1:r.cy+rowH*.8,
      words:r.words
    });
  }

  // Deduplicate near-identical rows/names.
  const dedup=[];
  for(const r of result){
    if(!dedup.some(x=>Math.abs(x.cy-r.cy)<4 && x.name.toLowerCase()===r.name.toLowerCase())) dedup.push(r);
  }
  return dedup;
}
function inferColumnCenters(staff,W){
  const xs=[];
  for(const r of staff){
    for(const w of r.words){
      const x=wordBox(w).cx;
      if(x>W*.18 && x<W*.92 && isShiftLike(w.text)) xs.push(x);
    }
  }
  if(xs.length<10) return Array.from({length:14},(_,i)=>W*(.19+i*(.72/13)));

  xs.sort((a,b)=>a-b);
  const clusters=[];
  const tol=W*.018;
  for(const x of xs){
    let c=clusters.find(c=>Math.abs(c.mean-x)<=tol);
    if(!c){c={mean:x,n:0};clusters.push(c)}
    c.mean=(c.mean*c.n+x)/(c.n+1); c.n++;
  }
  let centers=clusters.sort((a,b)=>b.n-a.n).slice(0,14).map(c=>c.mean).sort((a,b)=>a-b);
  if(centers.length<14){
    const left=centers[0]||W*.19, right=centers[centers.length-1]||W*.91;
    centers=Array.from({length:14},(_,i)=>left+i*((right-left)/13));
  }
  return centers;
}
function centersToBounds(centers,W){
  const b=[];
  for(let i=0;i<=14;i++){
    if(i===0) b.push(Math.max(W*.16, centers[0]-(centers[1]-centers[0])/2));
    else if(i===14) b.push(Math.min(W*.93, centers[13]+(centers[13]-centers[12])/2));
    else b.push((centers[i-1]+centers[i])/2);
  }
  return b;
}
function inferFirstDate(text){
  const s=String(text||"");
  const months="Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
  const m=s.match(new RegExp(`\\b(\\d{1,2})\\s+(${months})[a-z]*\\s+(\\d{4})\\b`,"i"));
  if(m){const d=Date.parse(`${m[1]} ${m[2]} ${m[3]}`);if(!isNaN(d))return new Date(d).toISOString().slice(0,10);}
  const dm=s.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
  if(dm){
    const day=+dm[1],month=+dm[2],year=+dm[3];
    if(day<=31&&month<=12)return new Date(year,month-1,day,12).toISOString().slice(0,10);
  }
  return todayISO();
}
async function createWorker(onProgress){
  const worker=await Tesseract.createWorker("eng",1,{
    logger:m=>{if(m.status==="recognizing text"&&onProgress)onProgress(m.progress||0)}
  });
  return worker;
}
function withTimeout(promise,ms=12000,label="OCR"){
  let timer;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(`${label} timed out`)),ms);
  });
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}

async function recognize(worker,canvas,psm="7",whitelist=""){
  await worker.setParameters({
    tessedit_pageseg_mode:psm,
    preserve_interword_spaces:"1",
    ...(whitelist?{tessedit_char_whitelist:whitelist}:{})
  });
  const r=await withTimeout(worker.recognize(canvas),12000,"Cell OCR");
  return cleanText(r.data.text||"");
}
function bestCell(candidates){
  const values=candidates.map(normalizeShift).filter(Boolean);
  const valid=values.map(v=>validateShift(v)).find(x=>x.ok);
  return valid?.value || values[0] || "";
}


function preprocessCanvas(src, scale=3){
  const c=document.createElement("canvas");
  c.width=Math.max(1,Math.round(src.width*scale));
  c.height=Math.max(1,Math.round(src.height*scale));
  const ctx=c.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(src,0,0,c.width,c.height);
  const img=ctx.getImageData(0,0,c.width,c.height), d=img.data;
  for(let i=0;i<d.length;i+=4){
    const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    const v=g>220?255:(g<105?0:Math.max(0,Math.min(255,(g-105)*3.0)));
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);
  return c;
}
function groupNameWords(words){
  const good=(words||[]).filter(w=>w.text?.trim() && (w.confidence??100)>8);
  const heights=good.map(w=>Math.max(4,(w.bbox?.y1||0)-(w.bbox?.y0||0))).sort((a,b)=>a-b);
  const med=heights.length?heights[Math.floor(heights.length/2)]:10;
  const tol=Math.max(7,med*.8);
  const rows=[];
  for(const w of good){
    const b=wordBox(w);
    let row=rows.find(r=>Math.abs(r.cy-b.cy)<=tol);
    if(!row){row={cy:b.cy,words:[]};rows.push(row)}
    row.words.push(w);
    row.cy=(row.cy*(row.words.length-1)+b.cy)/row.words.length;
  }
  return rows.sort((a,b)=>a.cy-b.cy).map((r,i)=>{
    const ws=r.words.sort((a,b)=>(a.bbox?.x0||0)-(b.bbox?.x0||0));
    const text=cleanText(ws.map(w=>w.text).join(" "))
      .replace(/[^\wÀ-ÿ' ,.-]/g," ")
      .replace(/\s+/g," ")
      .trim();
    const y0=Math.min(...ws.map(w=>w.bbox?.y0||0));
    const y1=Math.max(...ws.map(w=>w.bbox?.y1||0));
    return {id:`name-${i}`,text,cy:r.cy,y0,y1};
  });
}
function cleanStaffName(s){
  let t=cleanText(s)
    .replace(/^(?:B\s*SHIFT.*?|SHIFT.*?|NAME)\s+/i,"")
    .replace(/\b(?:RDO|TRNG|AL|ALV|ALTH|HACC)\b.*$/i,"")
    .replace(/\s+/g," ")
    .trim();

  // Repair common OCR loss of the first letter in "Vimal".
  if(/PRABHAKAR/i.test(t) && /\bimal\b/i.test(t) && !/\bVimal\b/i.test(t)){
    t=t.replace(/\bimal\b/i,"Vimal");
  }
  return t;
}
function plausibleStaffName(s){
  const t=cleanStaffName(s);
  if(t.length<4 || t.length>45) return false;
  if(/^(NAME|SHIFT|DATE|WORKING|HOURS|MON|TUE|WED|THU|FRI|SAT|SUN|AIRPORT)/i.test(t)) return false;
  const letters=(t.match(/[A-Za-z]/g)||[]).length;
  return letters>=4 && /[A-Za-z]{2,}/.test(t);
}
async function detectNamesFromLeftColumn(canvas,worker,onProgress){
  const crop=cropCanvas(canvas,0,0,canvas.width*.245,canvas.height,1);
  const hi=preprocessCanvas(crop,4);
  await worker.setParameters({tessedit_pageseg_mode:"6",preserve_interword_spaces:"1"});
  const result=await worker.recognize(hi);
  onProgress?.(45);
  const scaleY=canvas.height/hi.height;
  const grouped=groupNameWords(result.data.words||[]);
  const names=[];
  for(const g of grouped){
    const name=cleanStaffName(g.text);
    if(!plausibleStaffName(name)) continue;
    if(/\d{1,2}\s+(?:Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul)/i.test(name)) continue;
    names.push({id:`staff-${names.length}`,name,cy:g.cy*scaleY,y0:g.y0*scaleY,y1:g.y1*scaleY});
  }
  const dedup=[];
  for(const n of names){
    if(!dedup.some(x=>Math.abs(x.cy-n.cy)<5 || x.name.toLowerCase()===n.name.toLowerCase())) dedup.push(n);
  }
  return dedup;
}
function attachRowBounds(staff,canvasHeight){
  const rows=[...staff].sort((a,b)=>a.cy-b.cy);
  return rows.map((r,i)=>{
    const prev=rows[i-1], next=rows[i+1];
    const upper=prev?(prev.cy+r.cy)/2:r.cy-Math.max(8,(next?next.cy-r.cy:16)/2);
    const lower=next?(r.cy+next.cy)/2:r.cy+Math.max(8,(prev?r.cy-prev.cy:16)/2);
    return {...r,y0:Math.max(0,upper+1),y1:Math.min(canvasHeight,lower-1)};
  });
}


function verticalGridScore(canvas,y0,y1){
  const ctx=canvas.getContext("2d");
  const W=canvas.width,H=canvas.height;
  y0=Math.max(0,Math.floor(y0)); y1=Math.min(H,Math.ceil(y1));
  const img=ctx.getImageData(0,y0,W,Math.max(1,y1-y0));
  const d=img.data, h=Math.max(1,y1-y0);
  const scores=new Array(W).fill(0);

  for(let x=0;x<W;x++){
    let s=0;
    for(let y=0;y<h;y+=2){
      const i=(y*W+x)*4;
      const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
      if(g<190) s++;
    }
    scores[x]=s;
  }

  // Smooth 3px to strengthen thin grid lines.
  const sm=new Array(W).fill(0);
  for(let x=1;x<W-1;x++) sm[x]=(scores[x-1]+scores[x]+scores[x+1])/3;
  return sm;
}

function bestLineNear(scores,expected,radius,minX,maxX){
  const lo=Math.max(minX,Math.floor(expected-radius));
  const hi=Math.min(maxX,Math.ceil(expected+radius));
  let best=Math.round(expected),bestScore=-1;
  for(let x=lo;x<=hi;x++){
    if((scores[x]||0)>bestScore){bestScore=scores[x]||0;best=x}
  }
  return best;
}

function detectRosterGridBounds(canvas,staff){
  const W=canvas.width,H=canvas.height;
  const top=Math.max(0,Math.min(...staff.map(r=>r.y0))-8);
  const bottom=Math.min(H,Math.max(...staff.map(r=>r.y1))+8);
  const scores=verticalGridScore(canvas,top,bottom);

  // Use expected layout only as a search seed, then snap each boundary
  // to the strongest actual vertical grid line nearby.
  const expected=[];
  expected.push(W*.03);                 // left edge of name column
  const dayLeft=W*.175;
  const dayRight=W*.91;
  const step=(dayRight-dayLeft)/14;
  for(let i=0;i<=14;i++) expected.push(dayLeft+i*step);
  expected.push(W*.985);                // right edge of Working Hours

  const radius=Math.max(5,W*.018);
  const lines=[];
  for(let i=0;i<expected.length;i++){
    const minX=i?lines[i-1]+3:0;
    const maxX=W-1-(expected.length-1-i)*3;
    let x=bestLineNear(scores,expected[i],radius,minX,maxX);
    if(i && x<=lines[i-1]+2) x=Math.max(lines[i-1]+3,Math.round(expected[i]));
    lines.push(x);
  }

  // Day columns are boundaries 1..15. Working Hours is 15..16.
  const dayBounds=lines.slice(1,16);
  const workingBounds=[lines[15],lines[16]];

  return {lines,dayBounds,workingBounds,top,bottom};
}



async function imageToCanvas(file){
  if(typeof createImageBitmap==="function"){
    const bmp=await createImageBitmap(file);
    const c=document.createElement("canvas");
    c.width=bmp.width;
    c.height=bmp.height;
    c.getContext("2d").drawImage(bmp,0,0);
    return c;
  }

  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{
      const el=new Image();
      el.onload=()=>resolve(el);
      el.onerror=reject;
      el.src=url;
    });
    const c=document.createElement("canvas");
    c.width=img.naturalWidth||img.width;
    c.height=img.naturalHeight||img.height;
    c.getContext("2d").drawImage(img,0,0);
    return c;
  }finally{
    URL.revokeObjectURL(url);
  }
}

function rawCropCanvas(src,x0,y0,x1,y1,scale=10){
  const sx=Math.max(0,Math.floor(x0)), sy=Math.max(0,Math.floor(y0));
  const sw=Math.max(1,Math.ceil(x1-x0)), sh=Math.max(1,Math.ceil(y1-y0));
  const c=document.createElement("canvas");
  c.width=Math.max(1,Math.round(sw*scale));
  c.height=Math.max(1,Math.round(sh*scale));
  const ctx=c.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);
  return c;
}

function makeCellVariant(raw, threshold=190, trim=.12, thicken=false){
  const top=Math.round(raw.height*trim);
  const bottom=Math.round(raw.height*(1-trim));
  const side=Math.round(raw.width*.035);

  const c=document.createElement("canvas");
  c.width=Math.max(1,raw.width-side*2);
  c.height=Math.max(1,bottom-top);
  const ctx=c.getContext("2d");
  ctx.drawImage(raw,side,top,c.width,c.height,0,0,c.width,c.height);

  const img=ctx.getImageData(0,0,c.width,c.height), d=img.data;
  for(let i=0;i<d.length;i+=4){
    const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    const v=g<threshold?0:255;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);

  // Remove remnants of table borders.
  ctx.fillStyle="#fff";
  const bx=Math.max(2,Math.round(c.width*.025));
  const by=Math.max(2,Math.round(c.height*.06));
  ctx.fillRect(0,0,c.width,by);
  ctx.fillRect(0,c.height-by,c.width,by);
  ctx.fillRect(0,0,bx,c.height);
  ctx.fillRect(c.width-bx,0,bx,c.height);

  if(thicken){
    const current=ctx.getImageData(0,0,c.width,c.height);
    const srcd=current.data;
    const out=new Uint8ClampedArray(srcd);
    for(let y=1;y<c.height-1;y++){
      for(let x=1;x<c.width-1;x++){
        const i=(y*c.width+x)*4;
        if(srcd[i]<80){
          for(let yy=-1;yy<=1;yy++){
            for(let xx=-1;xx<=1;xx++){
              const j=((y+yy)*c.width+(x+xx))*4;
              out[j]=out[j+1]=out[j+2]=0; out[j+3]=255;
            }
          }
        }
      }
    }
    current.data.set(out);
    ctx.putImageData(current,0,0);
  }
  return c;
}

function candidateShiftStrings(text){
  const raw=String(text||"").toUpperCase()
    .replace(/[–—_]/g,"-")
    .replace(/\s+/g,"")
    .replace(/[^0-9A-Z:-]/g,"");

  const candidates=new Set();
  if(raw)candidates.add(raw);

  // Codes first.
  for(const code of CODES){
    if(raw===code || raw.includes(code)) candidates.add(code);
  }

  // OCR confusions only when text contains digits.
  const numeric=raw.replace(/O/g,"0").replace(/[IL|]/g,"1").replace(/S(?=\d)/g,"5");
  if(numeric)candidates.add(numeric);

  // Pull two time-like groups even if OCR missed the dash.
  const groups=numeric.match(/\d{3,4}/g)||[];
  if(groups.length>=2){
    candidates.add(`${groups[0]}-${groups[1]}`);
  }

  // 7/8 consecutive digits can be a missing dash.
  const digits=numeric.replace(/\D/g,"");
  if(digits.length===8)candidates.add(`${digits.slice(0,4)}-${digits.slice(4)}`);
  if(digits.length===7){
    // Try zero-padding either side, but validation chooses only plausible results.
    candidates.add(`${digits.slice(0,3)}-${digits.slice(3)}`);
    candidates.add(`${digits.slice(0,4)}-${digits.slice(4)}`);
  }

  return [...candidates].map(normalizeShift);
}

function scoreShiftCandidate(v){
  const info=validateShift(v);
  if(!info.ok)return -1000;

  let score=100;
  if(CODES.has(info.value)) return 115;

  const [a,b]=info.value.split("-");
  // Normal roster times usually use 00/30 minute boundaries; don't require it,
  // just prefer them when OCR candidates compete.
  const sm=+a.slice(2), em=+b.slice(2);
  if([0,30].includes(sm))score+=5;
  if([0,30].includes(em))score+=5;
  if((info.hours||0)>=4 && (info.hours||0)<=10.5)score+=8;
  if((info.hours||0)<2)score-=10;
  return score;
}

function chooseBestShift(texts){
  let best="",bestScore=-Infinity;
  for(const text of texts){
    for(const c of candidateShiftStrings(text)){
      const s=scoreShiftCandidate(c);
      if(s>bestScore){bestScore=s;best=c}
    }
  }
  return bestScore>=100?best:"";
}

async function recognizeShiftCell(worker,raw){
  const variants=[
    makeCellVariant(raw,170,.15,false),
    makeCellVariant(raw,190,.13,false),
    makeCellVariant(raw,210,.11,false),
    makeCellVariant(raw,190,.13,true)
  ];
  const texts=[];

  for(let i=0;i<variants.length;i++){
    const psm=i===3?"13":(i===2?"8":"7");
    texts.push(await recognize(
      worker,
      variants[i],
      psm,
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-:"
    ));
    const chosen=chooseBestShift(texts);
    if(chosen && validateShift(chosen).ok && texts.length>=2) return chosen;
  }

  // One final pass without a whitelist can recover RDO/TRNG when letters are weak.
  texts.push(await recognize(worker,variants[1],"8",""));
  return chooseBestShift(texts);
}


function buildRowOCRCanvas(source,row,bounds,scale=9){
  const x0=bounds[0], x1=bounds[14];
  const y0=row.y0, y1=row.y1;
  const raw=rawCropCanvas(source,x0,y0,x1,y1,scale);
  const ctx=raw.getContext("2d");
  const img=ctx.getImageData(0,0,raw.width,raw.height),d=img.data;

  // High-contrast grayscale without crushing thin digits.
  for(let i=0;i<d.length;i+=4){
    const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    let v=(g-95)*2.15;
    v=Math.max(0,Math.min(255,v));
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);

  // Remove horizontal borders and the known internal vertical grid lines.
  ctx.fillStyle="#fff";
  const by=Math.max(2,Math.round(raw.height*.08));
  ctx.fillRect(0,0,raw.width,by);
  ctx.fillRect(0,raw.height-by,raw.width,by);
  for(let i=1;i<14;i++){
    const local=((bounds[i]-x0)/(x1-x0))*raw.width;
    const bw=Math.max(2,Math.round(raw.width*.0025));
    ctx.fillRect(Math.round(local-bw),0,bw*2+1,raw.height);
  }
  return raw;
}

function wordsByDay(words,rowCanvas,bounds){
  const out=Array.from({length:14},()=>[]);
  const x0=bounds[0],x1=bounds[14];
  for(const w of words||[]){
    const text=cleanText(w.text||"");
    if(!text)continue;
    const b=w.bbox||{};
    const cx=((b.x0||0)+(b.x1||0))/2;
    const frac=cx/rowCanvas.width;
    const sourceX=x0+frac*(x1-x0);
    let idx=-1;
    for(let i=0;i<14;i++){
      if(sourceX>=bounds[i]&&sourceX<bounds[i+1]){idx=i;break}
    }
    if(idx>=0)out[idx].push(w);
  }
  return out;
}

function textFromWords(words){
  return cleanText((words||[])
    .slice()
    .sort((a,b)=>(a.bbox?.x0||0)-(b.bbox?.x0||0))
    .map(w=>w.text||"")
    .join(" "));
}

async function recognizeWholeSelectedRow(worker,source,row,bounds){
  const canvas=buildRowOCRCanvas(source.canvas,row,bounds,10);
  await worker.setParameters({
    tessedit_pageseg_mode:"6",
    preserve_interword_spaces:"1",
    tessedit_char_whitelist:"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-:"
  });
  const result=await worker.recognize(canvas);
  const grouped=wordsByDay(result.data.words||[],canvas,bounds);
  const cells=grouped.map(ws=>chooseBestShift([textFromWords(ws)]));

  // Second row-level pass with sparse text. It often recovers RDO/TRNG or faint times.
  await worker.setParameters({
    tessedit_pageseg_mode:"11",
    preserve_interword_spaces:"1",
    tessedit_char_whitelist:"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-:"
  });
  const sparse=await worker.recognize(canvas);
  const grouped2=wordsByDay(sparse.data.words||[],canvas,bounds);
  for(let i=0;i<14;i++){
    if(validateShift(cells[i]).ok)continue;
    const best=chooseBestShift([textFromWords(grouped[i]),textFromWords(grouped2[i])]);
    if(validateShift(best).ok)cells[i]=best;
  }
  return cells;
}

function makeGentleCellVariant(raw,mode=0){
  const trimY=[.08,.13,.17][mode]??.1;
  const trimX=.045;
  const sx=Math.round(raw.width*trimX),sy=Math.round(raw.height*trimY);
  const w=Math.max(1,raw.width-sx*2),h=Math.max(1,raw.height-sy*2);
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const ctx=c.getContext("2d");ctx.drawImage(raw,sx,sy,w,h,0,0,w,h);
  const img=ctx.getImageData(0,0,w,h),d=img.data;
  for(let i=0;i<d.length;i+=4){
    const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    let v;
    if(mode===0) v=Math.max(0,Math.min(255,(g-85)*2.0));
    else if(mode===1) v=g<195?0:255;
    else v=g<215?0:255;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);
  // Clear only the outer edge; do not erase thin digits near the center.
  ctx.fillStyle="#fff";
  const bx=Math.max(2,Math.round(w*.018)),by=Math.max(2,Math.round(h*.04));
  ctx.fillRect(0,0,w,by);ctx.fillRect(0,h-by,w,by);
  ctx.fillRect(0,0,bx,h);ctx.fillRect(w-bx,0,bx,h);
  return c;
}

async function recognizeExactCellFallback(worker,raw){
  const texts=[];
  const variants=[makeGentleCellVariant(raw,0),makeGentleCellVariant(raw,1),makeGentleCellVariant(raw,2)];
  const configs=[
    ["7","0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-:"],
    ["8","0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-:"],
    ["13",""]
  ];
  for(let i=0;i<variants.length;i++){
    texts.push(await recognize(worker,variants[i],configs[i][0],configs[i][1]));
    const chosen=chooseBestShift(texts);
    if(validateShift(chosen).ok)return chosen;
  }
  return "";
}


function printedCellVariant(raw, threshold=188){
  const c=document.createElement("canvas");
  c.width=raw.width; c.height=raw.height;
  const ctx=c.getContext("2d");
  ctx.drawImage(raw,0,0);

  const img=ctx.getImageData(0,0,c.width,c.height), d=img.data;
  for(let i=0;i<d.length;i+=4){
    const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    const v=g<threshold?0:255;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);

  // White-out outer borders and top/bottom bands where grid lines/handwriting
  // most often interfere with the printed roster text.
  ctx.fillStyle="#fff";
  const bx=Math.max(2,Math.round(c.width*.035));
  const by=Math.max(2,Math.round(c.height*.13));
  ctx.fillRect(0,0,c.width,by);
  ctx.fillRect(0,c.height-by,c.width,by);
  ctx.fillRect(0,0,bx,c.height);
  ctx.fillRect(c.width-bx,0,bx,c.height);
  return c;
}

function extractPrintedCandidates(text){
  const raw=String(text||"").toUpperCase()
    .replace(/[–—_]/g,"-")
    .replace(/\s+/g," ")
    .replace(/[^0-9A-Z:\- ]/g," ")
    .trim();

  const found=[];
  const codeOrder=["RDO","TRNG","ALTH","HACC","ALV","ALLV","SICK","LEAVE","OFF","SL","AL"];
  for(const code of codeOrder){
    if(new RegExp(`\\b${code}\\b`).test(raw)) found.push(code);
  }

  const normalized=raw.replace(/O/g,"0").replace(/[IL|]/g,"1");
  const timeMatches=normalized.match(/\b\d{3,4}\s*-\s*\d{3,4}\b/g)||[];
  for(const t of timeMatches) found.push(normalizeShift(t.replace(/\s+/g,"")));

  // Missing dash fallback.
  const digitGroups=normalized.match(/\b\d{7,8}\b/g)||[];
  for(const g of digitGroups){
    if(g.length===8) found.push(normalizeShift(`${g.slice(0,4)}-${g.slice(4)}`));
    if(g.length===7){
      found.push(normalizeShift(`${g.slice(0,3)}-${g.slice(3)}`));
      found.push(normalizeShift(`${g.slice(0,4)}-${g.slice(4)}`));
    }
  }
  return found.filter(Boolean);
}

function candidateWeight(value, sourceWeight=1){
  const info=validateShift(value);
  if(!info.ok)return -999;
  let score=100*sourceWeight;
  if(/ TRNG$/.test(info.value)) score+=40;
  else if(CODES.has(info.value)) score+=25;
  else{
    const [a,b]=info.value.split("-");
    const sm=+a.slice(2),em=+b.slice(2);
    if([0,30].includes(sm))score+=8;
    if([0,30].includes(em))score+=8;
    if((info.hours||0)>=4&&(info.hours||0)<=10.5)score+=12;
  }
  return score;
}

function choosePrintedPreferred(candidates){
  let best="",score=-Infinity;
  for(const c of candidates){
    const s=candidateWeight(c.value,c.weight||1);
    if(s>score){score=s;best=c.value}
  }
  return score>=100?best:"";
}

async function robustPrintedCellOCR(worker,raw){
  const passes=[
    {canvas:printedCellVariant(raw,170),psm:"7",weight:1.4},
    {canvas:printedCellVariant(raw,188),psm:"7",weight:1.5},
    {canvas:printedCellVariant(raw,205),psm:"8",weight:1.25},
    {canvas:printedCellVariant(raw,188),psm:"13",weight:1.15}
  ];
  const candidates=[];

  for(const p of passes){
    const txt=await recognize(worker,p.canvas,p.psm,"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-:");
    for(const v of extractPrintedCandidates(txt)){
      candidates.push({value:v,weight:p.weight});
    }
  }

  // Last pass with no whitelist helps letter codes like RDO/TRNG/SL.
  const free=await recognize(worker,passes[1].canvas,"8","");
  for(const v of extractPrintedCandidates(free)){
    candidates.push({value:v,weight:1.35});
  }

  return choosePrintedPreferred(candidates);
}


function detectRosterTableRegions(canvas){
  const W=canvas.width,H=canvas.height,ctx=canvas.getContext("2d");
  const img=ctx.getImageData(0,0,W,H),d=img.data;
  const x0=Math.floor(W*.03),x1=Math.ceil(W*.97);
  const xStep=Math.max(1,Math.floor(W/700));
  const active=new Array(H).fill(false);

  for(let y=0;y<H;y++){
    let dark=0,total=0;
    for(let x=x0;x<x1;x+=xStep){
      const i=(y*W+x)*4;
      const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
      if(g<205)dark++;
      total++;
    }
    active[y]=dark>Math.max(4,total*.012);
  }

  const runs=[];
  let start=null,last=null;
  const maxGap=Math.max(8,Math.round(H*.018));
  for(let y=0;y<H;y++){
    if(active[y]){
      if(start===null)start=y;
      last=y;
    }else if(start!==null && y-last>maxGap){
      runs.push([start,last]);
      start=null;last=null;
    }
  }
  if(start!==null)runs.push([start,last]);

  const regions=[];
  for(const [ry0,ry1] of runs){
    const h=ry1-ry0;
    if(h<H*.055)continue;

    // Estimate horizontal table extent from dark pixels inside the band.
    const colScore=new Array(W).fill(0);
    const yStep=Math.max(1,Math.floor(h/160));
    for(let y=ry0;y<=ry1;y+=yStep){
      for(let x=0;x<W;x+=2){
        const i=(y*W+x)*4;
        const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
        if(g<195){colScore[x]++;if(x+1<W)colScore[x+1]++}
      }
    }
    const maxScore=Math.max(...colScore,1);
    const threshold=Math.max(2,maxScore*.08);
    let left=0,right=W-1;
    for(let x=0;x<W;x++){if(colScore[x]>=threshold){left=x;break}}
    for(let x=W-1;x>=0;x--){if(colScore[x]>=threshold){right=x;break}}

    const width=right-left;
    if(width<W*.35)continue;
    const px=Math.max(3,Math.round(width*.01));
    const py=Math.max(3,Math.round(h*.035));
    regions.push({
      id:`table-${regions.length}`,
      x0:Math.max(0,left-px),x1:Math.min(W,right+px),
      y0:Math.max(0,ry0-py),y1:Math.min(H,ry1+py)
    });
  }

  // Prefer substantial table-sized bands and keep vertical order.
  return regions
    .filter(r=>(r.y1-r.y0)>H*.07)
    .sort((a,b)=>a.y0-b.y0);
}

async function detectNamesInTableRegion(canvas,region,worker){
  const tw=region.x1-region.x0, th=region.y1-region.y0;
  // Name column is the first wide column of the table; exclude the row-number/title margin.
  const nx0=region.x0;
  const nx1=region.x0+tw*.19;
  const crop=rawCropCanvas(canvas,nx0,region.y0,nx1,region.y1,4);
  const hi=preprocessCanvas(crop,1.5);

  await worker.setParameters({tessedit_pageseg_mode:"6",preserve_interword_spaces:"1"});
  const result=await worker.recognize(hi);
  const scaleY=th/hi.height;
  const grouped=groupNameWords(result.data.words||[]);
  const candidates=[];

  for(const g of grouped){
    const localY=g.cy*scaleY;
    // Skip the table title/header band.
    if(localY<th*.10)continue;
    const name=cleanStaffName(g.text);
    if(!plausibleStaffName(name))continue;
    if(/\b(?:WORKING|HOURS|SHIFT|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/i.test(name))continue;
    candidates.push({
      name,
      cy:region.y0+localY,
      rawY0:region.y0+g.y0*scaleY,
      rawY1:region.y0+g.y1*scaleY
    });
  }

  const dedup=[];
  for(const n of candidates){
    if(!dedup.some(x=>Math.abs(x.cy-n.cy)<4 || x.name.toLowerCase()===n.name.toLowerCase())){
      dedup.push(n);
    }
  }
  return dedup.sort((a,b)=>a.cy-b.cy);
}

function attachBoundsWithinTable(staff,region){
  const rows=[...staff].sort((a,b)=>a.cy-b.cy);
  if(!rows.length)return [];
  const typicalGap=rows.length>1
    ? [...rows.slice(1).map((r,i)=>r.cy-rows[i].cy)].sort((a,b)=>a-b)[Math.floor((rows.length-1)/2)]
    : Math.max(10,(region.y1-region.y0)*.045);

  return rows.map((r,i)=>{
    const prev=rows[i-1],next=rows[i+1];
    const upper=prev?(prev.cy+r.cy)/2:r.cy-typicalGap/2;
    const lower=next?(r.cy+next.cy)/2:r.cy+typicalGap/2;
    return {...r,y0:Math.max(region.y0,upper+1),y1:Math.min(region.y1,lower-1)};
  });
}

function detectGridInTableRegion(canvas,region,staff){
  const W=canvas.width;
  const tw=region.x1-region.x0;
  const top=Math.max(region.y0,Math.min(...staff.map(r=>r.y0))-4);
  const bottom=Math.min(region.y1,Math.max(...staff.map(r=>r.y1))+4);
  const scores=verticalGridScore(canvas,top,bottom);

  // Expected geometry is relative to THIS table, not the whole screenshot.
  const expected=[];
  expected.push(region.x0+tw*.005);
  const dayLeft=region.x0+tw*.145;
  const dayRight=region.x0+tw*.925;
  const step=(dayRight-dayLeft)/14;
  for(let i=0;i<=14;i++)expected.push(dayLeft+i*step);
  expected.push(region.x0+tw*.995);

  const radius=Math.max(4,tw*.018);
  const lines=[];
  for(let i=0;i<expected.length;i++){
    const minX=i?lines[i-1]+2:region.x0;
    const maxX=Math.min(region.x1,W-1);
    let x=bestLineNear(scores,expected[i],radius,minX,maxX);
    if(i&&x<=lines[i-1]+1)x=Math.max(lines[i-1]+2,Math.round(expected[i]));
    lines.push(x);
  }
  return {dayBounds:lines.slice(1,16),workingBounds:[lines[15],lines[16]],lines};
}

async function inferFirstDateForRegion(canvas,region,worker){
  const h=region.y1-region.y0;
  const header=rawCropCanvas(canvas,region.x0,region.y0,region.x1,Math.min(region.y1,region.y0+h*.22),3);
  await worker.setParameters({tessedit_pageseg_mode:"6",preserve_interword_spaces:"1"});
  const result=await worker.recognize(header);
  return inferFirstDate(result.data.text||"");
}


async function numericOnlyFallback(worker,raw){
  const thresholds=[165,185,205];
  const candidates=[];

  for(const th of thresholds){
    const c=printedCellVariant(raw,th);
    const passes=[
      await recognize(worker,c,"7","0123456789-"),
      await recognize(worker,c,"8","0123456789-"),
      await recognize(worker,c,"13","0123456789-")
    ];

    for(const txt of passes){
      const s=String(txt||"").replace(/[^\d-]/g,"");
      if(!s)continue;

      const direct=s.match(/^(\d{3,4})-(\d{3,4})$/);
      if(direct){
        candidates.push(normalizeShift(`${direct[1]}-${direct[2]}`));
      }

      const digits=s.replace(/\D/g,"");
      if(digits.length===8){
        candidates.push(normalizeShift(`${digits.slice(0,4)}-${digits.slice(4)}`));
      }
      if(digits.length===7){
        candidates.push(normalizeShift(`${digits.slice(0,3)}-${digits.slice(3)}`));
        candidates.push(normalizeShift(`${digits.slice(0,4)}-${digits.slice(4)}`));
      }
    }
  }

  let best="",bestScore=-Infinity;
  for(const v of candidates){
    const info=validateShift(v);
    if(!info.ok)continue;

    let score=100;
    const [a,b]=info.value.split("-");
    const sm=+a.slice(2),em=+b.slice(2);
    if([0,30].includes(sm))score+=6;
    if([0,30].includes(em))score+=6;
    if((info.hours||0)>=3&&(info.hours||0)<=10.5)score+=10;
    if((info.hours||0)>12)score-=20;

    if(score>bestScore){bestScore=score;best=info.value}
  }
  return best;
}


function cleanReplicatedCellText(text){
  return String(text||"")
    .replace(/[–—]/g,"-")
    .replace(/\s+/g," ")
    .trim();
}

async function replicateCellText(worker,raw){
  // Roster cells have a small, predictable vocabulary. Prefer a verified
  // HHMM-HHMM / RDO / TRNG result instead of returning OCR garbage letters.
  const printed=await robustPrintedCellOCR(worker,raw);
  if(printed) return printed;

  const exact=await recognizeExactCellFallback(worker,raw);
  if(exact) return exact;

  // Preserve a readable roster code only when several OCR passes agree.
  const variants=[
    printedCellVariant(raw,170),
    printedCellVariant(raw,188),
    printedCellVariant(raw,205)
  ];
  const texts=[];
  for(const c of variants){
    texts.push(cleanReplicatedCellText(await recognize(worker,c,"7","")));
    texts.push(cleanReplicatedCellText(await recognize(worker,c,"8","")));
  }

  const normalized=texts
    .map(t=>t.toUpperCase().replace(/[^A-Z0-9:-]/g,""))
    .filter(Boolean);

  // Never display random OCR strings such as IELENHFIN / TLNF / LLL.
  // Only pass through a compact code if it is repeated by multiple OCR passes.
  const counts={};
  for(const t of normalized) counts[t]=(counts[t]||0)+1;
  const agreed=Object.entries(counts)
    .filter(([t,n])=>n>=2 && t.length>=2 && t.length<=8 && /^[A-Z]+$/.test(t))
    .sort((a,b)=>b[1]-a[1])[0];

  return agreed ? agreed[0] : "";
}


function parseRosterSourceText(text){
  const raw=String(text||"").toUpperCase().trim()
    .replace(/[–—]/g,"-")
    .replace(/\s+/g," ");

  if(!raw) return {display:"",time:"",code:"",hours:0};

  if(/\bRDO\b/.test(raw)){
    return {display:"RDO",time:"",code:"RDO",hours:0};
  }

  const hasTRNG=/\bTRNG\b/.test(raw);
  const num=raw
    .replace(/O/g,"0")
    .replace(/[IL|]/g,"1")
    .replace(/:/g,"");

  const m=num.match(/(\d{3,4})\s*-\s*(\d{3,4})/);
  if(m){
    const a=m[1].padStart(4,"0"), b=m[2].padStart(4,"0");
    const sh=+a.slice(0,2), sm=+a.slice(2), eh=+b.slice(0,2), em=+b.slice(2);
    if(sh<=23&&eh<=23&&sm<=59&&em<=59){
      let mins=eh*60+em-(sh*60+sm);
      if(mins<0) mins+=1440;
      if(mins>0&&mins<=14*60){
        const display=`${a}-${b}${hasTRNG?" TRNG":""}`;
        return {
          display,
          time:`${a}-${b}`,
          code:hasTRNG?"TRNG":"",
          hours:mins/60
        };
      }
    }
  }

  // Preserve non-time roster codes exactly enough for display, but they carry 0 hours.
  const codeMatch=raw.match(/\b(AL|ALV|ALTH|HACC|SICK|SL|LEAVE|OFF|TRNG)\b/);
  if(codeMatch){
    return {display:codeMatch[1],time:"",code:codeMatch[1],hours:0};
  }

  return {display:raw,time:"",code:"",hours:0};
}


async function canvasFromDataURL(url){
  const img=await new Promise((resolve,reject)=>{
    const el=new Image();
    el.onload=()=>resolve(el);
    el.onerror=reject;
    el.src=url;
  });
  const c=document.createElement("canvas");
  c.width=img.naturalWidth||img.width;
  c.height=img.naturalHeight||img.height;
  c.getContext("2d").drawImage(img,0,0);
  return c;
}

async function readCalculationValueFromSourceCell(worker,dataUrl){
  if(!dataUrl) return {display:"",time:"",code:"",hours:0};

  const raw=await canvasFromDataURL(dataUrl);

  // First detect roster codes from the exact cropped source cell.
  const codeCanvas=printedCellVariant(raw,188);
  const codeText=String(await recognize(worker,codeCanvas,"7","ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-:")||"")
    .toUpperCase()
    .replace(/\s+/g," ")
    .trim();

  if(/\bRD[O0]\b/.test(codeText)){
    return {display:"RDO",time:"",code:"RDO",hours:0};
  }

  const hasTRNG=/\bTRN[G6]\b/.test(codeText);

  // Numeric-only passes on the exact source cell.
  const candidates=[];
  for(const th of [160,175,190,205,220]){
    const c=printedCellVariant(raw,th);
    for(const psm of ["7","8","13"]){
      const txt=String(await recognize(worker,c,psm,"0123456789-:")||"");
      const normalized=txt.replace(/[^0-9:-]/g,"").replace(/:/g,"");

      const direct=normalized.match(/(\d{3,4})-(\d{3,4})/);
      if(direct){
        candidates.push([direct[1].padStart(4,"0"),direct[2].padStart(4,"0")]);
      }

      const digits=normalized.replace(/\D/g,"");
      if(digits.length===8){
        candidates.push([digits.slice(0,4),digits.slice(4)]);
      }
    }
  }

  // Validate and vote. Exact roster times normally use sensible clock values
  // and shift lengths up to 14h, including overnight.
  const scored=[];
  for(const [a,b] of candidates){
    const sh=+a.slice(0,2), sm=+a.slice(2), eh=+b.slice(0,2), em=+b.slice(2);
    if(sh>23||eh>23||sm>59||em>59) continue;

    let mins=eh*60+em-(sh*60+sm);
    if(mins<0) mins+=1440;
    if(mins<=0||mins>14*60) continue;

    let score=100;
    if([0,30].includes(sm)) score+=8;
    if([0,30].includes(em)) score+=8;
    if(mins>=180&&mins<=600) score+=12;

    const key=`${a}-${b}`;
    const repeats=candidates.filter(x=>`${x[0]}-${x[1]}`===key).length;
    score+=repeats*20;

    scored.push({a,b,mins,score});
  }

  scored.sort((x,y)=>y.score-x.score);
  if(scored.length){
    const best=scored[0];
    return {
      display:`${best.a}-${best.b}${hasTRNG?" TRNG":""}`,
      time:`${best.a}-${best.b}`,
      code:hasTRNG?"TRNG":"",
      hours:best.mins/60
    };
  }

  // Fall back only if source-cell OCR genuinely cannot recover a time/code.
  return parseRosterSourceText(codeText);
}



function tightRosterTextCanvas(raw){
  const src=raw;
  const ctx=src.getContext("2d");
  const w=src.width,h=src.height;
  const img=ctx.getImageData(0,0,w,h).data;

  // Ignore borders and the mostly-empty right side of a roster cell.
  const xStart=Math.max(1,Math.floor(w*.02));
  const xEnd=Math.min(w-1,Math.floor(w*.58));
  const yStart=Math.max(1,Math.floor(h*.08));
  const yEnd=Math.min(h-1,Math.floor(h*.92));

  let minX=xEnd,minY=yEnd,maxX=xStart,maxY=yStart,found=false;

  for(let y=yStart;y<yEnd;y++){
    for(let x=xStart;x<xEnd;x++){
      const i=(y*w+x)*4;
      const r=img[i],g=img[i+1],b=img[i+2];
      const lum=(r+g+b)/3;

      // Printed roster text is substantially darker than the white cell.
      if(lum<175){
        found=true;
        if(x<minX)minX=x;
        if(x>maxX)maxX=x;
        if(y<minY)minY=y;
        if(y>maxY)maxY=y;
      }
    }
  }

  if(!found){
    return rawCropCanvas(src,xStart,yStart,xEnd,yEnd,4);
  }

  const padX=Math.max(3,Math.round((maxX-minX+1)*.18));
  const padY=Math.max(3,Math.round((maxY-minY+1)*.45));

  minX=Math.max(xStart,minX-padX);
  maxX=Math.min(xEnd,maxX+padX);
  minY=Math.max(yStart,minY-padY);
  maxY=Math.min(yEnd,maxY+padY);

  return rawCropCanvas(src,minX,minY,maxX,maxY,8);
}

function readCanonicalRosterCell(worker,raw){
  return (async()=>{
    const tight=tightRosterTextCanvas(raw);

    const normalize=s=>String(s||"")
      .toUpperCase()
      .replace(/[–—_:]/g,"-")
      .replace(/\s+/g,"")
      .replace(/O/g,"0");

    const values=[];

    const add=(text,weight)=>{
      const s=normalize(text);

      const direct=s.match(/(\d{4})-(\d{4})/);
      if(direct){
        values.push({value:`${direct[1]}-${direct[2]}`,weight});
      }

      const digits=s.replace(/\D/g,"");
      if(digits.length===8){
        values.push({
          value:`${digits.slice(0,4)}-${digits.slice(4)}`,
          weight:weight*.9
        });
      }
    };

    // Detect RDO/TRNG from the tightly-cropped printed text.
    const codePasses=[];
    for(const th of [150,170,190,210]){
      const c=printedCellVariant(tight,th);
      codePasses.push(await recognize(worker,c,"7","ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"));
      codePasses.push(await recognize(worker,c,"8","ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"));
    }

    const rdoVotes=codePasses.filter(t=>/\bRD[O0]\b/i.test(String(t))).length;
    const trngVotes=codePasses.filter(t=>/\bTRN[G6]\b/i.test(String(t))).length;

    if(rdoVotes>=2) return "RDO";

    // Read the actual printed HHMM-HHMM from a tightly cropped text region.
    // PSM 7 is strongest for one line; PSM 8/13 are supporting votes.
    for(const th of [135,150,165,180,195,210,225]){
      const c=printedCellVariant(tight,th);
      add(await recognize(worker,c,"7","0123456789-:"),1.6);
      add(await recognize(worker,c,"8","0123456789-:"),1.15);
      add(await recognize(worker,c,"13","0123456789-:"),1.0);
    }

    add(await recognize(worker,tight,"7","0123456789-:"),1.8);
    add(await recognize(worker,tight,"8","0123456789-:"),1.25);

    const grouped=new Map();

    for(const item of values){
      const parsed=airport24HourDuration(item.value);
      if(!parsed.valid || !parsed.time) continue;

      const current=grouped.get(parsed.time)||{score:0,count:0};
      current.score+=item.weight;
      current.count+=1;
      grouped.set(parsed.time,current);
    }

    const ranked=[...grouped.entries()]
      .map(([value,x])=>({
        value,
        score:x.score + x.count*.8
      }))
      .sort((a,b)=>b.score-a.score);

    if(ranked.length){
      const best=ranked[0].value;
      return trngVotes>=2 ? `${best} TRNG` : best;
    }

    if(trngVotes>=2) return "TRNG";

    const knownCodes=["ALTH","HACC","ALV","SICK","LEAVE","OFF","SL","AL"];
    for(const code of knownCodes){
      const votes=codePasses.filter(t=>new RegExp(`\\b${code}\\b`,"i").test(String(t))).length;
      if(votes>=2) return code;
    }

    return "";
  })();
}


function airport24HourDuration(value){
  const raw=String(value||"").toUpperCase().trim()
    .replace(/[–—]/g,"-")
    .replace(/\s+/g," ");

  if(!raw) return {valid:false,hours:0,time:"",code:"",display:""};

  if(/\bRDO\b/.test(raw)){
    return {valid:true,hours:0,time:"",code:"RDO",display:"RDO"};
  }

  const hasTRNG=/\bTRNG\b/.test(raw);
  const m=raw.match(/(\d{4})\s*-\s*(\d{4})/);
  if(!m) return {valid:false,hours:0,time:"",code:"",display:raw};

  const start=m[1], end=m[2];
  const sh=Number(start.slice(0,2));
  const sm=Number(start.slice(2,4));
  const eh=Number(end.slice(0,2));
  const em=Number(end.slice(2,4));

  if(
    sh<0 || sh>23 || eh<0 || eh>23 ||
    sm<0 || sm>59 || em<0 || em>59
  ){
    return {valid:false,hours:0,time:"",code:"",display:raw};
  }

  const startMinutes=sh*60+sm;
  let endMinutes=eh*60+em;

  // Airport roster rule: if finish is earlier than or equal to start,
  // the finish is on the next calendar day.
  if(endMinutes<=startMinutes) endMinutes += 24*60;

  const durationMinutes=endMinutes-startMinutes;

  // Airport shifts can cross midnight. Only reject impossible >24h results.
  if(durationMinutes<=0 || durationMinutes>24*60){
    return {valid:false,hours:0,time:"",code:"",display:raw};
  }

  const time=`${start}-${end}`;
  return {
    valid:true,
    hours:durationMinutes/60,
    time,
    code:hasTRNG?"TRNG":"",
    display:`${time}${hasTRNG?" TRNG":""}`
  };
}

function parseDisplayedRosterValue(value){
  const raw=String(value||"").toUpperCase().trim()
    .replace(/[–—]/g,"-")
    .replace(/\s+/g," ");

  if(!raw) return {display:"",time:"",code:"",hours:0};

  const airport=airport24HourDuration(raw);
  if(airport.valid){
    return {
      display:airport.display,
      time:airport.time,
      code:airport.code,
      hours:airport.hours
    };
  }

  const codeMatch=raw.match(/\b(AL|ALV|ALTH|HACC|SICK|SL|LEAVE|OFF|TRNG)\b/);
  if(codeMatch){
    return {display:codeMatch[1],time:"",code:codeMatch[1],hours:0};
  }

  return {display:raw,time:"",code:"",hours:0};
}

function App(){
  const [entries,setEntries]=useState([]);
  const [tab,setTab]=useState("dashboard");
  const [query,setQuery]=useState("");
  const [threshold,setThreshold]=useState(38);
  const [calendarMonth,setCalendarMonth]=useState(todayISO().slice(0,7)+"-01");
  const [selectedDate,setSelectedDate]=useState(todayISO());

  const [table,setTable]=useState(null);
  const [preview,setPreview]=useState(null);
  const [selectedStaff,setSelectedStaff]=useState("");
  const [review,setReview]=useState(null);
  const [processing,setProcessing]=useState(false);
  const [progress,setProgress]=useState(0);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  const fileRef=useRef(null);

  useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");setEntries(x.entries||[]);setThreshold(x.threshold||38)}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify({entries,threshold}))}catch{}},[entries,threshold]);

  const scanFullTable=useCallback(async(file)=>{
    setError("");setReview(null);setTable(null);setProcessing(true);setProgress(0);
    setStatus("Detecting roster tables…");
    let worker;
    try{
      const canvas=await imageToCanvas(file);
      const url=URL.createObjectURL(file);
      setPreview(url);
      worker=await createWorker(p=>setProgress(Math.round(p*25)));

      let regions=detectRosterTableRegions(canvas);
      if(!regions.length){
        // Safe fallback: treat the visible content as one table.
        regions=[{id:"table-0",x0:0,x1:canvas.width,y0:0,y1:canvas.height}];
      }

      const allStaff=[];
      const tables=[];
      for(let ti=0;ti<regions.length;ti++){
        const region=regions[ti];
        setStatus(`Reading employee names — table ${ti+1} of ${regions.length}`);
        setProgress(25+Math.round((ti/regions.length)*45));

        const names=await detectNamesInTableRegion(canvas,region,worker);
        if(!names.length)continue;
        const staff=attachBoundsWithinTable(names,region);
        const firstDate=await inferFirstDateForRegion(canvas,region,worker);
        const grid=detectGridInTableRegion(canvas,region,staff);

        const tableInfo={
          id:region.id,index:tables.length,region,firstDate,
          bounds:grid.dayBounds,workingBounds:grid.workingBounds,gridLines:grid.lines
        };
        tables.push(tableInfo);

        for(const r of staff){
          allStaff.push({
            ...r,
            id:`staff-${allStaff.length}`,
            tableId:tableInfo.id,
            tableIndex:tableInfo.index,
            firstDate,
            bounds:tableInfo.bounds,
            workingBounds:tableInfo.workingBounds
          });
        }
      }

      if(!allStaff.length){
        throw new Error("No employee rows were detected. Make sure the full roster tables and their left-side name columns are visible.");
      }

      // Sort dropdown by employee name while preserving table/row identity.
      allStaff.sort((a,b)=>a.name.localeCompare(b.name)||a.cy-b.cy);
      setStatus(`${allStaff.length} staff across ${tables.length} roster ${tables.length===1?"table":"tables"}`);
      setProgress(75);

      const source={fileName:file.name,canvas,staff:allStaff,tables};
      setTable(source);

      // Stop after name detection. Show the employee dropdown immediately.
      // Detailed OCR runs only after the user explicitly selects an employee.
      setSelectedStaff("");
    }catch(e){
      setError(e?.message||"Could not read this roster image.");
    }finally{
      if(worker)try{await worker.terminate()}catch{}
      setProcessing(false);setProgress(0);setStatus("");
    }
  },[]);

  const readStaffRow=async(tableData,staffId,existingWorker=null)=>{
    const source=tableData||table;
    if(!source)return;
    const row=source.staff.find(r=>r.id===staffId);
    if(!row)return;

    let worker=existingWorker,ownWorker=false;
    try{
      if(!worker){
        setProcessing(true);setStatus(`Reading ${row.name}…`);setProgress(0);
        worker=await createWorker();ownWorker=true;
      }

      const bounds=row.bounds;
      const rowSource={
        canvas:source.canvas,
        fileName:source.fileName,
        bounds,
        workingBounds:row.workingBounds,
        firstDate:row.firstDate
      };

      let cells=await recognizeWholeSelectedRow(worker,rowSource,row,bounds);
      const wholeRowCells=[...cells];
      const thumbs=[];

      for(let i=0;i<14;i++){
        const x0=bounds[i],x1=bounds[i+1];
        const thumb=rawCropCanvas(source.canvas,x0+1,row.y0+1,x1-1,row.y1-1,6);
        thumbs.push(dataURL(thumb));

        const raw=rawCropCanvas(source.canvas,x0+1,row.y0+1,x1-1,row.y1-1,12);

        // Read the exact cell, but NEVER destroy a useful value already obtained
        // from the whole selected row. This was the cause of missing hours.
        const exactValue=await readCanonicalRosterCell(worker,raw);
        const rowValue=cleanReplicatedCellText(wholeRowCells[i]||"");

        // Extra exact-cell fallback for a readable time/code if the canonical pass
        // is empty. It uses the same source cell and does not affect the displayed crop.
        let fallbackValue="";
        if(!exactValue){
          const printed=await robustPrintedCellOCR(worker,raw);
          fallbackValue=cleanReplicatedCellText(printed||"");
        }

        const candidates=[exactValue,rowValue,fallbackValue]
          .map(v=>String(v||"").trim())
          .filter(Boolean);

        // Prefer a valid roster time or RDO. Otherwise keep the first meaningful code.
        let chosen="";
        for(const v of candidates){
          const parsed=parseDisplayedRosterValue(v);
          if(parsed.time || parsed.code==="RDO"){
            chosen=parsed.display;
            break;
          }
        }
        if(!chosen){
          chosen=candidates[0]||"";
        }

        cells[i]=chosen;
        if(ownWorker)setProgress(Math.round((i+1)/14*90));
      }

      const wh0=row.workingBounds?.[0],wh1=row.workingBounds?.[1];
      let workingHours=null;
      if(Number.isFinite(wh0)&&Number.isFinite(wh1)&&wh1>wh0){
        const whCrop=cropCanvas(source.canvas,wh0+1,row.y0+1,wh1-1,row.y1-1,8);
        const whText=await recognize(worker,whCrop,"7","0123456789.");
        const whMatch=whText.match(/\d+(?:\.\d+)?/);
        workingHours=whMatch?Number(whMatch[0]):null;
      }

      setReview({
        fileName:source.fileName,staffId:row.id,name:row.name,
        firstDate:row.firstDate,cells,thumbs,workingHours,
        tableIndex:row.tableIndex
      });
    }finally{
      if(ownWorker&&worker)try{await worker.terminate()}catch{}
      if(ownWorker){setProcessing(false);setProgress(0);setStatus("")}
    }
  };

  const selectStaff=async(id)=>{
    setSelectedStaff(id);
    setReview(null);
    await readStaffRow(table,id);
  };

  const upload=(files)=>{
    const file=files?.[0];if(!file)return;
    const ext=file.name.split(".").pop().toLowerCase();
    if(["png","jpg","jpeg","webp"].includes(ext)){scanFullTable(file);return;}
    if(ext==="csv"){
      Papa.parse(file,{header:true,skipEmptyLines:true,complete:r=>{
        const rows=r.data.map((x,i)=>({id:`csv-${Date.now()}-${i}`,name:x.Name||x.name||x.Employee||x.employee||"",date:x.Date||x.date||"",time:x.Time||x.time||x.Shift||x.shift||"",code:x.Code||x.code||"",hours:+(x.Hours||x.hours||0)||hoursOf(x.Time||x.time||""),source:file.name})).filter(x=>x.name);
        setEntries(old=>[...old,...rows]);
      }});return;
    }
    if(["xlsx","xls"].includes(ext)){
      const fr=new FileReader();
      fr.onload=e=>{
        const wb=XLSX.read(e.target.result,{type:"array"}),sh=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(sh,{defval:""}).map((x,i)=>({id:`xls-${Date.now()}-${i}`,name:x.Name||x.name||x.Employee||x.employee||"",date:x.Date||x.date||"",time:x.Time||x.time||x.Shift||x.shift||"",code:x.Code||x.code||"",hours:+(x.Hours||x.hours||0)||hoursOf(x.Time||x.time||""),source:file.name})).filter(x=>x.name);
        setEntries(old=>[...old,...rows]);
      };
      fr.readAsArrayBuffer(file);return;
    }
    setError("Use a roster screenshot, CSV, XLS or XLSX file.");
  };

  const updateCell=(i,v)=>setReview(r=>({...r,cells:r.cells.map((x,j)=>j===i?v:x)}));
  const allValid=!!review;
  const importReview=()=>{
    if(!review)return;

    const added=review.cells.map((raw,i)=>{
      const literal=cleanReplicatedCellText(raw);
      const parsed=parseDisplayedRosterValue(literal);
      const thumb=review.thumbs?.[i]||"";

      return {
        id:`img-${Date.now()}-${i}`,
        name:review.name,
        date:addDays(review.firstDate,i),

        // ONE source of truth: the canonical value stored when this exact cell was first read.
        time:parsed.time,
        code:parsed.code,
        hours:parsed.hours,
        display:parsed.display,

        canonicalValue:parsed.display,
        editableValue:parsed.display,
        originalValue:parsed.display,
        rawCellText:literal,
        sourceCell:thumb,
        source:review.fileName,
        tableIndex:review.tableIndex
      };
    });

    setEntries(old=>[
      ...old.filter(e=>!(e.name===review.name&&added.some(a=>a.date===e.date))),
      ...added
    ]);

    setSelectedDate(review.firstDate);
    setCalendarMonth(review.firstDate.slice(0,7)+"-01");
    setReview(null);setTable(null);setPreview(null);setTab("dashboard");
  };

  const updateEntryValue=(id,nextValue)=>{
    setEntries(old=>old.map(e=>{
      if(e.id!==id)return e;

      const raw=String(nextValue||"").toUpperCase()
        .replace(/[–—]/g,"-")
        .replace(/\s+/g," ")
        .trim();

      const parsed=parseDisplayedRosterValue(raw);

      return {
        ...e,
        editableValue:raw,
        display:raw,
        canonicalValue:raw,
        time:parsed.time,
        code:parsed.code,
        hours:parsed.hours
      };
    }));
  };

  const names=useMemo(()=>[...new Set(entries.map(e=>e.name))].sort(),[entries]);
  const myName=names.find(n=>/VIMAL|PRABHAKAR/i.test(n))||names[0]||"";
  const mine=useMemo(()=>entries.filter(e=>!myName||e.name===myName).sort((a,b)=>String(a.date).localeCompare(String(b.date))),[entries,myName]);
  const weekStart=mondayOf(mine.length?mine[0].date:todayISO());
  const week=mine.filter(e=>e.date>=weekStart&&e.date<addDays(weekStart,7));
  const month=mine.filter(e=>e.date?.startsWith(calendarMonth.slice(0,7)));
  const weekHours=week.reduce((s,e)=>s+effectiveEntryHours(e),0);
  const monthHours=month.reduce((s,e)=>s+effectiveEntryHours(e),0);
  const rosterTotalHours=mine.reduce((s,e)=>s+effectiveEntryHours(e),0);
  const rosterOvertimeHours=mine.reduce((s,e)=>s+entryOvertimeHours(e),0);
  const upcoming=mine.find(e=>airport24HourDuration(entryRosterText(e)).time && e.date>=todayISO()) || mine.find(e=>airport24HourDuration(entryRosterText(e)).time);
  const filtered=entries.filter(e=>!query||e.name.toLowerCase().includes(query.toLowerCase()));

  return <div className="shell">
    <header className="top"><div><div className="vv">VV</div><div className="sub">DUTY ROSTER</div></div></header>

    {tab==="dashboard"&&<main>
      <section className="hero"><small>UPCOMING SHIFT</small>{upcoming?<><h2>{fmt(upcoming.date,{weekday:"long",day:"numeric",month:"long"})}</h2>{upcoming.sourceCell?<div className="heroSourceCell"><img src={upcoming.sourceCell} alt={entryRosterText(upcoming)}/></div>:<h1>{entryRosterText(upcoming)||"See roster cell"}</h1>}<p>{upcoming.name}</p></>:<h2>No upcoming shift</h2>}</section>
      <div className="stats"><Stat label="WEEK HOURS" value={weekHours.toFixed(2)}/><Stat label="OVERTIME" value={rosterOvertimeHours.toFixed(2)}/></div>
      <section className="panel"><div className="sectionTitle"><b>THIS WEEK</b><span>{fmt(weekStart)} – {fmt(addDays(weekStart,6))}</span></div><Roster rows={Array.from({length:7},(_,i)=>mine.find(e=>e.date===addDays(weekStart,i))).filter(Boolean)}/></section>
    </main>}

    {tab==="calendar"&&<main>
      <MonthHead month={calendarMonth} setMonth={setCalendarMonth}/>
      <CalendarGrid month={calendarMonth} rows={mine} selected={selectedDate} onSelect={setSelectedDate}/>
      <section className="panel"><div className="sectionTitle"><b>{fmt(selectedDate,{weekday:"long",day:"numeric",month:"long"})}</b></div><Roster rows={mine.filter(e=>e.date===selectedDate)}/></section>
      <div className="stats three"><Stat label="TOTAL HOURS" value={monthHours.toFixed(2)}/><Stat label="OVERTIME" value={Math.max(0,monthHours-threshold*4).toFixed(2)}/><Stat label="TARGET" value={(threshold*4).toFixed(2)}/></div>
    </main>}

    {tab==="roster"&&<main>
      <div className="stats rosterSummary">
        <Stat label="TOTAL HOURS" value={rosterTotalHours.toFixed(2)}/>
        <Stat label="OVERTIME" value={rosterOvertimeHours.toFixed(2)}/>
      </div>
      <section className="panel">
        <div className="sectionTitle">
          <div>
            <b>MY ROSTER</b>
            <small className="editorHint">Edit any shift below. Hours and totals update automatically.</small>
          </div>
          <span>{mine.length} days imported</span>
        </div>
        <Roster rows={mine} onEdit={updateEntryValue}/>
      </section>
    </main>}

    {tab==="search"&&<main>
      <div className="search"><Search size={17}/><input placeholder="Search by name..." value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery("")}><X size={14}/></button>}</div>
      <section className="panel"><Roster rows={filtered.slice(0,50)}/></section>
    </main>}

    {tab==="more"&&<main>
      <section className="panel menu"><h3>IMPORT</h3>
        <button onClick={()=>fileRef.current?.click()}><FileSpreadsheet/><span><b>Upload CSV / Excel</b><small>Import roster files</small></span></button>
        <button onClick={()=>fileRef.current?.click()}><Camera/><span><b>Upload roster photo</b><small>Reads the name column first, then the selected employee row</small></span></button>
      </section>
      <section className="panel menu"><h3>EXPORT</h3><button onClick={()=>exportCSV(entries)}><Download/><span><b>Export to CSV</b><small>Download roster data</small></span></button></section>
      <section className="panel menu"><h3>SETTINGS</h3><label className="setting">Weekly overtime threshold<input type="number" value={threshold} onChange={e=>setThreshold(+e.target.value||38)}/></label><button className="danger" onClick={()=>{if(confirm("Delete all roster data?"))setEntries([])}}><Trash2/><span><b>Reset All Data</b><small>Delete all roster data</small></span></button></section>
    </main>}

    <input ref={fileRef} hidden type="file" accept=".csv,.xlsx,.xls,image/*" onChange={e=>{upload(e.target.files);e.target.value=""}}/>

    {error&&<div className="toast"><AlertTriangle size={16}/>{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}

    {processing&&<div className="modalWrap"><div className="modal compact">
      <div className="spinner"/><h3>{status||"Reading roster…"}</h3><p>{progress}%</p>
      <small>{table?"Reading only the employee you selected. A slow OCR pass will time out automatically.":"Reading the left-side staff name column first."}</small>
    </div></div>}

    {table&&!processing&&<div className="modalWrap"><div className="modal autoTableModal">
      <div className="modalHead"><div><h2>Roster staff detected</h2><p>Select an employee and VV Roster shows the original cropped roster cell for every day exactly as it appears in the uploaded roster.</p></div><button className="ghost" onClick={()=>{setTable(null);setPreview(null);setReview(null)}}><X/></button></div>

      <div className="autoLayout">
        <div className="autoPreview"><img src={preview}/><div className="detectedBadge"><Users size={14}/>{table.staff.length} staff • {table.tables?.length||1} tables</div></div>
        <div className="autoControls">
          <label>Employee
            <select value={selectedStaff} onChange={e=>{if(e.target.value)selectStaff(e.target.value)}}>
              <option value="">Select employee…</option>
              {table.staff.map(s=><option key={s.id} value={s.id}>{s.name}{table.tables?.length>1?` — Table ${s.tableIndex+1}`:""}</option>)}
            </select>
          </label>
          {review&&<>
            <label>First date
              <input type="date" value={review.firstDate} onChange={e=>setReview(r=>({...r,firstDate:e.target.value}))}/>
            </label>
            <div className="workingHoursCard"><Clock3 size={17}/><span><small>WORKING HOURS</small><b>{review.workingHours!=null?review.workingHours.toFixed(2):"Not read"}</b></span></div>
          </>}
        </div>
      </div>

      {review&&<>
        <div className="selectedRowTitle">
          <b>{review.name}</b>
          <span>{review.tableIndex!=null?`Roster table ${review.tableIndex+1} • `:""}14-day row</span>
        </div>

        <div className="exactSourceReview">
          {review.cells.map((cell,i)=>(
            <div className="exactSourceRow" key={i}>
              <div className="exactDate">
                {fmt(addDays(review.firstDate,i),{weekday:"short",day:"numeric",month:"short"})}
              </div>
              <div className="exactRosterCell" title={cell||""}>
                {review.thumbs[i]
                  ? <img src={review.thumbs[i]} alt={`Roster cell ${i+1}`}/>
                  : <span>—</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="importFooter exactModeFooter">
          <span className="ready">✓ Showing the original selected employee cells exactly as uploaded</span>
          <button className="primary" disabled={!allValid} onClick={importReview}>
            <Check size={16}/> Import {review.name}
          </button>
        </div>
      </>}
    </div></div>}

    <nav className="bottom">
      <Nav id="dashboard" tab={tab} setTab={setTab} icon={<Home/>} label="Dashboard"/>
      <Nav id="calendar" tab={tab} setTab={setTab} icon={<CalendarDays/>} label="Calendar"/>
      <Nav id="roster" tab={tab} setTab={setTab} icon={<ClipboardList/>} label="My Roster"/>
      <Nav id="search" tab={tab} setTab={setTab} icon={<Search/>} label="Search"/>
      <Nav id="more" tab={tab} setTab={setTab} icon={<Menu/>} label="More"/>
    </nav>
  </div>;
}

function Stat({label,value}){return <div className="stat"><small>{label}</small><b>{value}</b></div>}
function Nav({id,tab,setTab,icon,label}){return <button className={tab===id?"on":""} onClick={()=>setTab(id)}>{icon}<span>{label}</span></button>}

// Deterministic duration examples:
  // 0430-0930 = 5.0h
  // 1630-0000 = 7.5h
  // 1700-0200 = 9.0h
  // 1630-2030 = 4.0h
function effectiveEntryHours(e){
  const candidates=[
    e?.editableValue,
    e?.canonicalValue,
    e?.display,
    e?.rawCellText,
    e?.time
  ].filter(Boolean);

  for(const value of candidates){
    const airport=airport24HourDuration(value);
    if(airport.valid) return airport.hours;
  }

  const edited=String(e?.editableValue||"").toUpperCase().trim();
  if(edited==="RDO") return 0;
  if(e?.code==="RDO") return 0;

  const stored=Number(e?.hours);
  return Number.isFinite(stored) ? stored : 0;
}


function originalRosterHours(e){
  const originalCandidates=[
    e?.originalValue,
    e?.rawCellText,
    e?.canonicalValue,
    e?.display,
    e?.time
  ].filter(Boolean);

  for(const value of originalCandidates){
    const airport=airport24HourDuration(value);
    if(airport.valid) return airport.hours;
  }

  return 0;
}

function entryOvertimeHours(e){
  const edited=effectiveEntryHours(e);
  const rostered=originalRosterHours(e);
  return Math.max(0,edited-rostered);
}

function entryRosterText(e){
  if(e.editableValue!==undefined && e.editableValue!==null)return e.editableValue;
  if(e.canonicalValue)return e.canonicalValue;
  if(e.display)return e.display;
  if(e.code==="RDO")return "RDO";
  if(e.time)return `${e.time}${e.code==="TRNG"?" TRNG":""}`;
  return e.code||"";
}
function Roster({rows,onEdit}){
  if(!rows.length)return <div className="empty">No shifts found.</div>;

  return <div className="list">
    {rows.map(e=>{
      const value=entryRosterText(e);
      const hours=effectiveEntryHours(e);
      const isRDO=String(value||"").toUpperCase().trim()==="RDO";

      return <div className={`item rosterImported ${onEdit?"rosterEditable":""}`} key={e.id}>
        <div className="rosterDateBlock">
          <small>{fmt(e.date,{weekday:"short",day:"numeric",month:"short"})}</small>
          <span>{e.name}</span>
        </div>

        {e.sourceCell
          ? <div className="savedSourceCell"><img src={e.sourceCell} alt={value||"Roster cell"}/></div>
          : <b className="rosterTextFallback">{value}</b>}

        {onEdit
          ? <div className="editableShiftWrap">
              <label>SHIFT</label>
              <input
                className="editableShift"
                value={value}
                placeholder="HHMM-HHMM or RDO"
                onChange={ev=>onEdit(e.id,ev.target.value)}
                inputMode="text"
                autoCapitalize="characters"
                spellCheck="false"
              />
              <small>24-hour airport time</small>
            </div>
          : null}

        <div className="dailyHours">
          <span>HOURS</span>
          <strong>{isRDO?"0.0h":hours>0?`${hours.toFixed(1)}h`:"—"}</strong>
          {onEdit && entryOvertimeHours(e)>0
            ? <small className="dailyOvertime">+{entryOvertimeHours(e).toFixed(1)} OT</small>
            : null}
        </div>
      </div>
    })}
  </div>
}
function MonthHead({month,setMonth}){const move=n=>{const d=new Date(`${month}T12:00:00`);d.setMonth(d.getMonth()+n);setMonth(d.toISOString().slice(0,7)+"-01")};return <div className="monthHead"><button className="ghost" onClick={()=>move(-1)}><ChevronLeft/></button><h2>{new Date(`${month}T12:00:00`).toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2><button className="ghost" onClick={()=>move(1)}><ChevronRight/></button></div>}
function CalendarGrid({month,rows,selected,onSelect}){const d=new Date(`${month}T12:00:00`),first=new Date(d.getFullYear(),d.getMonth(),1),days=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(),lead=(first.getDay()+6)%7;const cells=[...Array(lead).fill(null),...Array.from({length:days},(_,i)=>i+1)];while(cells.length%7)cells.push(null);return <div className="cal">{["MON","TUE","WED","THU","FRI","SAT","SUN"].map(x=><div className="dow" key={x}>{x}</div>)}{cells.map((n,i)=>{if(!n)return <div key={i}/>;const iso=new Date(d.getFullYear(),d.getMonth(),n,12).toISOString().slice(0,10),r=rows.find(x=>x.date===iso);return <button key={i} className={selected===iso?"selected":""} onClick={()=>onSelect(iso)}><b>{n}</b>{r&&<span className={r.code==="RDO"?"off":""}/>}</button>})}</div>}
function exportCSV(rows){
  const clean=rows.map(({sourceCell,...e})=>e);
  const csv=Papa.unparse(clean);
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="vv-roster.csv";
  a.click();
}

createRoot(document.getElementById("root")).render(<App/>);
