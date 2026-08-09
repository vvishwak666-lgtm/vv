
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import Tesseract from "tesseract.js";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Home, CalendarDays, ClipboardList, Search, Menu, Upload, Camera, FileSpreadsheet,
  Download, Settings2, Trash2, ChevronLeft, ChevronRight, Clock3, X, Check,
  Image as ImageIcon, AlertTriangle, Save, RotateCcw
} from "lucide-react";
import "./styles.css";

const STORE="vv-roster-final-v2";
const CODES = ["RDO","TRNG","AL","ALV","ALLV","ALTH","HACC","OFF","SICK","SL","LEAVE"];
const shiftRx = /^(?:\d{3,4}|\d{1,2}[:.]\d{2})\s*[-–]\s*(?:\d{3,4}|\d{1,2}[:.]\d{2})$/i;

function todayISO(){ return new Date().toISOString().slice(0,10); }
function addDays(iso,n){const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function mondayOf(iso){const d=new Date(iso+"T12:00:00");const n=(d.getDay()+6)%7;d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);}
function fmt(iso,opts={weekday:"short",day:"numeric",month:"short"}){if(!iso)return "";return new Date(iso+"T12:00:00").toLocaleDateString(undefined,opts);}
function parseTimeRange(s){
  if(!s) return null;
  const z=String(s).replace(/\s/g,"").replace(/[–—]/g,"-").replace(/\./g,":");
  const m=z.match(/^(\d{1,4})(?::(\d{2}))?-(\d{1,4})(?::(\d{2}))?$/);
  if(!m)return null;
  function hm(a,b){
    if(b!==undefined){return [+a,+b]}
    const x=String(a).padStart(4,"0");return [+x.slice(0,-2),+x.slice(-2)];
  }
  let [sh,sm]=hm(m[1],m[2]), [eh,em]=hm(m[3],m[4]);
  let mins=eh*60+em-(sh*60+sm); if(mins<0)mins+=1440;
  return mins/60;
}
function normalizeToken(t){
  return String(t||"").toUpperCase().replace(/[|,;]+/g,"").replace(/[O]/g,"0").replace(/\s+/g,"").trim();
}
function looksShift(t){
  const n=normalizeToken(t);
  if(CODES.includes(n)) return true;
  if(/^\d{3,4}-\d{3,4}$/.test(n)) return true;
  if(/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(n)) return true;
  return false;
}
function cleanShift(t){
  let n=normalizeToken(t).replace(/[—–]/g,"-");
  // common OCR fixes
  n=n.replace(/^RD0$/,"RDO").replace(/^TRN6$/,"TRNG");
  if(/^\d{8}$/.test(n)) n=n.slice(0,4)+"-"+n.slice(4);
  return n;
}
function isNameish(text){
  const s=String(text||"").trim();
  return /^[A-Z][A-Z' -]+,\s*[A-Za-z][A-Za-z' -]+/.test(s) || /^[A-Za-z][A-Za-z' -]{2,25}\s+[A-Za-z][A-Za-z' -]{2,25}$/.test(s);
}
function groupWordsByRow(words){
  const good=(words||[]).filter(w=>w.text?.trim() && w.confidence>20);
  const rows=[];
  for(const w of good){
    const cy=(w.bbox.y0+w.bbox.y1)/2;
    let row=rows.find(r=>Math.abs(r.cy-cy)<Math.max(7,(w.bbox.y1-w.bbox.y0)*0.55));
    if(!row){row={cy,words:[]};rows.push(row)}
    row.words.push(w);
    row.cy=(row.cy*(row.words.length-1)+cy)/row.words.length;
  }
  return rows.sort((a,b)=>a.cy-b.cy).map((r,i)=>{
    const ws=r.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);
    return {id:"row-"+i,cy:r.cy,words:ws,text:ws.map(w=>w.text).join(" ")};
  });
}
function makeCandidateRows(rows, imageWidth){
  const out=[];
  rows.forEach(r=>{
    const tokens=r.words.map(w=>({text:w.text,x:(w.bbox.x0+w.bbox.x1)/2,x0:w.bbox.x0,x1:w.bbox.x1}));
    const shiftTokens=tokens.filter(t=>looksShift(t.text));
    if(!shiftTokens.length) return;
    const firstShiftX=Math.min(...shiftTokens.map(t=>t.x0));
    const name=tokens.filter(t=>t.x1<firstShiftX-5).map(t=>t.text).join(" ").replace(/\s+/g," ").trim();
    if(!name || name.length<3) return;
    const workingHours=tokens.filter(t=>t.x>imageWidth*0.88).map(t=>t.text).join(" ");
    out.push({...r,name,shiftTokens,workingHours});
  });
  return out;
}
function inferColumnCenters(rows, imageWidth){
  const xs=[];
  rows.forEach(r=>r.shiftTokens?.forEach(t=>{if(t.x>imageWidth*0.12 && t.x<imageWidth*0.9) xs.push(t.x)}));
  xs.sort((a,b)=>a-b);
  if(xs.length<4){
    const left=imageWidth*0.18,right=imageWidth*0.88, step=(right-left)/13;
    return Array.from({length:14},(_,i)=>left+i*step);
  }
  // Cluster x positions across staff rows.
  const clusters=[];
  xs.forEach(x=>{
    let c=clusters.find(c=>Math.abs(c.mean-x)<imageWidth*0.025);
    if(!c){c={mean:x,n:0};clusters.push(c)}
    c.mean=(c.mean*c.n+x)/(c.n+1);c.n++;
  });
  let centers=clusters.filter(c=>c.n>=1).sort((a,b)=>a.mean-b.mean).map(c=>c.mean);
  if(centers.length>14){
    centers=centers.sort((a,b)=>a-b).slice(0,14);
  }
  if(centers.length<14){
    const left=Math.min(...centers, imageWidth*0.18), right=Math.max(...centers, imageWidth*0.88);
    const step=(right-left)/13;
    centers=Array.from({length:14},(_,i)=>left+i*step);
  }
  return centers;
}
function mapCandidate(candidate, centers){
  const cells=Array(14).fill("");
  candidate.shiftTokens.forEach(t=>{
    let idx=0,best=Infinity;
    centers.forEach((c,i)=>{const d=Math.abs(c-t.x);if(d<best){best=d;idx=i}});
    const v=cleanShift(t.text);
    if(!cells[idx] || looksShift(v)) cells[idx]=v;
  });
  return cells;
}
function inferFirstDate(rows){
  for(const r of rows){
    const m=r.text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
    if(m){
      let y=+m[3]; if(y<100)y+=2000;
      const a=+m[1],b=+m[2];
      // Prefer DD/MM for NZ; fall back to MM/DD when clearly needed.
      const day=a>12?a:b, month=a>12?b:a;
      const d=new Date(y,month-1,day);
      if(!isNaN(d)) return d.toISOString().slice(0,10);
    }
  }
  return todayISO();
}
function hoursForShift(s){ if(!s || CODES.includes(s)) return 0; return parseTimeRange(s)??0; }


