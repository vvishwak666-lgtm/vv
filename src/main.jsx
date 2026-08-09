
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
  let t=String(value||"").toUpperCase().trim().replace(/[–—]/g,"-").replace(/\s+/g,"");
  const aliases={RD0:"RDO",TRN6:"TRNG",ALLV:"ALV",ALIV:"ALV"};
  if(aliases[t]) t=aliases[t];
  if(CODES.has(t)) return t;
  if(/[0-9]/.test(t)) t=t.replace(/O/g,"0").replace(/[IL]/g,"1");
  if(/^\d{8}$/.test(t)) t=`${t.slice(0,4)}-${t.slice(4)}`;
  const m=t.match(/^(\d{3,4})-(\d{3,4})$/);
  if(m) t=`${m[1].padStart(4,"0")}-${m[2].padStart(4,"0")}`;
  return t;
}
function validateShift(value){
  const v=normalizeShift(value);
  if(!v) return {ok:false,value:v,reason:"Missing"};
  if(CODES.has(v)) return {ok:true,value:v,hours:0};
  const m=v.match(/^(\d{4})-(\d{4})$/);
  if(!m) return {ok:false,value:v,reason:"Use HHMM-HHMM"};
  const sh=+m[1].slice(0,2), sm=+m[1].slice(2), eh=+m[2].slice(0,2), em=+m[2].slice(2);
  if(sh>23||eh>23) return {ok:false,value:v,reason:"Hour must be 00–23"};
  if(sm>59||em>59) return {ok:false,value:v,reason:"Minutes must be 00–59"};
  let mins=eh*60+em-(sh*60+sm); if(mins<0) mins+=1440;
  if(mins===0) return {ok:false,value:v,reason:"Same start/end"};
  const hours=mins/60;
  if(hours>14) return {ok:false,value:v,reason:"Suspiciously long"};
  return {ok:true,value:v,hours};
}
function hoursOf(v){ const x=validateShift(v); return x.ok?(x.hours||0):0; }

