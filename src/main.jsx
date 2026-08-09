
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
  const [overtimeThreshold,setOvertimeThreshold]=useState(38);
  const [calendarMonth,setCalendarMonth]=useState(todayISO().slice(0,7)+"-01");
  const [selectedDate,setSelectedDate]=useState(todayISO());
  const fileRef=useRef();

  useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");setEntries(x.entries||[]);setOvertimeThreshold(x.overtimeThreshold||38)}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify({entries,overtimeThreshold}))}catch{}},[entries,overtimeThreshold]);

  const processImage=useCallback(async(file)=>{
    setError("");setProcessing(true);setOcrProgress(0);setPreview(URL.createObjectURL(file));
    try{
      // upscale in canvas for better small-cell recognition
      const bmp=await createImageBitmap(file);
      const scale=Math.max(1.8, Math.min(3, 2200/bmp.width));
      const c=document.createElement("canvas"); c.width=bmp.width*scale; c.height=bmp.height*scale;
      const ctx=c.getContext("2d");
      ctx.filter="grayscale(1) contrast(1.7)";
      ctx.drawImage(bmp,0,0,c.width,c.height);
      const blob=await new Promise(r=>c.toBlob(r,"image/png"));
      const result=await Tesseract.recognize(blob,"eng",{logger:m=>{if(m.status==="recognizing text")setOcrProgress(Math.round((m.progress||0)*100))}});
      const words=result.data.words||[];
      const rows=groupWordsByRow(words);
      const width=c.width;
      const candidates=makeCandidateRows(rows,width);
      const centers=inferColumnCenters(candidates,width);
      const first=inferFirstDate(rows);
      setFirstDate(first);
      const mapped=candidates.map(r=>({...r,cells:mapCandidate(r,centers)})).filter(r=>r.cells.some(Boolean));
      if(!mapped.length) throw new Error("No staff rows were confidently detected.");
      setOcr({fileName:file.name,rows:mapped,centers,width,height:c.height});
      const preferred=mapped.find(r=>/VIMAL/i.test(r.name))||mapped[0];
      setSelectedRow(preferred.id);
    }catch(e){
      setError(e.message||"Could not read this screenshot. Crop around the roster table and try again.");
      setOcr(null);
    }finally{setProcessing(false);setOcrProgress(0)}
  },[]);

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

    {processing&&<div className="modalWrap"><div className="modal compact"><div className="spinner"/><h3>Reading roster screenshot…</h3><p>{ocrProgress}%</p><small>Detecting staff rows and 14 roster columns</small></div></div>}

    {ocr&&<div className="modalWrap">
      <div className="modal">
        <div className="modalHead"><div><h2>Screenshot roster detected</h2><p>Select your staff row, review the 14 days, then import.</p></div><button className="ghost" onClick={()=>setOcr(null)}><X/></button></div>
        <div className="ocrLayout">
          <div className="imageBox">{preview?<img src={preview}/>:<ImageIcon/>}</div>
          <div className="ocrRight">
            <label>First date in roster<input type="date" value={firstDate} onChange={e=>setFirstDate(e.target.value)}/></label>
            <label>Your staff row<select value={selectedRow} onChange={e=>setSelectedRow(e.target.value)}>{ocr.rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <div className="review">
              {ocr.rows.filter(r=>r.id===selectedRow).map(r=>r.cells.map((s,i)=><div className="reviewRow" key={i}><span>{fmt(addDays(firstDate,i),{weekday:"short",day:"numeric",month:"short"})}</span><b>{s||"—"}</b><em>{s?hoursForShift(s).toFixed(1)+"h":""}</em></div>))}
            </div>
          </div>
        </div>
        <button className="primary" onClick={importSelected}><Check size={16}/> Import this roster row</button>
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