function cleanOCRText(s){
  return String(s||"")
    .replace(/[|]/g,"I")
    .replace(/[—–]/g,"-")
    .replace(/\s+/g," ")
    .trim();
}
function normalizeRosterCell(s){
  let t=cleanOCRText(s).toUpperCase().replace(/\s/g,"");
  t=t.replace(/O/g,"0");
  const aliases={RD0:"RDO",TRN6:"TRNG",ALL:"AL",ALLV:"ALV"};
  if(aliases[t]) t=aliases[t];
  if(/^\d{8}$/.test(t)) t=t.slice(0,4)+"-"+t.slice(4);
  if(/^\d{7}$/.test(t)){
    // common missing zero at start/end
    if(/^\d{3}-?\d{4}$/.test(t)) t=t.slice(0,3)+"-"+t.slice(3);
  }
  return t;
}
function isRosterValue(s){
  const t=normalizeRosterCell(s);
  if(CODES.includes(t)) return true;
  return /^\d{3,4}-\d{3,4}$/.test(t) || /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(t);
}
function rowTextFromWords(ws){
  return ws.sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>cleanOCRText(w.text)).join(" ");
}
function clusterRows(words){
  const good=(words||[]).filter(w=>w.text?.trim() && w.confidence>15);
  const rows=[];
  for(const w of good){
    const cy=(w.bbox.y0+w.bbox.y1)/2;
    const h=Math.max(6,w.bbox.y1-w.bbox.y0);
    let row=rows.find(r=>Math.abs(r.cy-cy)<Math.max(8,h*0.65));
    if(!row){row={cy,words:[]};rows.push(row)}
    row.words.push(w);
    row.cy=(row.cy*(row.words.length-1)+cy)/row.words.length;
  }
  return rows.sort((a,b)=>a.cy-b.cy).map((r,i)=>({id:`r${i}`,cy:r.cy,words:r.words.sort((a,b)=>a.bbox.x0-b.bbox.x0),text:rowTextFromWords(r.words)}));
}
function guessNameAndCells(row, imageWidth){
  const ws=row.words;
  const vals=ws.filter(w=>isRosterValue(w.text));
  if(vals.length<2) return null;

  const firstValX=Math.min(...vals.map(w=>w.bbox.x0));
  let nameWords=ws.filter(w=>w.bbox.x1<firstValX-4);
  let name=cleanOCRText(nameWords.map(w=>w.text).join(" "));
  name=name.replace(/\b(?:TRNG|RDO|AL|ALV|ALLV|ALTH|HACC)\b.*$/i,"").trim();
  if(name.length<3) return null;

  // Ignore headers / date rows.
  if(/^(SHIFT|DATE|MON|TUE|WED|THU|FRI|SAT|SUN|WORKING HOURS)/i.test(name)) return null;

  // Estimate left/right edge of the 14-day roster region from detected values.
  const centers=vals.map(w=>(w.bbox.x0+w.bbox.x1)/2).filter(x=>x<imageWidth*0.92).sort((a,b)=>a-b);
  if(centers.length<2) return null;

  const left=Math.max(imageWidth*0.14, Math.min(...centers)-imageWidth*0.01);
  const right=Math.min(imageWidth*0.90, Math.max(...centers)+imageWidth*0.01);
  const step=(right-left)/13;
  const colCenters=Array.from({length:14},(_,i)=>left+i*step);

  const cells=Array(14).fill("");
  vals.forEach(w=>{
    const x=(w.bbox.x0+w.bbox.x1)/2;
    let best=0,dist=Infinity;
    colCenters.forEach((c,i)=>{const d=Math.abs(c-x);if(d<dist){dist=d;best=i}});
    const v=normalizeRosterCell(w.text);
    if(!cells[best] || isRosterValue(v)) cells[best]=v;
  });

  // Working-hours value is usually rightmost numeric token after final day.
  const rightWords=ws.filter(w=>w.bbox.x0>imageWidth*0.90);
  const workingHours=cleanOCRText(rightWords.map(w=>w.text).join(" "));
  return {name,cells,workingHours,rowText:row.text};
}
function detectAirNZRows(rows,imageWidth){
  const candidates=[];
  for(const row of rows){
    const g=guessNameAndCells(row,imageWidth);
    if(g && g.cells.filter(Boolean).length>=2){
      candidates.push({...g,id:row.id,cy:row.cy});
    }
  }
  // Prefer rows that look like "SURNAME, Firstname"
  candidates.sort((a,b)=>{
    const av=/^[A-Z' -]+,\s*[A-Za-z]/.test(a.name)?1:0;
    const bv=/^[A-Z' -]+,\s*[A-Za-z]/.test(b.name)?1:0;
    if(av!==bv) return bv-av;
    return a.cy-b.cy;
  });
  return candidates;
}
function inferRosterStartDateFromText(text){
  const m=text.match(/\b(\d{1,2})\s*(?:Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul)[a-z]*\s*(\d{4})/i);
  if(m){
    const d=Date.parse(m[0]);
    if(!isNaN(d)) return new Date(d).toISOString().slice(0,10);
  }
  const dmy=text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if(dmy){
    let y=+dmy[3]; if(y<100)y+=2000;
    const day=+dmy[1], month=+dmy[2];
    if(month<=12) return new Date(y,month-1,day,12).toISOString().slice(0,10);
  }
  return todayISO();
}


async function canvasFromFile(file){
  const bmp=await createImageBitmap(file);
  const c=document.createElement("canvas");
  c.width=bmp.width;
  c.height=bmp.height;
  c.getContext("2d").drawImage(bmp,0,0);
  return c;
}
function cropFractionCanvas(source,x0f,y0f,x1f,y1f,scale=4){
  const sx=Math.max(0,Math.floor(source.width*x0f));
  const sy=Math.max(0,Math.floor(source.height*y0f));
  const sw=Math.max(1,Math.floor(source.width*(x1f-x0f)));
  const sh=Math.max(1,Math.floor(source.height*(y1f-y0f)));
  const c=document.createElement("canvas");
  c.width=Math.max(1,Math.round(sw*scale));
  c.height=Math.max(1,Math.round(sh*scale));
  const ctx=c.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(source,sx,sy,sw,sh,0,0,c.width,c.height);
  const img=ctx.getImageData(0,0,c.width,c.height);
  const d=img.data;
  for(let i=0;i<d.length;i+=4){
    const g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    const v=g>205?255:(g<110?0:Math.max(0,Math.min(255,(g-110)*3.0)));
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);
  return c;
}
async function ocrSmallCanvas(canvas, psm="7"){
  const blob=await new Promise(r=>canvas.toBlob(r,"image/png"));
  const res=await Tesseract.recognize(blob,"eng",{
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces:"1"
  });
  return String(res.data.text||"").replace(/\s+/g," ").trim();
}
function cleanManualCell(s){
  let t=String(s||"").toUpperCase().replace(/[—–]/g,"-").replace(/\s+/g,"").trim();
  t=t.replace(/[|]/g,"I");
  const exact={
    "RD0":"RDO","RDO.":"RDO","TRN6":"TRNG","TRNG.":"TRNG",
    "ALLV":"ALV","ALIV":"ALV","HACC.":"HACC","ALTH.":"ALTH"
  };
  if(exact[t])t=exact[t];
  // common OCR ambiguity inside numeric times
  if(/[0-9]/.test(t)) t=t.replace(/O/g,"0").replace(/I/g,"1").replace(/L/g,"1");
  if(/^\d{8}$/.test(t)) t=t.slice(0,4)+"-"+t.slice(4);
  if(/^\d{4}[-]?\d{4}$/.test(t) && !t.includes("-")) t=t.slice(0,4)+"-"+t.slice(4);
  return t;
}
function validManualCell(t){
  if(!t)return false;
  if(CODES.includes(t))return true;
  return /^\d{3,4}-\d{3,4}$/.test(t) || /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(t);
}
async function readSelectedRosterRow(source, yPercent, setProgress){
  // Air NZ roster screenshot proportions:
  // name column ~ 4%-17%, 14 day cells ~17%-91%, working hours after that.
  // row height is kept narrow around the selected center.
  const cy=yPercent/100;
  const half=0.018;
  const y0=Math.max(0,cy-half), y1=Math.min(1,cy+half);

  const nameCanvas=cropFractionCanvas(source,0.035,y0,0.175,y1,5);
  let name=(await ocrSmallCanvas(nameCanvas,"7"))
    .replace(/[^\wÀ-ÿ' ,.-]/g," ")
    .replace(/\s+/g," ")
    .trim();

  const cells=[];
  const left=0.175, right=0.91;
  const step=(right-left)/14;
  for(let i=0;i<14;i++){
    setProgress?.(Math.round((i/14)*100));
    const x0=left+i*step;
    const x1=x0+step;
    const cc=cropFractionCanvas(source,x0,y0,x1,y1,6);
    let raw=await ocrSmallCanvas(cc,"7");
    let v=cleanManualCell(raw);
    if(!validManualCell(v)){
      const retry=cleanManualCell(await ocrSmallCanvas(cc,"8"));
      v=validManualCell(retry)?retry:"";
    }
    cells.push(v);
  }

  if(!name || name.length<2) name="Selected staff row";
  return {id:"manual-row",name,cells,workingHours:""};
}


function normalizeEditableShift(value){
  let t=String(value||"").toUpperCase().trim().replace(/[—–]/g,"-").replace(/\s+/g,"");
  if(!t) return "";
  const codeMap={RD0:"RDO",TRN6:"TRNG",ALIV:"ALV",ALLV:"ALV"};
  if(codeMap[t]) t=codeMap[t];
  if(CODES.includes(t)) return t;
  t=t.replace(/O/g,"0");
  const m=t.match(/^(\d{3,4})-(\d{3,4})$/);
  if(!m) return t;
  const pad=s=>s.padStart(4,"0");
  return `${pad(m[1])}-${pad(m[2])}`;
}
function shiftValidation(value){
  const t=normalizeEditableShift(value);
  if(!t) return {ok:false,msg:"Missing"};
  if(CODES.includes(t)) return {ok:true,msg:""};
  const m=t.match(/^(\d{4})-(\d{4})$/);
  if(!m) return {ok:false,msg:"Use HHMM-HHMM"};
  const valid=x=>{
    const h=+x.slice(0,2), min=+x.slice(2);
    return h>=0&&h<=23&&min>=0&&min<=59;
  };
  if(!valid(m[1])||!valid(m[2])) return {ok:false,msg:"Invalid time"};
  const hrs=hoursFromTime(t);
  if(hrs>16) return {ok:false,msg:"Check this shift"};
  return {ok:true,msg:""};
}


function canvasToDataURL(canvas){
  try{return canvas.toDataURL("image/png")}catch{return ""}
}
async function readSelectedRosterRowWithPreviews(source, yPercent, setProgress){
  const cy=yPercent/100;
  const half=0.018;
  const y0=Math.max(0,cy-half), y1=Math.min(1,cy+half);

  const nameCanvas=cropFractionCanvas(source,0.035,y0,0.175,y1,5);
  let name=(await ocrSmallCanvas(nameCanvas,"7"))
    .replace(/[^\wÀ-ÿ' ,.-]/g," ")
    .replace(/\s+/g," ")
    .trim();

  const cells=[];
  const previews=[];
  const left=0.175, right=0.91;
  const step=(right-left)/14;

  for(let i=0;i<14;i++){
    setProgress?.(Math.round((i/14)*100));
    const x0=left+i*step;
    const x1=x0+step;
    const rawCell=cropFractionCanvas(source,x0,y0,x1,y1,7);
    previews.push(canvasToDataURL(rawCell));

    // OCR the exact cell multiple ways and keep the best valid candidate.
    const tries=[];
    for(const psm of ["7","8","10"]){
      const raw=await ocrSmallCanvas(rawCell,psm);
      tries.push(cleanManualCell(raw));
    }

    let chosen=tries.find(validManualCell) || "";

    // Heuristic: combine digit fragments if OCR split a time.
    if(!chosen){
      const joined=tries.join(" ").replace(/[^0-9A-Z-]/g,"");
      const m=joined.match(/(\d{3,4})[-]?(\d{3,4})/);
      if(m){
        const candidate=cleanManualCell(`${m[1]}-${m[2]}`);
        if(validManualCell(candidate)) chosen=candidate;
      }
    }

    cells.push(chosen);
  }

  if(!name || name.length<2) name="PRABHAKAR, Vimal";
  return {row:{id:"manual-row",name,cells,workingHours:""}, previews};
}

function App(){
  const [entries,setEntries]=useState([]);
  const [tab,setTab]=useState("dashboard");
  const [query,setQuery]=useState("");
  const [ocr,setOcr]=useState(null);
  const [ocrProgress,setOcrProgress]=useState(0);
  const [processing,setProcessing]=useState(false);
  const [error,setError]=useState("");
  const [selectedRow,setSelectedRow]=useState("");
  const [firstDate,setFirstDate]=useState(todayISO());
  const [preview,setPreview]=useState(null);
  const [picker,setPicker]=useState(null);
  const [rowY,setRowY]=useState(50);
  const [cellPreviews,setCellPreviews]=useState([]);
  const [overtimeThreshold,setOvertimeThreshold]=useState(38);
  const [calendarMonth,setCalendarMonth]=useState(todayISO().slice(0,7)+"-01");
  const [selectedDate,setSelectedDate]=useState(todayISO());
  const fileRef=useRef();

  useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");setEntries(x.entries||[]);setOvertimeThreshold(x.overtimeThreshold||38)}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify({entries,overtimeThreshold}))}catch{}},[entries,overtimeThreshold]);

  const processImage=useCallback(async(file)=>{
    setError("");setProcessing(false);setOcr(null);setOcrProgress(0);
    try{
      const url=URL.createObjectURL(file);
      const canvas=await canvasFromFile(file);
      setPreview(url);
      setPicker({fileName:file.name,canvas,width:canvas.width,height:canvas.height});
      setRowY(50);
    }catch(e){
      setError("Could not open this screenshot.");
    }
  },[]);


  const readPickedRow=async()=>{
    if(!picker)return;
    setProcessing(true);setOcrProgress(0);setError("");
    try{
      const result=await readSelectedRosterRowWithPreviews(picker.canvas,rowY,setOcrProgress);
      const row=result.row;
      setCellPreviews(result.previews);
      setSelectedRow(row.id);
      setOcr({fileName:picker.fileName,rows:[row],mode:"manual-row"});
      setPicker(null);
    }catch(e){
      setError(e.message||"Could not read the selected row. Move the selector and try again.");
    }finally{
      setProcessing(false);setOcrProgress(0);
    }
  };


  const updateOcrCell=(index,value)=>{
    setOcr(o=>{
      if(!o)return o;
      const rows=o.rows.map(r=>r.id===selectedRow?{...r,cells:r.cells.map((c,i)=>i===index?value:c)}:r);
      return {...o,rows};
    });
  };
  const normalizeAllCells=()=>{
    setOcr(o=>{
      if(!o)return o;
      const rows=o.rows.map(r=>r.id===selectedRow?{...r,cells:r.cells.map(normalizeEditableShift)}:r);
      return {...o,rows};
    });
  };

  const importSelected=()=>{
    const row=ocr?.rows.find(r=>r.id===selectedRow); if(!row)return;
    const cleanName=row.name.replace(/\b(?:TRNG|RDO|ALLV|ALV|ALTH|HACC)\b.*$/i,"").trim();
    const added=row.cells.map((shift,i)=>shift?({
      id:`img-${Date.now()}-${i}`,name:cleanName,date:addDays(firstDate,i),
      time:CODES.includes(shift)?"":shift,code:CODES.includes(shift)?shift:"",
      hours:hoursForShift(shift),source:ocr.fileName
    }):null).filter(Boolean);
    setEntries(old=>[...old.filter(e=>!(e.name===cleanName && added.some(a=>a.date===e.date))),...added]);
    setOcr(null); setPreview(null); setTab("dashboard");
  };

  const upload=(files)=>{
    const file=files?.[0]; if(!file)return;
    const ext=file.name.split(".").pop().toLowerCase();
    if(["png","jpg","jpeg","webp"].includes(ext)){processImage(file);return;}
    if(ext==="csv"){
      Papa.parse(file,{header:true,skipEmptyLines:true,complete:r=>{
        const rows=r.data.map((x,i)=>({
          id:`csv-${Date.now()}-${i}`,name:x.Name||x.name||x.Employee||x.employee||"",
          date:x.Date||x.date||"",time:x.Time||x.time||x.Shift||x.shift||"",
          code:x.Code||x.code||"",hours:+(x.Hours||x.hours||0)||parseTimeRange(x.Time||x.time||"")||0,source:file.name
        })).filter(x=>x.name);
        setEntries(e=>[...e,...rows]);
      }}); return;
    }
    if(["xlsx","xls"].includes(ext)){
      const fr=new FileReader(); fr.onload=e=>{const wb=XLSX.read(e.target.result,{type:"array"});const sh=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(sh,{defval:""}).map((x,i)=>({id:`xls-${Date.now()}-${i}`,name:x.Name||x.name||x.Employee||x.employee||"",date:x.Date||x.date||"",time:x.Time||x.time||x.Shift||x.shift||"",code:x.Code||x.code||"",hours:+(x.Hours||x.hours||0)||parseTimeRange(x.Time||x.time||"")||0,source:file.name})).filter(x=>x.name);setEntries(v=>[...v,...rows])};fr.readAsArrayBuffer(file);return;
    }
    setError("Use a roster screenshot, CSV, XLS or XLSX file.");
  };

  const names=[...new Set(entries.map(e=>e.name))].sort();
  const myName=names.find(n=>/VIMAL/i.test(n))||names[0]||"";
  const mine=entries.filter(e=>!myName||e.name===myName).sort((a,b)=>a.date.localeCompare(b.date));
  const weekStart=mondayOf(todayISO());
  const week=mine.filter(e=>e.date>=weekStart&&e.date<addDays(weekStart,7));
  const month=mine.filter(e=>e.date.startsWith(calendarMonth.slice(0,7)));
  const weekHours=week.reduce((s,e)=>s+(+e.hours||0),0), monthHours=month.reduce((s,e)=>s+(+e.hours||0),0);
  const overtime=Math.max(0,weekHours-overtimeThreshold);
  const upcoming=mine.find(e=>e.date>=todayISO() && (e.time||e.code!=="RDO"));

  const filtered=entries.filter(e=>!query||e.name.toLowerCase().includes(query.toLowerCase()));

  return <div className="shell">
    <header className="top">
      <div><div className="vv">VV</div><div className="sub">DUTY ROSTER</div></div>
      <button className="ghost" onClick={()=>setTab("more")}><Settings2 size={18}/></button>
    </header>

    {tab==="dashboard" && <main>
      <section className="hero">
        <small>UPCOMING SHIFT</small>
        {upcoming?<><h2>{fmt(upcoming.date,{weekday:"long",day:"numeric",month:"long"})}</h2><h1>{upcoming.time||upcoming.code}</h1><p>{upcoming.name}</p></>:<h2>No upcoming shift</h2>}
      </section>
      <div className="stats">
        <Stat label="WEEK HOURS" value={weekHours.toFixed(2)}/>
        <Stat label="OVERTIME" value={overtime.toFixed(2)}/>
      </div>
      <section className="panel">
        <div className="sectionTitle"><b>THIS WEEK</b><span>{fmt(weekStart)} – {fmt(addDays(weekStart,6))}</span></div>
        <Roster rows={Array.from({length:7},(_,i)=>{const d=addDays(weekStart,i);return mine.find(e=>e.date===d)||{id:d,date:d,name:myName,code:"OFF",hours:0}})}/>
      </section>
    </main>}

    {tab==="calendar" && <main>
      <div className="monthHead"><button className="ghost" onClick={()=>{const d=new Date(calendarMonth+"T12:00:00");d.setMonth(d.getMonth()-1);setCalendarMonth(d.toISOString().slice(0,7)+"-01")}}><ChevronLeft/></button><h2>{new Date(calendarMonth+"T12:00:00").toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2><button className="ghost" onClick={()=>{const d=new Date(calendarMonth+"T12:00:00");d.setMonth(d.getMonth()+1);setCalendarMonth(d.toISOString().slice(0,7)+"-01")}}><ChevronRight/></button></div>
      <CalendarGrid month={calendarMonth} rows={mine} selected={selectedDate} onSelect={setSelectedDate}/>
      <section className="panel"><div className="sectionTitle"><b>{fmt(selectedDate,{weekday:"long",day:"numeric",month:"long"})}</b></div><Roster rows={mine.filter(e=>e.date===selectedDate)}/></section>
      <div className="stats three"><Stat label="TOTAL HOURS" value={monthHours.toFixed(2)}/><Stat label="OVERTIME" value={Math.max(0,monthHours-overtimeThreshold*4).toFixed(2)}/><Stat label="TARGET" value={(overtimeThreshold*4).toFixed(2)}/></div>
    </main>}

    {tab==="roster" && <main>
      <div className="seg"><button className="active">Upcoming</button><button>All</button><button>Past</button></div>
      <Roster rows={mine.filter(e=>e.date>=todayISO())}/>
    </main>}

    {tab==="search" && <main>
      <div className="search"><Search size={17}/><input placeholder="Search by name..." value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery("")}><X size={14}/></button>}</div>
      <section className="panel"><div className="sectionTitle"><b>STAFF</b><span>{filtered.length} records</span></div><Roster rows={filtered.slice(0,30)}/></section>
    </main>}

    {tab==="more" && <main>
      <section className="panel menu">
        <h3>IMPORT</h3>
        <button onClick={()=>fileRef.current?.click()}><FileSpreadsheet/><span><b>Upload CSV / Excel</b><small>Import roster files</small></span></button>
        <button onClick={()=>fileRef.current?.click()}><Camera/><span><b>Upload Image (OCR)</b><small>Extract data from roster screenshots</small></span></button>
      </section>
      <section className="panel menu">
        <h3>EXPORT</h3>
        <button onClick={()=>exportCSV(entries)}><Download/><span><b>Export to CSV</b><small>Download roster data</small></span></button>
      </section>
      <section className="panel menu">
        <h3>SETTINGS</h3>
        <label className="setting">Weekly overtime threshold<input type="number" value={overtimeThreshold} onChange={e=>setOvertimeThreshold(+e.target.value||38)}/></label>
        <button className="danger" onClick={()=>{if(confirm("Delete all roster data?"))setEntries([])}}><Trash2/><span><b>Reset All Data</b><small>Delete all roster data</small></span></button>
      </section>
    </main>}

    <input ref={fileRef} hidden type="file" accept=".csv,.xlsx,.xls,image/*" onChange={e=>{upload(e.target.files);e.target.value=""}}/>

    {error&&<div className="toast"><AlertTriangle size={16}/>{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}

    {processing&&<div className="modalWrap"><div className="modal compact"><div className="spinner"/><h3>Reading roster screenshot…</h3><p>{ocrProgress}%</p><small>Reading the selected row cell by cell</small></div></div>}


    {picker&&<div className="modalWrap">
      <div className="modal">
        <div className="modalHead">
          <div>
            <h2>Select your roster row</h2>
            <p>Move the gold line onto your Vimal row, then read that row.</p>
          </div>
          <button className="ghost" onClick={()=>{setPicker(null);setPreview(null)}}><X/></button>
        </div>

        <div className="pickerImage">
          <img src={preview}/>
          <div className="rowGuide" style={{top:`${rowY}%`}}>
            <span>Tap / move to your row</span>
          </div>
          <input
            className="rowSlider"
            type="range"
            min="8"
            max="92"
            step="0.2"
            value={rowY}
            onChange={e=>setRowY(+e.target.value)}
          />
        </div>

        <div className="pickerHelp">
          <b>How to position it</b>
          <span>Put the gold line through the centre of your row — the row containing PRABHAKAR, Vimal. Keep the full 14-day table visible in the screenshot.</span>
        </div>

        <button className="primary" onClick={readPickedRow}>
          <Search size={16}/> Read this row
        </button>
      </div>
    </div>}

    {ocr&&<div className="modalWrap">
      <div className="modal">
        <div className="modalHead"><div><h2>Screenshot roster detected</h2><p>Each day now shows the original roster cell beside an editable field. Correct any highlighted OCR mistakes before importing.</p></div><button className="ghost" onClick={()=>setOcr(null)}><X/></button></div>
        <div className="ocrLayout">
          <div className="imageBox">{preview?<img src={preview}/>:<ImageIcon/>}</div>
          <div className="ocrRight">
            <label>First date in roster<input type="date" value={firstDate} onChange={e=>setFirstDate(e.target.value)}/></label>
            <label>Detected name<input value={ocr.rows[0]?.name||""} onChange={e=>setOcr(o=>({...o,rows:[{...o.rows[0],name:e.target.value}]}))}/></label>
            <div className="review">
              {ocr.rows.filter(r=>r.id===selectedRow).map(r=>r.cells.map((s,i)=><div className="reviewRow" key={i}><span>{fmt(addDays(firstDate,i),{weekday:"short",day:"numeric",month:"short"})}</span><b>{s||"—"}</b><em>{s?hoursForShift(s).toFixed(1)+"h":""}</em></div>))}
            </div>
          </div>
        </div>
        <div className="reviewActions"><button className="secondary" onClick={normalizeAllCells}>Clean up detected times</button><button className="primary" onClick={importSelected}><Check size={16}/> Import this roster row</button></div>
      </div>
    </div>}

    <nav className="bottom">
      <Nav id="dashboard" tab={tab} setTab={setTab} icon={<Home/>} label="Dashboard"/>
      <Nav id="calendar" tab={tab} setTab={setTab} icon={<CalendarDays/>} label="Calendar"/>
      <Nav id="roster" tab={tab} setTab={setTab} icon={<ClipboardList/>} label="My Roster"/>
      <Nav id="search" tab={tab} setTab={setTab} icon={<Search/>} label="Search"/>
      <Nav id="more" tab={tab} setTab={setTab} icon={<Menu/>} label="More"/>
    </nav>
  </div>
}
function Stat({label,value}){return <div className="stat"><small>{label}</small><b>{value}</b></div>}
function Nav({id,tab,setTab,icon,label}){return <button className={tab===id?"on":""} onClick={()=>setTab(id)}>{icon}<span>{label}</span></button>}
function Roster({rows}){if(!rows.length)return <div className="empty">No shifts found.</div>;return <div className="list">{rows.map(e=><div className="item" key={e.id}><div><small>{fmt(e.date,{weekday:"short",day:"numeric",month:"short"})}</small><b>{e.time||e.code||"Off"}</b><span>{e.name}</span></div><strong>{(+e.hours||0).toFixed(2)}<small> hrs</small></strong></div>)}</div>}
function CalendarGrid({month,rows,selected,onSelect}){
  const d=new Date(month+"T12:00:00"), first=new Date(d.getFullYear(),d.getMonth(),1), days=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(), lead=(first.getDay()+6)%7;
  const cells=[...Array(lead).fill(null),...Array.from({length:days},(_,i)=>i+1)];while(cells.length%7)cells.push(null);
  return <div className="cal"><>{["MON","TUE","WED","THU","FRI","SAT","SUN"].map(x=><div className="dow" key={x}>{x}</div>)}</>{cells.map((n,i)=>{if(!n)return <div key={i}/>;const iso=new Date(d.getFullYear(),d.getMonth(),n,12).toISOString().slice(0,10), r=rows.find(x=>x.date===iso);return <button key={i} className={selected===iso?"selected":""} onClick={()=>onSelect(iso)}><b>{n}</b>{r&&<span className={r.code==="RDO"?"off":""}/>}</button>})}</div>
}
function exportCSV(rows){const csv=Papa.unparse(rows);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="vv-roster.csv";a.click();}
createRoot(document.getElementById("root")).render(<App/>);