async function imageToCanvas(file){
  const bmp=await createImageBitmap(file);
  const c=document.createElement("canvas");
  c.width=bmp.width; c.height=bmp.height;
  c.getContext("2d").drawImage(bmp,0,0);
  return c;
}
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
async function recognize(worker,canvas,psm="7",whitelist=""){
  await worker.setParameters({
    tessedit_pageseg_mode:psm,
    preserve_interword_spaces:"1",
    ...(whitelist?{tessedit_char_whitelist:whitelist}:{})
  });
  const r=await worker.recognize(canvas);
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
    setError("");setReview(null);setTable(null);setProcessing(true);setProgress(0);setStatus("Reading staff name column…");
    let worker;
    try{
      const canvas=await imageToCanvas(file);
      const url=URL.createObjectURL(file);
      setPreview(url);

      worker=await createWorker(p=>setProgress(Math.round(p*40)));
      const staffRaw=await detectNamesFromLeftColumn(canvas,worker,p=>setProgress(p));
      const staff=attachRowBounds(staffRaw,canvas.height);

      if(!staff.length){
        throw new Error("No staff names were detected in the name column. Use a screenshot with the full left-side name column visible.");
      }

      setStatus(`${staff.length} staff names detected`);
      setProgress(55);

      const header=cropCanvas(canvas,0,0,canvas.width,canvas.height*.25,2);
      await worker.setParameters({tessedit_pageseg_mode:"6",preserve_interword_spaces:"1"});
      const headerOCR=await worker.recognize(header);
      const firstDate=inferFirstDate(headerOCR.data.text||"");

      const cleanStaff=staff.map((r,i)=>({...r,id:`staff-${i}`}));
      const grid=detectRosterGridBounds(canvas,cleanStaff);
      const bounds=grid.dayBounds;

      setTable({
        fileName:file.name,
        canvas,
        staff:cleanStaff,
        bounds,
        workingBounds:grid.workingBounds,
        gridLines:grid.lines,
        firstDate
      });
      const preferred=cleanStaff.find(r=>/PRABHAKAR|VIMAL/i.test(r.name))||cleanStaff[0];
      setSelectedStaff(preferred.id);
      setProgress(65);
      await readStaffRow({
        fileName:file.name,
        canvas,
        staff:cleanStaff,
        bounds,
        workingBounds:grid.workingBounds,
        gridLines:grid.lines,
        firstDate
      },preferred.id,worker);
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
      const bounds=source.bounds;
      const cells=[],thumbs=[];
      for(let i=0;i<14;i++){
        if(ownWorker)setProgress(Math.round(i/14*88));
        const x0=bounds[i],x1=bounds[i+1];

        // Preserve the exact cell for the user-facing thumbnail.
        const thumbCrop=rawCropCanvas(
          source.canvas,
          x0+1,row.y0+1,
          x1-1,row.y1-1,
          6
        );
        thumbs.push(dataURL(thumbCrop));

        // OCR a tighter copy and remove the table/grid borders internally.
        const ocrRaw=rawCropCanvas(
          source.canvas,
          x0+1,row.y0+1,
          x1-1,row.y1-1,
          10
        );
        const chosen=await recognizeShiftCell(worker,ocrRaw);

        // Never display a guessed invalid value. A low-confidence cell remains
        // blank/red so the user can copy the visible source-cell text manually.
        cells.push(validateShift(chosen).ok?chosen:"");
      }
      const wh0=source.workingBounds?.[0] ?? source.canvas.width*.915;
      const wh1=source.workingBounds?.[1] ?? source.canvas.width*.992;
      const whCrop=cropCanvas(source.canvas,wh0+1,row.y0+1,wh1-1,row.y1-1,7);
      const whText=await recognize(worker,whCrop,"7","0123456789.");
      const whMatch=whText.match(/\d+(?:\.\d+)?/);
      const workingHours=whMatch?Number(whMatch[0]):null;
      setReview({
        fileName:source.fileName,staffId:row.id,name:row.name,
        firstDate:source.firstDate,cells,thumbs,workingHours
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
  const allValid=review?review.cells.every(c=>validateShift(c).ok):false;
  const importReview=()=>{
    if(!review)return;
    const bad=review.cells.filter(c=>!validateShift(c).ok).length;
    if(bad){setError(`Correct ${bad} highlighted shift ${bad===1?"cell":"cells"} first.`);return;}
    const added=review.cells.map((raw,i)=>{
      const info=validateShift(raw),v=info.value;
      return {
        id:`img-${Date.now()}-${i}`,name:review.name,date:addDays(review.firstDate,i),
        time:CODES.has(v)?"":v,code:CODES.has(v)?v:"",hours:info.hours||0,source:review.fileName
      };
    });
    setEntries(old=>[
      ...old.filter(e=>!(e.name===review.name&&added.some(a=>a.date===e.date))),
      ...added
    ]);
    setReview(null);setTable(null);setPreview(null);setTab("dashboard");
  };

  const names=useMemo(()=>[...new Set(entries.map(e=>e.name))].sort(),[entries]);
  const myName=names.find(n=>/VIMAL|PRABHAKAR/i.test(n))||names[0]||"";
  const mine=useMemo(()=>entries.filter(e=>!myName||e.name===myName).sort((a,b)=>String(a.date).localeCompare(String(b.date))),[entries,myName]);
  const weekStart=mondayOf(todayISO());
  const week=mine.filter(e=>e.date>=weekStart&&e.date<addDays(weekStart,7));
  const month=mine.filter(e=>e.date?.startsWith(calendarMonth.slice(0,7)));
  const weekHours=week.reduce((s,e)=>s+(+e.hours||0),0);
  const monthHours=month.reduce((s,e)=>s+(+e.hours||0),0);
  const upcoming=mine.find(e=>e.date>=todayISO()&&(e.time||e.code!=="RDO"));
  const filtered=entries.filter(e=>!query||e.name.toLowerCase().includes(query.toLowerCase()));

  return <div className="shell">
    <header className="top"><div><div className="vv">VV</div><div className="sub">DUTY ROSTER</div></div></header>

    {tab==="dashboard"&&<main>
      <section className="hero"><small>UPCOMING SHIFT</small>{upcoming?<><h2>{fmt(upcoming.date,{weekday:"long",day:"numeric",month:"long"})}</h2><h1>{upcoming.time||upcoming.code}</h1><p>{upcoming.name}</p></>:<h2>No upcoming shift</h2>}</section>
      <div className="stats"><Stat label="WEEK HOURS" value={weekHours.toFixed(2)}/><Stat label="OVERTIME" value={Math.max(0,weekHours-threshold).toFixed(2)}/></div>
      <section className="panel"><div className="sectionTitle"><b>THIS WEEK</b><span>{fmt(weekStart)} – {fmt(addDays(weekStart,6))}</span></div><Roster rows={Array.from({length:7},(_,i)=>{const d=addDays(weekStart,i);return mine.find(e=>e.date===d)||{id:d,date:d,name:myName,code:"OFF",hours:0}})}/></section>
    </main>}

    {tab==="calendar"&&<main>
      <MonthHead month={calendarMonth} setMonth={setCalendarMonth}/>
      <CalendarGrid month={calendarMonth} rows={mine} selected={selectedDate} onSelect={setSelectedDate}/>
      <section className="panel"><div className="sectionTitle"><b>{fmt(selectedDate,{weekday:"long",day:"numeric",month:"long"})}</b></div><Roster rows={mine.filter(e=>e.date===selectedDate)}/></section>
      <div className="stats three"><Stat label="TOTAL HOURS" value={monthHours.toFixed(2)}/><Stat label="OVERTIME" value={Math.max(0,monthHours-threshold*4).toFixed(2)}/><Stat label="TARGET" value={(threshold*4).toFixed(2)}/></div>
    </main>}

    {tab==="roster"&&<main><Roster rows={mine}/></main>}

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
      <small>{table?"Reading the selected employee row and Working Hours.":"Reading the left-side staff name column first."}</small>
    </div></div>}

    {table&&!processing&&<div className="modalWrap"><div className="modal autoTableModal">
      <div className="modalHead"><div><h2>Roster staff detected</h2><p>Names and grid columns are locked. Each shift cell now uses multi-pass OCR with border removal; uncertain cells stay blank for safe correction.</p></div><button className="ghost" onClick={()=>{setTable(null);setPreview(null);setReview(null)}}><X/></button></div>

      <div className="autoLayout">
        <div className="autoPreview"><img src={preview}/><div className="detectedBadge"><Users size={14}/>{table.staff.length} staff detected</div></div>
        <div className="autoControls">
          <label>Employee
            <select value={selectedStaff} onChange={e=>selectStaff(e.target.value)}>
              {table.staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
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
        <div className="selectedRowTitle"><b>{review.name}</b><span>14-day row</span></div>
        <div className="preciseReview">
          {review.cells.map((cell,i)=>{
            const info=validateShift(cell);
            return <div className={`preciseRow ${info.ok?"":"bad"}`} key={i}>
              <div className="dateCol">{fmt(addDays(review.firstDate,i),{weekday:"short",day:"numeric",month:"short"})}</div>
              <div className="cellThumb">{review.thumbs[i]?<img src={review.thumbs[i]}/>:"—"}</div>
              <div className="editCol">
                <input value={cell} placeholder="Check cell → RDO or 0500-1300" onChange={e=>updateCell(i,e.target.value)} onBlur={e=>updateCell(i,normalizeShift(e.target.value))}/>
                {!info.ok&&<small>{info.reason}</small>}
              </div>
              <div className="hoursCol">{info.ok?`${(info.hours||0).toFixed(1)}h`:"—"}</div>
            </div>
          })}
        </div>
        <div className="importFooter">
          <span className={allValid?"ready":"notReady"}>{allValid?"✓ All 14 days valid":`${review.cells.filter(c=>!validateShift(c).ok).length} cells need correction`}</span>
          <button className="primary" disabled={!allValid} onClick={importReview}><Check size={16}/> Import {review.name}</button>
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
function Roster({rows}){if(!rows.length)return <div className="empty">No shifts found.</div>;return <div className="list">{rows.map(e=><div className="item" key={e.id}><div><small>{fmt(e.date,{weekday:"short",day:"numeric",month:"short"})}</small><b>{e.time||e.code||"Off"}</b><span>{e.name}</span></div><strong>{(+e.hours||0).toFixed(2)}<small> hrs</small></strong></div>)}</div>}
function MonthHead({month,setMonth}){const move=n=>{const d=new Date(`${month}T12:00:00`);d.setMonth(d.getMonth()+n);setMonth(d.toISOString().slice(0,7)+"-01")};return <div className="monthHead"><button className="ghost" onClick={()=>move(-1)}><ChevronLeft/></button><h2>{new Date(`${month}T12:00:00`).toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2><button className="ghost" onClick={()=>move(1)}><ChevronRight/></button></div>}
function CalendarGrid({month,rows,selected,onSelect}){const d=new Date(`${month}T12:00:00`),first=new Date(d.getFullYear(),d.getMonth(),1),days=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(),lead=(first.getDay()+6)%7;const cells=[...Array(lead).fill(null),...Array.from({length:days},(_,i)=>i+1)];while(cells.length%7)cells.push(null);return <div className="cal">{["MON","TUE","WED","THU","FRI","SAT","SUN"].map(x=><div className="dow" key={x}>{x}</div>)}{cells.map((n,i)=>{if(!n)return <div key={i}/>;const iso=new Date(d.getFullYear(),d.getMonth(),n,12).toISOString().slice(0,10),r=rows.find(x=>x.date===iso);return <button key={i} className={selected===iso?"selected":""} onClick={()=>onSelect(iso)}><b>{n}</b>{r&&<span className={r.code==="RDO"?"off":""}/>}</button>})}</div>}
function exportCSV(rows){const csv=Papa.unparse(rows);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="vv-roster.csv";a.click()}

createRoot(document.getElementById("root")).render(<App/>);
