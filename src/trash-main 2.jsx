
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import Tesseract from "tesseract.js";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Home, CalendarDays, ClipboardList, Search, Menu, Camera, FileSpreadsheet,
  Download, Trash2, ChevronLeft, ChevronRight, X, Check, AlertTriangle,
  Users, Clock3, Plane, RefreshCw
} from "lucide-react";
import "./styles.css";


import { createClient } from "@supabase/supabase-js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(err => {
      console.warn("Service worker registration failed:", err);
    });
  });
}


const STORE = "vv-roster-auto-table-v4";
const CODES = new Set(["RDO","TRNG","AL","ALV","ALLV","ALTH","HACC","OFF","SICK","SL","LEAVE"]);

function todayISO(){ return new Date().toISOString().slice(0,10); }
function addDays(iso,n){ const d=new Date(`${iso}T12:00:00`); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function mondayOf(iso){ const d=new Date(`${iso}T12:00:00`); const n=(d.getDay()+6)%7; d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function fmt(iso,opts={weekday:"short",day:"numeric",month:"short"}){ return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined,opts) : ""; }
// Separate from fmt() above: that helper is hardcoded for plain calendar
// dates like "2026-08-18" and always appends "T12:00:00" before parsing.
// Flight times (and other full timestamps) are already complete ISO
// datetimes — appending T12:00:00 onto those breaks parsing entirely
// (silently produces "Invalid Date"). This formats a real timestamp as-is.
function fmtTime(iso){
  if(!iso)return"";
  const d=new Date(iso);
  return isNaN(d.getTime())?"":d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",hour12:false});
}

// IATA codes for New Zealand airports Air NZ serves domestically. Anything
// AKL connects to outside this set is treated as international. Not
// exhaustive of every tiny NZ airstrip, but covers all scheduled Air NZ
// domestic routes out of Auckland.
const NZ_DOMESTIC_IATA=new Set([
  "WLG","CHC","ZQN","DUD","NPE","NSN","ROT","TUO","PMR","WHK","HLZ",
  "GIS","NPL","IVC","BHE","WKA","KKE","TRG","WRE","KAT","GMN","PPQ",
  "TIU","WSZ","HKK","WAG"
]);
function isDomesticRoute(iataCode){
  return NZ_DOMESTIC_IATA.has(String(iataCode||"").toUpperCase());
}

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
function dataURL(c){ try{return c.toDataURL('image/jpeg', 0.95)}catch{return ""} }

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

  // Only merge candidates that land on the same physical row (by position).
  // Two employees whose OCR'd names happen to look alike must NOT be
  // collapsed into a single row — that silently deletes a real employee.
  const dedup=[];
  for(const n of candidates){
    if(!dedup.some(x=>Math.abs(x.cy-n.cy)<4)){
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

// --- Geometric row detection -------------------------------------------
// Row boundaries come ONLY from the table's horizontal ruling lines (or, for
// the header band, from its distinct dark fill). OCR is never allowed to
// decide whether a row exists — it only runs afterward, inside an already-
// fixed row band, to read the name text. This prevents a hard-to-OCR name
// (faint ink, cramped handwriting, glare) from silently deleting an
// employee, and prevents two different employees from being merged just
// because OCR happened to read similar-looking text for both of them.

function horizontalRowScan(canvas,region){
  const ctx=canvas.getContext("2d");
  const left=Math.max(0,Math.floor(region.x0));
  const right=Math.min(canvas.width,Math.ceil(region.x1));
  const top=Math.max(0,Math.floor(region.y0));
  const bottom=Math.min(canvas.height,Math.ceil(region.y1));
  const w=Math.max(1,right-left), h=Math.max(1,bottom-top);
  const img=ctx.getImageData(left,top,w,h),d=img.data;

  const darkFrac=new Array(h).fill(0); // ruling lines: dark across ~full width
  const avgLum=new Array(h).fill(255); // header shading: dark on average

  for(let y=0;y<h;y++){
    let dark=0,total=0,sum=0;
    for(let x=0;x<w;x+=2){
      const i=(y*w+x)*4;
      const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
      sum+=g;total++;
      if(g<190)dark++;
    }
    darkFrac[y]=total?dark/total:0;
    avgLum[y]=total?sum/total:255;
  }
  return {darkFrac,avgLum,top,h};
}

function detectRowLinesInTableRegion(canvas,region){
  const {darkFrac,top,h}=horizontalRowScan(canvas,region);
  const lineThreshold=.5;
  const isLine=new Array(h).fill(false);
  for(let y=0;y<h;y++)isLine[y]=darkFrac[y]>=lineThreshold;

  // A run of consecutive dark rows is either a THIN printed ruling line
  // (collapse to a single midpoint boundary) or a THICK shaded header bar
  // (its own start and end are both real boundaries — collapsing it to one
  // midpoint would merge the header into whichever row sits next to it,
  // which is exactly the bug that let header text bleed into an employee
  // row and vice versa).
  const THIN_RUN_MAX=6;
  const pts=[0];
  let start=null;
  for(let y=0;y<h;y++){
    if(isLine[y]){
      if(start===null)start=y;
    }else if(start!==null){
      const runLen=y-start;
      if(runLen<=THIN_RUN_MAX)pts.push(Math.round((start+y-1)/2));
      else{pts.push(start);pts.push(y-1);}
      start=null;
    }
  }
  if(start!==null){
    const runLen=h-start;
    if(runLen<=THIN_RUN_MAX)pts.push(Math.round((start+h-1)/2));
    else{pts.push(start);pts.push(h-1);}
  }
  pts.push(h-1);

  const abs=[...new Set(pts.map(y=>y+top))].sort((a,b)=>a-b);
  // Only merge points that are essentially duplicates (a couple px of noise);
  // a genuine thin header bar's two edges must NOT be merged away.
  const lines=[];
  for(const y of abs){
    if(!lines.length||y-lines[lines.length-1]>2)lines.push(y);
  }
  return lines;
}

function detectRowBandsInTableRegion(canvas,region){

  const lines=detectRowLinesInTableRegion(canvas,region);
  // Need enough ruled lines to trust this as a real grid; otherwise the
  // caller should fall back to the legacy OCR-driven detector.
  if(lines.length<4)return [];

  const bands=[];
  for(let i=0;i<lines.length-1;i++){
    const y0=lines[i]+(i===0?0:1);
    const y1=lines[i+1];
    if(y1-y0<3)continue; // degenerate sliver between two adjacent lines
    bands.push({y0,y1,cy:(y0+y1)/2,height:y1-y0});
  }
  if(!bands.length)return [];

  // Shift-block header bars are structurally much thinner than a real
  // employee row (verified against real rosters: ~16px vs ~31px). This is a
  // pure geometry check — independent of OCR and of shading color, which
  // varies by photo and can be nearly indistinguishable from a legitimate
  // employee row's own zebra-striping (luminance alone would misclassify
  // real employee rows as headers). A height-based cut can't accidentally
  // delete a real employee, since every real row clusters tightly around
  // the table's typical row height.
  const heights=[...bands.map(b=>b.height)].sort((a,b)=>a-b);
  const medianHeight=heights[Math.floor(heights.length/2)];

  return bands.filter(b=>b.height>=medianHeight*.55);
}


function nameCellVariant(raw,threshold){
  const c=document.createElement("canvas");
  c.width=raw.width;c.height=raw.height;
  const ctx=c.getContext("2d");
  ctx.drawImage(raw,0,0);
  const img=ctx.getImageData(0,0,c.width,c.height),d=img.data;
  for(let i=0;i<d.length;i+=4){
    const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    const v=g<threshold?0:255;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);
  return c;
}

// Read a name cell with several independent OCR passes (different contrast
// thresholds and page-segmentation modes) and only trust the result when
// passes agree. This raises accuracy without ever fabricating a name: if the
// passes disagree, we report low confidence rather than guessing.
async function robustNameOCR(worker,raw){
  const variants=[
    {canvas:preprocessCanvas(raw,1.5),psm:"7"},
    {canvas:nameCellVariant(raw,150),psm:"7"},
    {canvas:nameCellVariant(raw,170),psm:"7"},
    {canvas:nameCellVariant(raw,190),psm:"13"}
  ];

  const results=[];
  for(const v of variants){
    try{
      await worker.setParameters({tessedit_pageseg_mode:v.psm,preserve_interword_spaces:"1"});
      const r=await worker.recognize(v.canvas);
      const text=cleanStaffName((r.data.text||"").replace(/\n+/g," "));
      if(text)results.push({text,conf:r.data.confidence||0});
    }catch{ /* a single failed pass just doesn't vote */ }
  }
  if(!results.length)return {name:"",confident:false};

  // Group passes whose readings agree once case/punctuation noise is
  // stripped. Passes agreeing across different thresholds/segmentations is a
  // far stronger signal than any single pass's self-reported confidence.
  const norm=s=>s.toLowerCase().replace(/[^a-z]/g,"");
  const groups=new Map();
  for(const r of results){
    const key=norm(r.text);
    if(!key)continue;
    const g=groups.get(key)||{text:r.text,count:0,conf:0};
    g.count++;
    g.conf=Math.max(g.conf,r.conf);
    if(r.text.length>g.text.length)g.text=r.text; // keep the best-formed casing/punctuation
    groups.set(key,g);
  }
  const ranked=[...groups.values()].sort((a,b)=>(b.count-a.count)||(b.conf-a.conf));
  const top=ranked[0];
  if(!top)return {name:"",confident:false};
  return {name:top.text,confident:top.count>=2||(top.conf>=65&&plausibleStaffName(top.text))};
}

// Find the real vertical rule between the name column and the first date
// column, instead of assuming a fixed width fraction — the fraction that
// works for one roster's column proportions can clip real letters or bleed
// into the next column's shift-time text on another roster.
function detectNameColumnBounds(canvas,region,bands){
  const ctx=canvas.getContext("2d");
  const left=Math.max(0,Math.floor(region.x0));
  const scanRight=Math.min(canvas.width,Math.floor(region.x0+(region.x1-region.x0)*.35));
  const w=scanRight-left;
  const fallback={nx0:region.x0,nx1:region.x0+(region.x1-region.x0)*.19};
  if(w<=0||!bands.length)return fallback;

  const sample=bands.slice(0,8);
  if(!sample.length)return fallback;

  // Vote per band rather than pooling pixels into one average: a genuine
  // column divider is dark for nearly the full height of MOST sampled rows.
  // One non-standard row (a free-floating title line with no grid under it,
  // or a column-day header whose border stroke renders slightly differently)
  // should only cost that row's single vote, not drag down a shared average
  // enough to hide the real line.
  const votes=new Array(w).fill(0);
  for(const b of sample){
    const y0=Math.max(0,Math.floor(b.y0)),y1=Math.min(canvas.height,Math.ceil(b.y1));
    const rh=Math.max(1,y1-y0);
    const img=ctx.getImageData(left,y0,w,rh);const d=img.data;
    for(let x=0;x<w;x++){
      let dark=0;
      for(let ry=0;ry<rh;ry++){
        const i=(ry*w+x)*4;
        const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
        if(g<190)dark++;
      }
      if(dark/rh>.85)votes[x]++;
    }
  }

  const minX=Math.round(w*.02);
  const needed=Math.max(1,Math.ceil(sample.length*.6));
  const isCandidate=new Array(w).fill(false);
  for(let x=minX;x<w;x++)isCandidate[x]=votes[x]>=needed;

  // A genuine printed ruling line is only a few px wide. A wide contiguous
  // dark block (screenshot chrome, a scrollbar sliver, a stray margin baked
  // into the image) can also pass the vote test but is not a column divider
  // — skip it entirely rather than anchoring on its edge.
  const MAX_LINE_WIDTH=5;
  const lineMidpoints=[];
  let runStart=null;
  for(let x=minX;x<w;x++){
    if(isCandidate[x]){
      if(runStart===null)runStart=x;
    }else if(runStart!==null){
      if(x-runStart<=MAX_LINE_WIDTH)lineMidpoints.push(Math.round((runStart+x-1)/2));
      runStart=null;
    }
  }
  if(runStart!==null&&w-runStart<=MAX_LINE_WIDTH)lineMidpoints.push(Math.round((runStart+w-1)/2));

  if(lineMidpoints.length<2)return fallback;
  const leftBorder=left+lineMidpoints[0];
  const rightCandidate=lineMidpoints.find(x=>x>lineMidpoints[0]+5);
  if(rightCandidate===undefined)return {nx0:leftBorder+2,nx1:fallback.nx1};
  const rightBorder=left+rightCandidate;
  return {nx0:leftBorder+2,nx1:rightBorder-1};
}

// Known non-employee table text (title/date line, column-day headers) —
// only used to drop a band when OCR CONFIDENTLY reads one of these, never as
// a general "doesn't look like a name" guess that could delete a real,
// hard-to-read employee.
function looksLikeTableHeaderText(s){
  const t=(s||"").trim();
  if(!t)return false;
  if(/\b(?:AIRPORT|WORKING|HOURS|SHIFT|ROSTER)\b/i.test(t))return true;
  if(/\b(?:MON|TUE|WED|THU|FRI|SAT|SUN)(?:DAY)?\b/i.test(t))return true;
  if(/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t))return true;
  return false;
}

async function namesForRowBands(canvas,bands,region,worker){
  let nx0,nx1,columnDetectError="";
  try{
    ({nx0,nx1}=detectNameColumnBounds(canvas,region,bands));
  }catch(err){
    columnDetectError=String(err?.message||err);
    const fallback=region.x0+(region.x1-region.x0)*.19;
    nx0=region.x0;nx1=fallback;
  }

  const out=[];
  for(let i=0;i<bands.length;i++){
    const b=bands[i];
    let name="",confident=false,debugError=columnDetectError;
    try{
      const raw=rawCropCanvas(canvas,nx0,b.y0,nx1,b.y1,5);
      const read=await robustNameOCR(worker,raw);
      name=read.name;confident=read.confident;
    }catch(err){
      // Surface the real failure instead of silently swallowing it — a crash
      // and ordinary poor handwriting must not look identical, or a genuine
      // bug is impossible to tell apart from normal OCR limitations.
      debugError=(debugError?debugError+"; ":"")+String(err?.message||err);
    }

    if(looksLikeTableHeaderText(name))continue; // title/date/column-header row, not an employee

    // The row itself is guaranteed to exist because it came from the grid,
    // not from this OCR result. If OCR can't produce a confident name we
    // still keep the row and flag it for manual review instead of dropping it.
    out.push({
      id:`row-${i}`,
      name: name || `Row ${i+1} — name not read`,
      nameUncertain: !confident || !plausibleStaffName(name),
      debugError: debugError||undefined,
      cy:b.cy,y0:b.y0,y1:b.y1
    });
  }
  return out;
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


// Converts between the app's compact "HHMM-HHMM" airport format and the
// "HH:MM" format required by <input type="time">, which iOS Safari renders
// as the native scrollable wheel picker (Start/End) — the same UX as the
// Air New Zealand app's shift-time picker.
function airportPartToClock(v){
  const t=String(v||"").replace(/\D/g,"");
  if(t.length!==4)return "";
  const hh=t.slice(0,2),mm=t.slice(2,4);
  if(+hh>23||+mm>59)return "";
  return `${hh}:${mm}`;
}
function clockToAirportPart(v){
  return String(v||"").replace(":","");
}
function splitAirportRange(s){
  const [a,b]=String(s||"").split("-");
  return {start:airportPartToClock(a),end:airportPartToClock(b)};
}
function joinAirportRange(startClock,endClock){
  const a=clockToAirportPart(startClock)||"0000";
  const b=clockToAirportPart(endClock)||"0000";
  return `${a}-${b}`;
}

const HOUR_OPTIONS=Array.from({length:24},(_,i)=>String(i).padStart(2,"0"));
const MINUTE_OPTIONS=Array.from({length:60},(_,i)=>String(i).padStart(2,"0"));

// Always-24-hour wheel picker. iOS renders each <select> as its own native
// scrollable wheel, but — unlike <input type="time"> — the displayed values
// are exactly what's listed here, not silently swapped to 12-hour AM/PM by
// the phone's system Region setting.
function Time24Wheel({value,onChange,ariaLabel}){
  const [hh,mm]=value?value.split(":"):["00","00"];
  return <div className="time24Group" aria-label={ariaLabel}>
    <select
      className="time24Select"
      value={hh}
      onChange={ev=>onChange(`${ev.target.value}:${mm}`)}
      aria-label={`${ariaLabel} hour`}
    >
      {HOUR_OPTIONS.map(h=><option key={h} value={h}>{h}</option>)}
    </select>
    <span className="time24Colon">:</span>
    <select
      className="time24Select"
      value={mm}
      onChange={ev=>onChange(`${hh}:${ev.target.value}`)}
      aria-label={`${ariaLabel} minute`}
    >
      {MINUTE_OPTIONS.map(m=><option key={m} value={m}>{m}</option>)}
    </select>
  </div>;
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
  if(endMinutes===startMinutes) return {valid:true,hours:0,time:`${start}-${end}`,display:`${start}-${end}`};
  if(endMinutes<startMinutes) endMinutes += 24*60;

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


const supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
const supabaseKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
const adminEmail=String(import.meta.env.VITE_ADMIN_EMAIL||"").toLowerCase();
const supabase=(supabaseUrl&&supabaseKey)
  ? createClient(supabaseUrl,supabaseKey,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true,
        flowType:"implicit",
        storage:window.localStorage,
        storageKey:"vv-duty-roster-auth"
      }
    })
  : null;

function AccessGate({children}){
  const [session,setSession]=useState(null);
  const [approved,setApproved]=useState(false);
  const [loading,setLoading]=useState(true);
  const [email,setEmail]=useState("");
    const [password,setPassword]=useState("");
    const [recoveryMode,setRecoveryMode]=useState(false);
    const [newPassword,setNewPassword]=useState("");
    const [confirmPassword,setConfirmPassword]=useState("");
  const [msg,setMsg]=useState("");
  const [adminOpen,setAdminOpen]=useState(false);
  const [users,setUsers]=useState([]);
  const [newEmail,setNewEmail]=useState("");

  const current=String(session?.user?.email||"").toLowerCase();
  const isAdmin=current&&current===adminEmail;

  const check=useCallback(async(s)=>{
    if(!supabase||!s?.user?.email){setApproved(false);return;}
    const em=String(s.user.email).toLowerCase();
    if(em===adminEmail){setApproved(true);return;}
    const {data}=await supabase.from("approved_users")
      .select("email,active").eq("email",em).eq("active",true).maybeSingle();
    setApproved(!!data);
  },[]);

  useEffect(()=>{
    if(!supabase){setLoading(false);return;}

    // Keep an explicit recovery marker in the redirect URL. On some mobile
    // browsers the Supabase PASSWORD_RECOVERY event can happen before React's
    // listener is mounted, so relying on that event alone can show Sign in.
    const params=new URLSearchParams(window.location.search);
    const hashParams=new URLSearchParams(window.location.hash.replace(/^#/,""));
    const recoveryFromUrl=params.get("recovery")==="1" || hashParams.get("type")==="recovery";
    if(recoveryFromUrl) setRecoveryMode(true);

    supabase.auth.getSession().then(async({data})=>{
      setSession(data.session||null);
      await check(data.session||null);
      setLoading(false);
    });
    const {data}=supabase.auth.onAuthStateChange(async(event,s)=>{
      setSession(s||null);
      if(event==="PASSWORD_RECOVERY" || recoveryFromUrl) setRecoveryMode(true);
      await check(s||null);
    });
    return()=>data.subscription.unsubscribe();
  },[check]);

  const sendPasswordRecovery=async()=>{
    const em=email.trim().toLowerCase();
    if(!em){setMsg("Enter your email first.");return;}
    setMsg("Sending password reset email…");
    // Always return recovery links to the production VV app. Using an
    // uploaded Vercel preview here can create a redirect mismatch.
    const redirectTo="https://vv-sigma-one.vercel.app/?recovery=1";
    try{
      const result=await Promise.race([
        supabase.auth.resetPasswordForEmail(em,{redirectTo}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error("Request timed out. Please try again.")),15000))
      ]);
      setMsg(result?.error?result.error.message:"Password reset email sent. Check your inbox.");
    }catch(err){
      setMsg(err?.message||"Could not send password reset email. Please try again.");
    }
  };

  const signIn=async()=>{
    const em=email.trim().toLowerCase();
    if(!em||!password)return;
    setMsg("Signing in…");
    const {error}=await supabase.auth.signInWithPassword({
      email:em,
      password
    });
    setMsg(error?error.message:"");
  };

  const saveNewPassword=async()=>{
    if(!newPassword||newPassword.length<8){
      setMsg("Password must be at least 8 characters.");
      return;
    }
    if(newPassword!==confirmPassword){
      setMsg("Passwords do not match.");
      return;
    }
    setMsg("Saving new password…");
    const {error}=await supabase.auth.updateUser({password:newPassword});
    if(error){
      setMsg(error.message);
      return;
    }
    setMsg("Password updated successfully.");
    setRecoveryMode(false);
    setNewPassword("");
    setConfirmPassword("");
    // Remove the recovery marker so refreshes return to normal app mode.
    window.history.replaceState({},document.title,window.location.pathname);
  };

  const loadUsers=async()=>{
    const {data}=await supabase.from("approved_users")
      .select("id,email,active,created_at").order("created_at",{ascending:false});
    setUsers(data||[]);
  };

  const approve=async()=>{
    const em=newEmail.trim().toLowerCase();
    if(!em)return;
    await supabase.from("approved_users").upsert({email:em,active:true},{onConflict:"email"});
    setNewEmail(""); await loadUsers();
  };

  const toggle=async(u)=>{
    await supabase.from("approved_users").update({active:!u.active}).eq("id",u.id);
    await loadUsers();
  };

  if(loading)return <div className="authScreen"><div className="authCard"><h2>VV Duty Roster</h2><p>Checking access…</p></div></div>;

  if(recoveryMode)return <div className="authScreen"><div className="authCard">
    <div className="vv">VV</div><h2>Create New Password</h2>
    <p>Choose a new password for your VV Duty Roster account.</p>
    <input type="password" placeholder="New password" value={newPassword}
      autoComplete="new-password" onChange={e=>setNewPassword(e.target.value)} />
    <input type="password" placeholder="Confirm new password" value={confirmPassword}
      autoComplete="new-password" onChange={e=>setConfirmPassword(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter")saveNewPassword();}} />
    <button className="primary authFull" onClick={saveNewPassword}>Save password</button>
    {msg&&<small>{msg}</small>}
  </div></div>;

  if(!session)return <div className="authScreen"><div className="authCard">
    <div className="vv">VV</div><h2>Private Access</h2>
    <p>Only approved users can use this app.</p>
    <input type="email" placeholder="Work email" value={email} autoComplete="email" onChange={e=>setEmail(e.target.value)} />
    <input type="password" placeholder="Password" value={password} autoComplete="current-password"
      onChange={e=>setPassword(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter")signIn();}} />
    <button className="primary authFull" onClick={signIn}>Sign in</button>
    <button className="ghost authFull" onClick={sendPasswordRecovery}>Forgot password?</button>
    {msg&&<small>{msg}</small>}
  </div></div>;

  if(!approved)return <div className="authScreen"><div className="authCard">
    <h2>Access not approved</h2><p>{current}</p>
    <button className="ghost authFull" onClick={()=>supabase.auth.signOut()}>Sign out</button>
  </div></div>;

  return <>
    {children}
    <div className="accessBar">
      {isAdmin&&<button className="adminMobileButton" onClick={async()=>{setAdminOpen(true);await loadUsers();}}>Admin</button>}
      <button className="signOutMobileButton" onClick={()=>supabase.auth.signOut()}>Sign out</button>
    </div>
    {adminOpen&&<div className="modalWrap"><div className="modal adminAccess">
      <div className="modalHead"><div><h2>Approved Users</h2><p>Approve once; revoke any time.</p></div><button className="ghost" onClick={()=>setAdminOpen(false)}>×</button></div>
      <div className="approveRow"><input type="email" placeholder="user@example.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)}/><button className="primary" onClick={approve}>Approve</button></div>
      <div className="approvedList">
        {users.map(u=><div className="approvedItem" key={u.id}><div><b>{u.email}</b><small>{u.active?"Access ON":"Access OFF"}</small></div><button className={u.active?"danger":"primary"} onClick={()=>toggle(u)}>{u.active?"Revoke":"Restore"}</button></div>)}
      </div>
    </div></div>}
  </>;
}

function App(){
  const [entries,setEntries]=useState([]);
  const [tab,setTab]=useState("dashboard");
  const [searchDay,setSearchDay]=useState("");
  const [flights,setFlights]=useState(null); // null = not yet loaded
  const [flightsLoading,setFlightsLoading]=useState(false);
  const [flightsError,setFlightsError]=useState(null);
  const [flightsUpdatedAt,setFlightsUpdatedAt]=useState(null);
  const [flightsDirection,setFlightsDirection]=useState("departures"); // "departures"|"arrivals"
  const [flightsScope,setFlightsScope]=useState("all"); // "all"|"domestic"|"international"
  // Keeps the list focused on flights actually relevant right now — from
  // about an hour ago (so recently-landed/departed flights don't vanish
  // instantly) through the next several hours. Adjust the two numbers below
  // to widen/narrow the window.
  const FLIGHT_WINDOW_HOURS_BACK=1;
  const FLIGHT_WINDOW_HOURS_FORWARD=6;
  function isWithinFlightWindow(iso){
    if(!iso)return false;
    const t=new Date(iso).getTime();
    if(isNaN(t))return false;
    const now=Date.now();
    return t>=now-FLIGHT_WINDOW_HOURS_BACK*3600000 && t<=now+FLIGHT_WINDOW_HOURS_FORWARD*3600000;
  }
  const visibleFlights=useMemo(()=>{
    if(!flights)return[];
    let list=flights.filter(f=>isWithinFlightWindow(f.scheduledTime));
    if(flightsScope!=="all"){
      list=list.filter(f=>
        flightsScope==="domestic" ? isDomesticRoute(f.route) : !isDomesticRoute(f.route)
      );
    }
    return list.sort((a,b)=>new Date(a.scheduledTime)-new Date(b.scheduledTime));
  },[flights,flightsScope]);

  async function fetchFlights(direction=flightsDirection){
    setFlightsLoading(true);
    setFlightsError(null);
    try{
      const res=await fetch(`/api/flights?direction=${direction}`);
      const data=await res.json();
      if(!res.ok||data.error)throw new Error(data.error||"Couldn't load flight status.");
      setFlights(data.flights||[]);
      setFlightsUpdatedAt(new Date());
    }catch(err){
      setFlightsError(err?.message||"Couldn't load flight status.");
    }finally{
      setFlightsLoading(false);
    }
  }

  useEffect(()=>{
    if(tab==="flights"&&flights===null)fetchFlights(flightsDirection);
  },[tab]);
  const [threshold,setThreshold]=useState(38);
  const [payRate,setPayRate]=useState(33.39);
  const [otTier1Hours,setOtTier1Hours]=useState(3);
  const [otTier1Mult,setOtTier1Mult]=useState(1.5);
  const [otTier2Mult,setOtTier2Mult]=useState(2.0);
  const [payFrequency,setPayFrequency]=useState("fortnightly");
  const [myNameOverride,setMyNameOverride]=useState("");
  const [unionPct,setUnionPct]=useState(0.37);
  const [kiwiSaverPct,setKiwiSaverPct]=useState(3.5);
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

  useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");setEntries(x.entries||[]);setThreshold(x.threshold||38);setPayRate(x.payRate??33.39);setOtTier1Hours(x.otTier1Hours??3);setOtTier1Mult(x.otTier1Mult??1.5);setOtTier2Mult(x.otTier2Mult??2.0);setPayFrequency(x.payFrequency??"fortnightly");setUnionPct(x.unionPct??0.37);setKiwiSaverPct(x.kiwiSaverPct??3.5);setMyNameOverride(x.myNameOverride??"")}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify({entries,threshold,payRate,otTier1Hours,otTier1Mult,otTier2Mult,payFrequency,unionPct,kiwiSaverPct,myNameOverride}))}catch{}},[entries,threshold,payRate,otTier1Hours,otTier1Mult,otTier2Mult,payFrequency,unionPct,kiwiSaverPct,myNameOverride]);

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

        let staff;
        const bands=detectRowBandsInTableRegion(canvas,region);
        if(bands.length>=3){
          // Primary path: rows come from the table's ruled lines, so every
          // employee row survives even if OCR can't read a given name.
          staff=await namesForRowBands(canvas,bands,region,worker);
        }else{
          // Fallback: no reliable horizontal ruling detected in this photo —
          // use the legacy OCR-driven name detector instead.
          const names=await detectNamesInTableRegion(canvas,region,worker);
          staff=attachBoundsWithinTable(names,region);
        }
        if(!staff.length)continue;
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

  // Lets the admin correct an OCR misread directly, rather than needing a
  // re-scan. Clears the uncertain flag once a human has confirmed/fixed it,
  // and updates any row review already open for this employee.
  const updateStaffName=(id,newName)=>{
    setTable(t=>t?{...t,staff:t.staff.map(s=>s.id===id?{...s,name:newName,nameUncertain:false}:s)}:t);
    setReview(r=>r&&r.staffId===id?{...r,name:newName}:r);
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
        editableValue:"0000-0000",
        amShift:"0000-0000",
        pmShift:"0000-0000",
        amType:"RT",
        pmType:"RT",
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

  const updateEntryValue=(id,period,nextValue,field="time")=>{
    setEntries(old=>old.map(e=>{
      if(e.id!==id)return e;

      const side=period==="pm" ? "pm" : "am";

      if(field==="type"){
        return {
          ...e,
          [`${side}Type`]:nextValue==="OT" ? "OT" : "RT"
        };
      }

      const raw=String(nextValue||"").toUpperCase()
        .replace(/[–—]/g,"-")
        .replace(/\s+/g," ")
        .trim();

      return {
        ...e,
        [`${side}Shift`]:raw || "0000-0000"
      };
    }));
  };

  useEffect(()=>{
    setEntries(old=>{
      let changed=false;
      const next=old.map(e=>{
        if(
          e.amShift===undefined || e.pmShift===undefined ||
          e.amType===undefined || e.pmType===undefined
        ){
          changed=true;
          return {
            ...e,
            amShift:e.amShift ?? "0000-0000",
            pmShift:e.pmShift ?? "0000-0000",
            amType:e.amType ?? "RT",
            pmType:e.pmType ?? "RT"
          };
        }
        return e;
      });
      return changed?next:old;
    });
  },[]);

  const names=useMemo(()=>[...new Set(entries.map(e=>e.name))].sort(),[entries]);
  // Prefer an explicit "this is me" selection; fall back to the old
  // name-matching guess only if nothing has been chosen yet. The guess alone
  // isn't safe for anyone whose name isn't Vimal/Prabhakar or first
  // alphabetically — which matters once more than one person uses the app.
  const myName=myNameOverride||names.find(n=>/VIMAL|PRABHAKAR/i.test(n))||names[0]||"";
  const mine=useMemo(()=>entries.filter(e=>!myName||e.name===myName).sort((a,b)=>String(a.date).localeCompare(String(b.date))),[entries,myName]);

  // Needed so shift data and push subscriptions can be linked to the signed-in
  // account — evening reminders are sent server-side, which has no access to
  // this device's local storage, only to what's synced to Supabase below.
  const [userId,setUserId]=useState(null);
  const [reminderStatus,setReminderStatus]=useState("");
  const [notifyHour,setNotifyHour]=useState(19);
  const [notifyMinute,setNotifyMinute]=useState(0);
  const [subscriptionStatus,setSubscriptionStatus]=useState("checking"); // "checking"|"active"|"inactive"|"unsupported"
  const isApplyingServerValue=useRef(false);
  // Guards the auto-save effect against firing before we've even tried to
  // load the real saved value from the server. Without this, the auto-save
  // effect (which also depends on userId, since it needs it to write to
  // Supabase) fires the instant userId resolves — racing the load effect
  // below and sometimes writing the still-default 19:00 back to the server
  // before the real saved value has had a chance to load into state.
  const hasAttemptedServerLoad=useRef(false);
  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getUser().then(({data})=>setUserId(data?.user?.id||null));
  },[]);

  // On open, finds out whether THIS device already has a working
  // subscription and, if so, loads the time it's actually set to — instead
  // of always showing the hardcoded 19:00 default regardless of what's
  // really saved, which was confusingly making it look like the time kept
  // "resetting" every time the app was reopened.
  useEffect(()=>{
    if(!supabase||!userId)return;
    if(!("serviceWorker" in navigator)||!("PushManager" in window)){setSubscriptionStatus("unsupported");return;}
    let cancelled=false;
    (async()=>{
      try{
        const reg=await navigator.serviceWorker.ready;
        const existing=await reg.pushManager.getSubscription();
        if(!existing){if(!cancelled){setSubscriptionStatus("inactive");hasAttemptedServerLoad.current=true;}return;}
        // Keyed by user_id, not endpoint — endpoint changes on every
        // re-subscribe, which previously left this query unable to find a
        // row at all after a device re-subscribed (see migration notes).
        const {data,error}=await supabase.from("push_subscriptions")
          .select("notify_hour,notify_minute,endpoint").eq("user_id",userId).maybeSingle();
        if(cancelled)return;
        if(error||!data){setSubscriptionStatus("inactive");hasAttemptedServerLoad.current=true;return;}
        isApplyingServerValue.current=true;
        setNotifyHour(data.notify_hour??19);
        setNotifyMinute(data.notify_minute??0);
        // If the browser's live subscription endpoint doesn't match what's
        // stored, the stored row is stale (from a prior device/session) —
        // treat as inactive so the person is prompted to re-enable, rather
        // than showing a false "active" status for a dead subscription.
        setSubscriptionStatus(data.endpoint===existing.toJSON().endpoint?"active":"inactive");
        hasAttemptedServerLoad.current=true;
      }catch{
        if(!cancelled){setSubscriptionStatus("inactive");hasAttemptedServerLoad.current=true;}
      }
    })();
    return()=>{cancelled=true};
  },[userId]);


  // Mirrors this person's own shifts (not every employee's) to Supabase, so
  // the evening reminder job can look up "tomorrow's shift" server-side.
  useEffect(()=>{
    if(!supabase||!userId||!mine.length)return;
    const rows=mine.filter(e=>e.date).map(e=>({
      user_id:userId,
      date:e.date,
      name:e.name||"",
      am_shift:e.amShift??null,
      pm_shift:e.pmShift??null,
      am_type:e.amType??"RT",
      pm_type:e.pmType??"RT",
      updated_at:new Date().toISOString()
    }));
    supabase.from("roster_sync").upsert(rows,{onConflict:"user_id,date"})
      .then(({error})=>{if(error)console.warn("roster_sync upsert failed:",error.message)});
  },[mine,userId]);

  function urlBase64ToUint8Array(base64String){
    const padding="=".repeat((4-base64String.length%4)%4);
    const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
    const raw=atob(base64);
    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }

  const enableEveningReminders=async()=>{
    if(!supabase||!userId){setReminderStatus("Sign in first.");return;}
    if(!("serviceWorker" in navigator)||!("PushManager" in window)){
      setReminderStatus("This browser doesn't support push notifications.");
      return;
    }
    try{
      const perm=await Notification.requestPermission();
      if(perm!=="granted"){setReminderStatus("Notification permission was not granted.");return;}
      const vapidPublicKey=import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if(!vapidPublicKey){setReminderStatus("Missing VAPID key — set VITE_VAPID_PUBLIC_KEY and redeploy.");return;}
      const reg=await navigator.serviceWorker.ready;
      // The browser refuses subscribe() with a different applicationServerKey
      // while an old subscription still exists on the device (throws
      // "Provided applicationServerKey does not match the key in the
      // existing subscription") — this bites every time the VAPID key pair
      // is rotated server-side, since the device's old subscription doesn't
      // know or care that the server-side key changed. Unsubscribing first
      // guarantees subscribe() below can always succeed with the current key.
      const staleSub=await reg.pushManager.getSubscription();
      if(staleSub)await staleSub.unsubscribe();
      const sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(vapidPublicKey)
      });
      const json=sub.toJSON();
      // Keyed by user_id (requires the unique constraint from the dedupe
      // migration) instead of endpoint — endpoint changes every time this
      // runs, which previously caused a new duplicate row per re-subscribe
      // instead of replacing the old one.
      const {error}=await supabase.from("push_subscriptions").upsert({
        user_id:userId,
        endpoint:json.endpoint,
        p256dh:json.keys.p256dh,
        auth:json.keys.auth,
        notify_hour:notifyHour,
        notify_minute:notifyMinute,
        last_sent_date:null // changing the time should apply tonight, not wait until tomorrow
      },{onConflict:"user_id"});
      if(error){setReminderStatus("Saved locally but failed to sync: "+error.message);return;}
      const hh=String(notifyHour).padStart(2,"0"),mm=String(notifyMinute).padStart(2,"0");
      setReminderStatus(`Evening reminders enabled — you'll get a notification at ${hh}:${mm} NZT with tomorrow's shift.`);
      setSubscriptionStatus("active");
    }catch(err){
      setReminderStatus("Couldn't enable reminders: "+(err?.message||String(err)));
    }
  };

  // Auto-saves a changed reminder time immediately, without needing the
  // button tapped again — only if reminders are already enabled on this
  // device (never requests permission or creates a subscription on its own).
  // Skips the very first run (component mount) and any run caused by loading
  // the server's saved value above, so opening the app or seeing the loaded
  // time doesn't get mistaken for a user edit and re-save it pointlessly.
  const skipInitialNotifyEffect=useRef(true);
  useEffect(()=>{
    if(skipInitialNotifyEffect.current){skipInitialNotifyEffect.current=false;return;}
    if(isApplyingServerValue.current){isApplyingServerValue.current=false;return;}
    if(!supabase||!userId)return;
    // Never save before the server load attempt has finished — otherwise this
    // effect (which also depends on userId) can fire the instant userId
    // resolves and write the still-default 19:00 back to the server before
    // the real saved value has loaded, silently clobbering it.
    if(!hasAttemptedServerLoad.current)return;
    if(!("serviceWorker" in navigator)||!("PushManager" in window))return;
    let cancelled=false;
    (async()=>{
      try{
        const reg=await navigator.serviceWorker.ready;
        const existing=await reg.pushManager.getSubscription();
        if(!existing){
          if(!cancelled)setReminderStatus("Reminders aren't enabled on this device yet — tap \"Enable Evening Reminders\" below first.");
          return;
        }
        if(cancelled)return;
        // Keyed by user_id, not endpoint — see migration notes. Also
        // requests the updated row back via .select() so we can tell a real
        // update apart from one that silently matched zero rows (Supabase
        // returns success either way; only the returned row count tells you
        // whether anything actually changed).
        const {data,error}=await supabase.from("push_subscriptions").update({
          notify_hour:notifyHour,
          notify_minute:notifyMinute,
          last_sent_date:null // a time change should apply tonight, not wait until tomorrow
        }).eq("user_id",userId).select();
        if(cancelled)return;
        if(error){setReminderStatus("Couldn't save the new time: "+error.message);return;}
        if(!data||!data.length){
          setReminderStatus("Couldn't save the new time — no saved subscription found for this account. Tap \"Enable Evening Reminders\" again to fix this.");
          setSubscriptionStatus("inactive");
          return;
        }
        const hh=String(notifyHour).padStart(2,"0"),mm=String(notifyMinute).padStart(2,"0");
        setReminderStatus(`Reminder time updated to ${hh}:${mm} NZT.`);
        setSubscriptionStatus("active");
      }catch(err){
        if(!cancelled)setReminderStatus("Couldn't save the new time: "+(err?.message||String(err)));
      }
    })();
    return()=>{cancelled=true};
  },[notifyHour,notifyMinute,userId]);


  const weekStart=mondayOf(mine.length?mine[0].date:todayISO());
  const week=mine.filter(e=>e.date>=weekStart&&e.date<addDays(weekStart,7));
  const month=mine.filter(e=>e.date?.startsWith(calendarMonth.slice(0,7)));
  const weekHours=week.reduce((s,e)=>s+effectiveEntryHours(e),0);
  const monthHours=month.reduce((s,e)=>s+effectiveEntryHours(e),0);
  const rosterTotalHours=mine.reduce((s,e)=>s+effectiveEntryHours(e),0);
  const rosterOvertimeHours=mine.reduce((s,e)=>s+entryOvertimeHours(e),0);
  const upcoming=mine.find(e=>airport24HourDuration(entryRosterText(e)).time && e.date>=todayISO()) || mine.find(e=>airport24HourDuration(entryRosterText(e)).time);
  const filtered=entries.filter(e=>{
    if(!searchDay) return true;
    if(!e.date) return false;
    const d=new Date(`${e.date}T12:00:00`);
    const day=new Intl.DateTimeFormat("en-NZ",{weekday:"long"}).format(d);
    return day===searchDay;
  });

  return <div className="shell">
    <header className="top"><div><div className="vv">VV</div><div className="sub">DUTY ROSTER</div></div></header>

    {tab==="dashboard"&&<main>
      <section className="hero"><small>UPCOMING SHIFT</small>{upcoming?<><h2>{fmt(upcoming.date,{weekday:"long",day:"numeric",month:"long"})}</h2>{upcoming.sourceCell?<div className="heroSourceCell"><img src={upcoming.sourceCell} alt={entryRosterText(upcoming)}/></div>:<h1>{entryRosterText(upcoming)||"See roster cell"}</h1>}<p>{upcoming.name}</p></>:<h2>No upcoming shift</h2>}</section>
      <div className="stats"><Stat label="WEEK HOURS" value={weekHours.toFixed(2)}/><Stat label="OVERTIME" value={rosterOvertimeHours.toFixed(2)}/></div>
      <section className="panel"><div className="sectionTitle"><b>THIS WEEK</b><span>{fmt(weekStart)} – {fmt(addDays(weekStart,6))}</span></div><Roster rows={Array.from({length:7},(_,i)=>mine.find(e=>e.date===addDays(weekStart,i))).filter(Boolean)} payRate={payRate} otTier1Hours={otTier1Hours} otTier1Mult={otTier1Mult} otTier2Mult={otTier2Mult}/></section>
    </main>}

    {tab==="calendar"&&<main>
      <MonthHead month={calendarMonth} setMonth={setCalendarMonth}/>
      <CalendarGrid month={calendarMonth} rows={mine} selected={selectedDate} onSelect={setSelectedDate}/>
      <section className="panel"><div className="sectionTitle"><b>{fmt(selectedDate,{weekday:"long",day:"numeric",month:"long"})}</b></div><Roster rows={mine.filter(e=>e.date===selectedDate)} payRate={payRate} otTier1Hours={otTier1Hours} otTier1Mult={otTier1Mult} otTier2Mult={otTier2Mult}/></section>
      <div className="stats calendarTotals"><Stat label="TOTAL HOURS" value={rosterTotalHours.toFixed(2)}/><Stat label="OVERTIME" value={rosterOvertimeHours.toFixed(2)}/></div>
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
        <Roster rows={mine} onEdit={updateEntryValue} payRate={payRate} otTier1Hours={otTier1Hours} otTier1Mult={otTier1Mult} otTier2Mult={otTier2Mult}/>
      </section>
    </main>}

    {tab==="search"&&<main>
      <div className="daySearchCard">
        <div className="daySearchLabel">
          <Search size={17}/>
          <span>SEARCH BY DAY</span>
        </div>

        <div className="daySearchControl">
          <select
            value={searchDay}
            onChange={e=>setSearchDay(e.target.value)}
            aria-label="Search roster by day"
          >
            <option value="">Select day</option>
            <option value="Monday">Monday</option>
            <option value="Tuesday">Tuesday</option>
            <option value="Wednesday">Wednesday</option>
            <option value="Thursday">Thursday</option>
            <option value="Friday">Friday</option>
            <option value="Saturday">Saturday</option>
            <option value="Sunday">Sunday</option>
          </select>

          {searchDay&&
            <button
              className="dayClear"
              onClick={()=>setSearchDay("")}
              aria-label="Clear day"
            >
              <X size={14}/>
            </button>}
        </div>
      </div>

      {searchDay&&
        <div className="searchDayHeading">
          <b>{searchDay}</b>
          <span>{filtered.length} {filtered.length===1?"entry":"entries"}</span>
        </div>}

      <section className="panel searchResults">
        {searchDay
          ? filtered.length
            ? <Roster rows={filtered.slice(0,50)} payRate={payRate} otTier1Hours={otTier1Hours} otTier1Mult={otTier1Mult} otTier2Mult={otTier2Mult}/>
            : <div className="emptySearch">
                <Search size={25}/>
                <b>No roster found</b>
                <span>No roster entries are saved for {searchDay}.</span>
              </div>
          : <div className="emptySearch">
              <Search size={25}/>
              <b>Select a day</b>
              <span>Choose Monday to Sunday to view matching roster entries.</span>
            </div>}
      </section>
    </main>}

    {tab==="flights"&&<main>
      <div className="daySearchCard">
        <div className="daySearchLabel">
          <Plane size={17}/>
          <span>AKL · AIR NEW ZEALAND · NEXT {FLIGHT_WINDOW_HOURS_FORWARD}H</span>
        </div>
        <div className="daySearchControl">
          <select
            value={flightsDirection}
            onChange={e=>{const d=e.target.value;setFlightsDirection(d);fetchFlights(d);}}
            aria-label="Departures or arrivals"
          >
            <option value="departures">Departures</option>
            <option value="arrivals">Arrivals</option>
          </select>
          <button
            className="dayClear"
            onClick={()=>fetchFlights(flightsDirection)}
            aria-label="Refresh flight status"
            disabled={flightsLoading}
          >
            <RefreshCw size={14} className={flightsLoading?"spin":""}/>
          </button>
        </div>
      </div>

      <div className="flightsScopeToggle">
        {["all","domestic","international"].map(s=>
          <button
            key={s}
            className={flightsScope===s?"on":""}
            onClick={()=>setFlightsScope(s)}
          >{s==="all"?"All":s==="domestic"?"Domestic":"International"}</button>
        )}
      </div>

      {flightsError&&
        <div className="emptySearch">
          <AlertTriangle size={25}/>
          <b>Couldn't load flights</b>
          <span>{flightsError}</span>
        </div>}

      {!flightsError&&
        <section className="panel searchResults">
          {flightsLoading&&!flights
            ? <div className="emptySearch"><Plane size={25}/><b>Loading flights…</b></div>
            : visibleFlights.length
              ? <div className="flightsList">
                  {visibleFlights.map(f=>
                    <div key={f.flightNumber} className="flightRow">
                      <div className="flightMain">
                        <b>{f.flightNumber}</b>
                        <span>{flightsDirection==="departures"?`to ${f.route}`:`from ${f.route}`}</span>
                      </div>
                      <div className="flightTimes">
                        <span>{fmtTime(f.scheduledTime)}</span>
                        {f.estimatedTime!==f.scheduledTime&&
                          <small>est. {fmtTime(f.estimatedTime)}</small>}
                      </div>
                      {f.gate&&<div className="flightGate">Gate {f.gate}</div>}
                      <div className={`flightStatus status-${f.status.toLowerCase().replace(/\s+/g,"-")}`}>{f.status}</div>
                    </div>
                  )}
                </div>
              : <div className="emptySearch">
                  <Plane size={25}/>
                  <b>No flights found</b>
                  <span>No {flightsScope==="all"?"":flightsScope+" "}{flightsDirection} in the next {FLIGHT_WINDOW_HOURS_FORWARD} hours.</span>
                </div>}
        </section>}

      {flightsUpdatedAt&&
        <small className="flightsUpdatedAt">Updated {fmtTime(flightsUpdatedAt)}</small>}
    </main>}

    {tab==="more"&&<main>
      <section className="panel menu"><h3>LIVE FLIGHTS</h3>
        <button onClick={()=>setTab("flights")}><Plane/><span><b>AKL · Air New Zealand status</b><small>Live departures &amp; arrivals</small></span></button>
      </section>
      <section className="panel menu"><h3>IMPORT</h3>
        <button onClick={()=>fileRef.current?.click()}><Camera/><span><b>Upload roster photo</b><small>Reads the name column first, then the selected employee row</small></span></button>
      </section>
      <section className="panel menu"><h3>EXPORT</h3>
        <button onClick={()=>exportRosterPhoto(mine)}><Camera/><span><b>Export 14-Day Roster as JPEG</b><small>Name, Date, RT, OT & Hours</small></span></button>
      </section>

      <section className="panel">
        <div className="sectionTitle"><b>HOURLY RATE</b></div>
        <div className="rateCard">
          <div className="rateRow">
            <span>Hourly Rate</span>
            <div className="rateValue">
              <small>$</small>
              <input type="number" step="0.01" min="0" value={payRate} onChange={ev=>setPayRate(+ev.target.value||0)} aria-label="Hourly rate"/>
            </div>
          </div>
          <div className="rateRow">
            <span>OT hours at tier 1</span>
            <div className="rateValue">
              <input type="number" step="0.5" min="0" value={otTier1Hours} onChange={ev=>setOtTier1Hours(+ev.target.value||0)} aria-label="Overtime tier 1 hours"/>
              <small>hrs</small>
            </div>
          </div>
          <div className="rateRow">
            <span>Tier 1 rate (first {otTier1Hours}h OT)</span>
            <div className="rateValue">
              <input type="number" step="0.1" min="1" value={otTier1Mult} onChange={ev=>setOtTier1Mult(+ev.target.value||1.5)} aria-label="Overtime tier 1 multiplier"/>
              <small>×</small>
            </div>
          </div>
          <div className="rateRow">
            <span>Tier 2 rate (remaining OT)</span>
            <div className="rateValue">
              <input type="number" step="0.1" min="1" value={otTier2Mult} onChange={ev=>setOtTier2Mult(+ev.target.value||2.0)} aria-label="Overtime tier 2 multiplier"/>
              <small>×</small>
            </div>
          </div>
          <div className="rateRow rateRowTotal">
            <span>Total Pay</span>
            <b>${totalPayForRows(mine,payRate,otTier1Hours,otTier1Mult,otTier2Mult).toFixed(2)}</b>
          </div>
        </div>
        <p className="rateNote">Matches a typical payslip: OT-tagged shift hours are paid at Tier 1 up to the threshold, then Tier 2 beyond it — combined across a day's AM and PM shifts, not reset per shift.</p>
      </section>

      {(()=>{
        const totalPay=totalPayForRows(mine,payRate,otTier1Hours,otTier1Mult,otTier2Mult);
        const tax=periodNzPaye(totalPay,payFrequency);
        const unionFee=totalPay*(unionPct/100);
        const kiwiSaver=totalPay*(kiwiSaverPct/100);
        const totalDeducted=tax+unionFee+kiwiSaver;
        const netPay=totalPay-totalDeducted;
        return <section className="panel">
          <div className="sectionTitle"><b>DEDUCTIONS</b></div>
          <div className="rateCard">
            <div className="rateRow rateRowDeduction">
              <span>Tax (NZ PAYE + ACC)</span>
              <div className="rateValue">
                <select value={payFrequency} onChange={ev=>setPayFrequency(ev.target.value)} aria-label="Pay frequency">
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <b className="rateDeductionAmount">${tax.toFixed(2)}</b>
            </div>
            <div className="rateRow rateRowDeduction">
              <span>Union Fee</span>
              <div className="rateValue">
                <input type="number" step="0.01" min="0" value={unionPct} onChange={ev=>setUnionPct(+ev.target.value||0)} aria-label="Union fee percentage"/>
                <small>%</small>
              </div>
              <b className="rateDeductionAmount">${unionFee.toFixed(2)}</b>
            </div>
            <div className="rateRow rateRowDeduction">
              <span>KiwiSaver</span>
              <div className="rateValue">
                <input type="number" step="0.01" min="0" value={kiwiSaverPct} onChange={ev=>setKiwiSaverPct(+ev.target.value||0)} aria-label="KiwiSaver percentage"/>
                <small>%</small>
              </div>
              <b className="rateDeductionAmount">${kiwiSaver.toFixed(2)}</b>
            </div>
            <div className="rateRow rateRowTotal">
              <span>Total Deducted</span>
              <b>${totalDeducted.toFixed(2)}</b>
            </div>
            <div className="rateRow rateRowNet">
              <span>Net Pay</span>
              <b>${netPay.toFixed(2)}</b>
            </div>
          </div>
          <p className="rateNote">Tax uses the real NZ IRD progressive brackets (10.5%/17.5%/30%/33%/39%) plus the ACC earner's levy, annualized by pay frequency — this is the standard IRD method, so it should closely match your payslip's PAYE, though exact figures can vary slightly by tax code or payroll rounding. Net Pay = Total Pay − (Tax + Union Fee + KiwiSaver).</p>
        </section>;
      })()}

      <section className="panel menu"><h3>MY PROFILE</h3>
        <label className="setting" style={{flexDirection:"column",alignItems:"stretch",gap:6}}>
          Which name on the roster is you?
          <select value={myName} onChange={ev=>setMyNameOverride(ev.target.value)}>
            {names.length===0&&<option value="">No roster imported yet</option>}
            {names.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <p className="rateNote" style={{padding:"0 13px 13px"}}>"My Roster" and evening shift reminders are based on this. Get it right before enabling reminders below, or you'll be notified about someone else's shift.</p>
      </section>

      <section className="panel menu"><h3>NOTIFICATIONS</h3>
        <p className="rateNote" style={{padding:"0 13px 9px",fontWeight:700,color:
          subscriptionStatus==="active"?"#75d3a0":subscriptionStatus==="checking"?"#87909a":"#ff9f43"
        }}>
          {subscriptionStatus==="checking"&&"Checking reminder status for this device…"}
          {subscriptionStatus==="active"&&"✓ Reminders are ON for this device."}
          {subscriptionStatus==="inactive"&&"Reminders are OFF on this device — tap the button below to turn them on."}
          {subscriptionStatus==="unsupported"&&"This browser doesn't support push notifications."}
        </p>
        <label className="setting" style={{flexDirection:"column",alignItems:"stretch",gap:6}}>
          Notification time
          <Time24Wheel
            value={`${String(notifyHour).padStart(2,"0")}:${String(notifyMinute).padStart(2,"0")}`}
            onChange={v=>{const [h,m]=v.split(":");setNotifyHour(+h);setNotifyMinute(+m)}}
            ariaLabel="Evening reminder time"
          />
        </label>
        <button onClick={enableEveningReminders}><Clock3/><span><b>Enable Evening Reminders</b><small>Get a notification at {String(notifyHour).padStart(2,"0")}:{String(notifyMinute).padStart(2,"0")} NZT with tomorrow's shift</small></span></button>
        <p className="rateNote" style={{padding:"0 13px"}}>If reminders are already ON for this device, changing the time above saves automatically — no need to tap the button again.</p>
        {reminderStatus&&<p className="rateNote" style={{padding:"0 13px 13px"}}>{reminderStatus}</p>}
      </section>

      <section className="panel menu"><h3>SETTINGS</h3>
        <label className="setting">Weekly overtime threshold<input type="number" value={threshold} onChange={e=>setThreshold(+e.target.value||38)}/></label>
        <button className="danger" onClick={()=>{if(confirm("Delete all roster data?"))setEntries([])}}><Trash2/><span><b>Reset All Data</b><small>Delete all roster data</small></span></button></section>
    </main>}

    <input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>{upload(e.target.files);e.target.value=""}}/>

    {error&&<div className="toast"><AlertTriangle size={16}/>{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}

    {processing&&<div className="modalWrap"><div className="modal compact">
      <div className="spinner"/><h3>{status||"Reading roster…"}</h3><p>{progress}%</p>
      <small>{table?"Reading only the employee you selected. A slow OCR pass will time out automatically.":"Reading the left-side staff name column first."}</small>
    </div></div>}

    {table&&!processing&&<div className="modalWrap"><div className="modal autoTableModal">
      <div className="modalHead"><div><h2>Roster staff detected</h2><p>Select an employee and VV Roster shows the original cropped roster cell for every day exactly as it appears in the uploaded roster.</p></div><button className="ghost" onClick={()=>{setTable(null);setPreview(null);setReview(null)}}><X/></button></div>

      <div className="autoLayout">
        <div className="autoPreview"><img src={preview}/><div className="detectedBadge"><Users size={14}/>{table.staff.length} staff • {table.tables?.length||1} tables{table.staff.some(s=>s.nameUncertain)?` • ${table.staff.filter(s=>s.nameUncertain).length} need review`:""}</div></div>
        <div className="autoControls">
          <label>Employee
            <select value={selectedStaff} onChange={e=>{if(e.target.value)selectStaff(e.target.value)}}>
              <option value="">Select employee…</option>
              {table.staff.map(s=><option key={s.id} value={s.id}>{s.nameUncertain?"⚠ ":""}{s.name}{table.tables?.length>1?` — Table ${s.tableIndex+1}`:""}</option>)}
            </select>
          </label>

          {table.staff.some(s=>s.nameUncertain)&&<details className="staffNameFix" open>
            <summary>Fix employee names ({table.staff.filter(s=>s.nameUncertain).length} flagged)</summary>
            <div className="staffNameFixList">
              {table.staff.map(s=>(
                <div className={"staffNameFixRow"+(s.nameUncertain?" uncertain":"")} key={s.id}>
                  {s.nameUncertain&&<AlertTriangle size={14}/>}
                  <div style={{flex:1}}>
                    <input
                      value={s.name}
                      placeholder="Employee name"
                      onChange={e=>updateStaffName(s.id,e.target.value)}
                    />
                    {s.debugError&&<small style={{color:"#ff7777",display:"block",marginTop:3}}>Error: {s.debugError}</small>}
                  </div>
                </div>
              ))}
            </div>
          </details>}

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
  if(e?.amShift!==undefined || e?.pmShift!==undefined){
    const am=airport24HourDuration(e?.amShift ?? "0000-0000");
    const pm=airport24HourDuration(e?.pmShift ?? "0000-0000");
    return (am.valid?am.hours:0) + (pm.valid?pm.hours:0);
  }

  if(e?.editableValue!==undefined && e?.editableValue!==null){
    const edited=airport24HourDuration(e.editableValue);
    return edited.valid ? edited.hours : 0;
  }

  const candidates=[
    e?.canonicalValue,
    e?.display,
    e?.rawCellText,
    e?.time
  ].filter(Boolean);

  for(const value of candidates){
    const airport=airport24HourDuration(value);
    if(airport.valid) return airport.hours;
  }

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
  let total=0;

  const am=airport24HourDuration(e?.amShift ?? "0000-0000");
  const pm=airport24HourDuration(e?.pmShift ?? "0000-0000");

  if((e?.amType ?? "RT")==="OT" && am.valid) total+=am.hours;
  if((e?.pmType ?? "RT")==="OT" && pm.valid) total+=pm.hours;

  return total;
}

function entryRosterText(e){
  if(e?.amShift!==undefined || e?.pmShift!==undefined){
    const am=e?.amShift ?? "0000-0000";
    const pm=e?.pmShift ?? "0000-0000";
    return `AM ${am} • PM ${pm}`;
  }
  if(e.editableValue!==undefined && e.editableValue!==null)return e.editableValue;
  if(e.canonicalValue)return e.canonicalValue;
  if(e.display)return e.display;
  if(e.code==="RDO")return "RDO";
  if(e.time)return `${e.time}${e.code==="TRNG"?" TRNG":""}`;
  return e.code||"";
}
// Applies the tier1/tier2 split to a chunk of OT hours, given how many OT
// hours already happened earlier in the SAME day — so a day with 2h OT in
// the AM and 2h OT in the PM sees 3h at tier1 and 1h at tier2 (combined),
// not 2h+2h both mistakenly landing entirely inside tier1.
function tieredOtPay(hoursAlreadyOtToday,hoursThisShift,payRate,tier1Hours,tier1Mult,tier2Mult){
  const h=hoursThisShift||0;
  const tier1Remaining=Math.max(tier1Hours-hoursAlreadyOtToday,0);
  const atTier1=Math.min(h,tier1Remaining);
  const atTier2=h-atTier1;
  return atTier1*payRate*tier1Mult + atTier2*payRate*tier2Mult;
}

// Computes AM and PM pay for one day together (not independently), so OT
// tiering correctly accumulates across both shifts of that day.
function dayShiftPays(e,payRate,tier1Hours,tier1Mult,tier2Mult){
  const am=e.amShift ?? "0000-0000";
  const pm=e.pmShift ?? "0000-0000";
  const amParsed=airport24HourDuration(am);
  const pmParsed=airport24HourDuration(pm);
  const amHours=amParsed.valid?amParsed.hours:0;
  const pmHours=pmParsed.valid?pmParsed.hours:0;
  const amType=e.amType??"RT";
  const pmType=e.pmType??"RT";

  let otSoFar=0,amPay,pmPay;

  if(amType==="OT"){
    amPay=tieredOtPay(otSoFar,amHours,payRate,tier1Hours,tier1Mult,tier2Mult);
    otSoFar+=amHours;
  }else{
    amPay=amHours*payRate;
  }

  if(pmType==="OT"){
    pmPay=tieredOtPay(otSoFar,pmHours,payRate,tier1Hours,tier1Mult,tier2Mult);
    otSoFar+=pmHours;
  }else{
    pmPay=pmHours*payRate;
  }

  return {amHours,pmHours,amPay,pmPay,amType,pmType};
}

// Sums Pay across a set of entries the same way the Roster table computes
// it per row, for the Settings "Total Pay" summary.
// NZ IRD resident income tax brackets, 2025–26 and 2026–27 tax years
// (thresholds set 31 July 2024, unchanged since). Source: IRD tax rates for
// individuals. Verify against ird.govt.nz if this is used in a later tax year.
const NZ_TAX_BRACKETS=[
  {upTo:15600,rate:0.105},
  {upTo:53500,rate:0.175},
  {upTo:78100,rate:0.30},
  {upTo:180000,rate:0.33},
  {upTo:Infinity,rate:0.39}
];
// ACC earner's levy, 2025–26 year: 1.67% of earnings, capped at $152,790.
const ACC_LEVY_RATE=0.0167;
const ACC_LEVY_CAP=152790;

const PAY_PERIODS_PER_YEAR={weekly:52,fortnightly:26,monthly:12};

function annualNzPaye(annualIncome){
  let tax=0,lower=0;
  for(const b of NZ_TAX_BRACKETS){
    if(annualIncome<=lower)break;
    const taxableInBracket=Math.min(annualIncome,b.upTo)-lower;
    tax+=taxableInBracket*b.rate;
    lower=b.upTo;
  }
  return tax;
}

// Standard IRD method for PAYE on regular salary/wages: annualize this
// period's gross pay by pay frequency, apply the progressive brackets to
// the annualized figure, then divide back down to one period. Adds the ACC
// earner's levy (also capped annually) since it's deducted alongside PAYE.
// This won't be cent-for-cent identical to every payroll vendor's exact
// rounding or tax-code handling, but matches the standard IRD calculation.
function periodNzPaye(periodGross,payFrequency){
  const periodsPerYear=PAY_PERIODS_PER_YEAR[payFrequency]||26;
  const annualIncome=periodGross*periodsPerYear;
  const annualTax=annualNzPaye(annualIncome);
  const annualAcc=Math.min(annualIncome,ACC_LEVY_CAP)*ACC_LEVY_RATE;
  return (annualTax+annualAcc)/periodsPerYear;
}


function totalPayForRows(rows,payRate,tier1Hours,tier1Mult,tier2Mult){
  let total=0;
  for(const e of rows){
    const isDualSource=e.amShift!==undefined || e.pmShift!==undefined;
    if(isDualSource){
      const {amPay,pmPay}=dayShiftPays(e,payRate,tier1Hours,tier1Mult,tier2Mult);
      total+=amPay+pmPay;
    }else{
      total+=effectiveEntryHours(e)*payRate;
    }
  }
  return total;
}

function Roster({rows,onEdit,payRate=0,otTier1Hours=3,otTier1Mult=1.5,otTier2Mult=2.0}){
  if(!rows.length)return <div className="empty">No shifts found.</div>;

  // Every row in the table is one Start–End period (AM or PM), matching the
  // requested Day/Start/End/Time/Pay layout. RDO or unparseable entries fall
  // back to a single flat row, same as before.
  const shiftRows=[];
  for(const e of rows){
    const isDualSource=e.amShift!==undefined || e.pmShift!==undefined;

    if(onEdit){
      // Editable rows always expose AM + PM, even if currently blank/RDO,
      // so the admin can fill in a shift that wasn't there before.
      const am=e.amShift ?? "0000-0000";
      const pm=e.pmShift ?? "0000-0000";
      const {amHours,pmHours,amPay,pmPay}=dayShiftPays(e,payRate,otTier1Hours,otTier1Mult,otTier2Mult);
      shiftRows.push({e,period:"am",value:am,type:e.amType??"RT",hours:amHours,pay:amPay});
      shiftRows.push({e,period:"pm",value:pm,type:e.pmType??"RT",hours:pmHours,pay:pmPay});
      continue;
    }

    if(isDualSource){
      const am=e.amShift ?? "0000-0000";
      const pm=e.pmShift ?? "0000-0000";
      const amParsed=airport24HourDuration(am);
      const pmParsed=airport24HourDuration(pm);
      const amHas=amParsed.valid && amParsed.hours>0;
      const pmHas=pmParsed.valid && pmParsed.hours>0;
      if(!amHas && !pmHas){
        shiftRows.push({e,period:null,sourceCell:e.sourceCell,label:entryRosterText(e),hours:0,pay:0});
      }else{
        const {amHours,pmHours,amPay,pmPay}=dayShiftPays(e,payRate,otTier1Hours,otTier1Mult,otTier2Mult);
        if(amHas)shiftRows.push({e,period:"am",value:am,type:e.amType??"RT",hours:amHours,pay:amPay});
        if(pmHas)shiftRows.push({e,period:"pm",value:pm,type:e.pmType??"RT",hours:pmHours,pay:pmPay});
      }
      continue;
    }

    {
      const hours=effectiveEntryHours(e);
      shiftRows.push({e,period:null,sourceCell:e.sourceCell,label:entryRosterText(e),hours,pay:hours*payRate});
    }
  }

  let totalHours=0,totalPay=0;
  for(const r of shiftRows){
    totalHours+=r.hours||0;
    totalPay+=r.pay||0;
  }

  return <div className="rosterTable">
    <div className="rosterTableHead">
      <span>Day</span><span>Start</span><span>End</span><span>Time</span><span>Pay</span>
    </div>

    {shiftRows.map((r,i)=>{
      const {e,period}=r;
      const dayLabel=fmt(e.date,{weekday:"short",day:"numeric",month:"short"});
      const isNewDay=i===0||shiftRows[i-1].e.id!==e.id;
      const dayClass=isNewDay?" rosterTableNewDay":"";

      if(period===null){
        return <div className={"rosterTableRow rosterTableRowFlat"+dayClass} key={e.id+"-flat-"+i}>
          <div className="rosterTableDay"><small>{dayLabel}</small><span>{e.name}</span></div>
          <div className="rosterTableFlatValue">
            {r.sourceCell
              ? <img src={r.sourceCell} alt="Original roster cell" className="rosterTableThumb"/>
              : <b>{r.label}</b>}
          </div>
          <div className="rosterTableTime">{(r.hours||0).toFixed(1)}h</div>
          <div className="rosterTablePay">${(r.pay||0).toFixed(2)}</div>
        </div>;
      }

      const periodLabel=period.toUpperCase();
      const {start,end}=splitAirportRange(r.value);
      const pay=r.pay||0;

      return <div className={"rosterTableRow"+dayClass} key={e.id+"-"+period}>
        <div className="rosterTableDay">
          <small>{dayLabel}</small>
          <span>{e.name} · {periodLabel}</span>
          {onEdit
            ? <select
                className={`shiftTypeSelect rosterTableType ${r.type==="OT"?"isOT":""}`}
                value={r.type}
                onChange={ev=>onEdit(e.id,period,ev.target.value,"type")}
                aria-label={`${periodLabel} shift type`}
              >
                <option value="RT">RT</option>
                <option value="OT">OT</option>
              </select>
            : <em className="rosterTableTypeReadonly">{r.type}</em>}
        </div>
        <div className="rosterTableStart">
          {onEdit
            ? <Time24Wheel value={start} onChange={v=>onEdit(e.id,period,joinAirportRange(v,end))} ariaLabel={`${periodLabel} start time`}/>
            : <span>{start||"--:--"}</span>}
        </div>
        <div className="rosterTableEnd">
          {onEdit
            ? <Time24Wheel value={end} onChange={v=>onEdit(e.id,period,joinAirportRange(start,v))} ariaLabel={`${periodLabel} end time`}/>
            : <span>{end||"--:--"}</span>}
        </div>
        <div className="rosterTableTime">{r.hours.toFixed(1)}h</div>
        <div className="rosterTablePay">${pay.toFixed(2)}</div>
      </div>;
    })}

    <div className="rosterTableTotals">
      <span>Total Time</span><b>{totalHours.toFixed(1)}h</b>
      <span>Total Pay</span><b>${totalPay.toFixed(2)}</b>
    </div>
  </div>;
}
function MonthHead({month,setMonth}){const move=n=>{const d=new Date(`${month}T12:00:00`);d.setMonth(d.getMonth()+n);setMonth(d.toISOString().slice(0,7)+"-01")};return <div className="monthHead"><button className="ghost" onClick={()=>move(-1)}><ChevronLeft/></button><h2>{new Date(`${month}T12:00:00`).toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2><button className="ghost" onClick={()=>move(1)}><ChevronRight/></button></div>}
function CalendarGrid({month,rows,selected,onSelect}){const d=new Date(`${month}T12:00:00`),first=new Date(d.getFullYear(),d.getMonth(),1),days=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(),lead=(first.getDay()+6)%7;const cells=[...Array(lead).fill(null),...Array.from({length:days},(_,i)=>i+1)];while(cells.length%7)cells.push(null);return <div className="cal">{["MON","TUE","WED","THU","FRI","SAT","SUN"].map(x=><div className="dow" key={x}>{x}</div>)}{cells.map((n,i)=>{if(!n)return <div key={i}/>;const iso=new Date(d.getFullYear(),d.getMonth(),n,12).toISOString().slice(0,10),r=rows.find(x=>x.date===iso);return <button key={i} className={selected===iso?"selected":""} onClick={()=>onSelect(iso)}><b>{n}</b>{r&&<span className={r.code==="RDO"?"off":""}/>}</button>})}</div>}

function exportRosterPhoto(rows=[]){
  try{
    const roster=[...rows]
      .sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")))
      .slice(0,14);

    if(!roster.length){
      alert("No roster data to export.");
      return;
    }

    const W=1400;
    const margin=70;
    const titleH=150;
    const headH=72;
    const rowH=92;
    const summaryH=130;
    const H=margin*2+titleH+headH+(rowH*roster.length)+summaryH;

    const canvas=document.createElement("canvas");
    const scale=2;
    canvas.width=W*scale;
    canvas.height=H*scale;

    const ctx=canvas.getContext("2d");
    if(!ctx){
      alert("Unable to create JPEG on this browser.");
      return;
    }
    ctx.scale(scale,scale);

    const bg="#f2eee4";
    const ink="#171717";
    const muted="#625f58";
    const grid="#69645b";
    const gold="#a97818";
    const rtFill="#eef4ec";
    const otFill="#fbede3";

    ctx.fillStyle=bg;
    ctx.fillRect(0,0,W,H);

    const roundedRect=(x,y,w,h,r,fill,stroke)=>{
      ctx.beginPath();
      if(ctx.roundRect){
        ctx.roundRect(x,y,w,h,r);
      }else{
        ctx.rect(x,y,w,h);
      }
      if(fill){ctx.fillStyle=fill;ctx.fill();}
      if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
    };

    const drawText=(text,x,y,size=28,weight=500,align="left",color=ink)=>{
      ctx.fillStyle=color;
      ctx.font=`${weight} ${size}px Arial, Helvetica, sans-serif`;
      ctx.textAlign=align;
      ctx.textBaseline="middle";
      ctx.fillText(String(text??""),x,y);
    };

    const dateText=(iso)=>{
      if(!iso)return "";
      const d=new Date(`${iso}T12:00:00`);
      return new Intl.DateTimeFormat("en-NZ",{
        day:"2-digit",month:"2-digit",year:"numeric"
      }).format(d);
    };

    const shortDate=(iso)=>{
      if(!iso)return "";
      const d=new Date(`${iso}T12:00:00`);
      return new Intl.DateTimeFormat("en-NZ",{
        day:"2-digit",month:"short"
      }).format(d).toUpperCase();
    };

    const shiftForType=(e,type)=>{
      const parts=[];
      const am=e?.amShift ?? "0000-0000";
      const pm=e?.pmShift ?? "0000-0000";
      const amP=airport24HourDuration(am);
      const pmP=airport24HourDuration(pm);

      if(amP.valid && amP.hours>0 && (e?.amType ?? "RT")===type){
        parts.push(`AM ${am}`);
      }
      if(pmP.valid && pmP.hours>0 && (e?.pmType ?? "RT")===type){
        parts.push(`PM ${pm}`);
      }

      if(!parts.length && type==="RT"){
        const raw=String(
          e?.originalValue||
          e?.canonicalValue||
          e?.rawCellText||
          e?.display||
          e?.code||
          ""
        ).toUpperCase();

        if(raw.includes("RDO")) return "RDO";
      }
      return parts.length ? parts.join(" / ") : "—";
    };

    const first=roster[0]?.date;
    const last=roster[roster.length-1]?.date;
    const employee=roster[0]?.name || "Employee";

    roundedRect(35,35,W-70,H-70,22,"#f6f2e9","#c8c0b2");

    drawText("VV DUTY ROSTER",W/2,85,42,700,"center",ink);
    drawText(
      `${shortDate(first)} – ${shortDate(last)}  •  14-DAY ROSTER`,
      W/2,130,20,600,"center",gold
    );

    const x0=margin;
    const y0=margin+titleH;
    const tableW=W-(margin*2);

    const cols=[
      {label:"NAME",w:290},
      {label:"DATE",w:190},
      {label:"RT",w:350},
      {label:"OT",w:350},
      {label:"HOURS",w:140},
    ];

    const rawSum=cols.reduce((s,c)=>s+c.w,0);
    const factor=tableW/rawSum;
    cols.forEach(c=>c.w*=factor);

    roundedRect(
      x0,y0,tableW,
      headH+(rowH*roster.length),
      10,"#faf7ef",grid
    );

    ctx.fillStyle="#e7e0d3";
    ctx.fillRect(x0,y0,tableW,headH);

    let cx=x0;
    cols.forEach((c,i)=>{
      if(i>0){
        ctx.strokeStyle=grid;
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(cx,y0);
        ctx.lineTo(cx,y0+headH+(rowH*roster.length));
        ctx.stroke();
      }
      drawText(c.label,cx+c.w/2,y0+headH/2,22,800,"center",ink);
      cx+=c.w;
    });

    let totalHours=0;
    let totalOT=0;

    roster.forEach((e,idx)=>{
      const y=y0+headH+(idx*rowH);

      if(idx%2===1){
        ctx.fillStyle="#f3eee5";
        ctx.fillRect(x0,y,tableW,rowH);
      }

      ctx.strokeStyle="#9a9388";
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(x0,y);
      ctx.lineTo(x0+tableW,y);
      ctx.stroke();

      const hours=effectiveEntryHours(e);
      const ot=entryOvertimeHours(e);

      totalHours+=hours;
      totalOT+=ot;

      const values=[
        e.name||employee,
        dateText(e.date),
        shiftForType(e,"RT"),
        shiftForType(e,"OT"),
        hours.toFixed(2),
      ];

      let x=x0;

      values.forEach((val,i)=>{
        const c=cols[i];
        const center=x+c.w/2;

        if(i===2 && val!=="—" && val!=="RDO"){
          roundedRect(x+10,y+14,c.w-20,rowH-28,8,rtFill,null);
        }
        if(i===3 && val!=="—"){
          roundedRect(x+10,y+14,c.w-20,rowH-28,8,otFill,null);
        }

        if((i===2 || i===3) && String(val).includes(" / ")){
          const pieces=String(val).split(" / ");
          drawText(pieces[0],center,y+32,18,700,"center",i===3?"#9b4a1d":ink);
          drawText(pieces[1],center,y+61,18,700,"center",i===3?"#9b4a1d":ink);
        }else{
          drawText(
            val,center,y+rowH/2,
            i===4?22:19,
            i===4?800:600,
            "center",
            i===3 && val!=="—"?"#9b4a1d":ink
          );
        }
        x+=c.w;
      });
    });

    const sy=y0+headH+(rowH*roster.length)+34;
    const boxGap=18;
    const boxW=(tableW-boxGap*2)/3;

    [
      ["EMPLOYEE",employee],
      ["TOTAL HOURS",totalHours.toFixed(2)],
      ["OVERTIME",totalOT.toFixed(2)]
    ].forEach(([label,value],i)=>{
      const bx=x0+i*(boxW+boxGap);

      roundedRect(
        bx,sy,boxW,82,10,
        i===2?"#fbede3":"#e9e4d9",
        "#bdb5a8"
      );

      drawText(label,bx+18,sy+24,14,800,"left",muted);
      drawText(
        value,bx+18,sy+56,
        i===0?21:28,800,"left",
        i===2?"#9b4a1d":ink
      );
    });

    drawText(
      "Generated by VV Duty Roster",
      W/2,H-55,14,500,"center",muted
    );

    // Safari-safe: create JPEG immediately inside the click event.
    const jpegURL=canvas.toDataURL("image/jpeg",0.94);

    const safeName=employee
      .replace(/[^a-z0-9]+/gi,"-")
      .replace(/^-|-$/g,"")
      .toLowerCase() || "employee";

    const filename=`vv-roster-${safeName}-${first||"14-days"}-${last||""}.jpg`;

    // First try a normal direct download.
    const a=document.createElement("a");
    a.href=jpegURL;
    a.download=filename;
    a.style.display="none";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Safari/iOS fallback: if download attribute is ignored,
    // open the JPEG directly so user can Save Image / Share.
    const isSafari=/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);

    if(isSafari || isIOS){
      setTimeout(()=>{
        const w=window.open();
        if(w){
          w.document.write(
            `<html><head><title>${filename}</title></head>
             <body style="margin:0;background:#111;text-align:center">
             <img src="${jpegURL}" style="max-width:100%;height:auto" />
             </body></html>`
          );
          w.document.close();
        }
      },150);
    }

  }catch(err){
    console.error("JPEG roster export failed",err);
    alert("JPEG export failed: "+(err?.message||"Unknown error"));
  }
}

function exportCSV(rows){
  const clean=rows.map(({sourceCell,...e})=>e);
  const csv=Papa.unparse(clean);
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="vv-roster.csv";
  a.click();
}

createRoot(document.getElementById("root")).render(<AccessGate><App/></AccessGate>);
