import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import Tesseract from "tesseract.js";
import {
  Upload, Search, CalendarDays, Clock3, RotateCcw, Download,
  Filter, ChevronLeft, ChevronRight, Image as ImageIcon, Save,
  Settings2, X, Trash2, LayoutDashboard, List, Check, ScanLine
} from "lucide-react";
import "./styles.css";

const STORE = "vv-roster-complete-v1";
const DAY = 86400000;

const SHIFT_TOKEN_RE = /(?:\b(?:RDO|AL|ALLV|ALTH|HACC|TRNG|TRAINING|OFF)\b|\b[0-2]?\d[:.]?\d{2}\s*[-–]\s*[0-2]?\d[:.]?\d{2}\b)/ig;
function normalizeShiftText(s=""){
  let x=String(s).toUpperCase().replace(/[—_]/g,"-").replace(/\s+/g," ").trim();
  x=x.replace(/\b(\d{2})(\d{2})\s*[-–]\s*(\d{2})(\d{2})\b/g,"$1$2-$3$4");
  return x;
}
function shiftTokens(text=""){return normalizeShiftText(text).match(SHIFT_TOKEN_RE)||[];}
function firstRosterDate(text=""){
  const range=String(text).match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/);
  if(range)return `${range[3]}-${String(+range[2]).padStart(2,"0")}-${String(+range[1]).padStart(2,"0")}`;
  return "";
}
function candidateName(line=""){
  const normalized=normalizeShiftText(line);
  const m=normalized.match(SHIFT_TOKEN_RE);
  if(!m)return "";
  const prefix=line.slice(0,m.index).replace(/\s+/g," ").replace(/[|:;]+$/g,"").trim();
  if(prefix.length<3 || prefix.length>60)return "";
  if(/SHIFT|TIER|BAG|AIRPORT|WORKING|HOURS|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY/i.test(prefix))return "";
  return prefix;
}
async function preprocessRosterImage(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
    const scale=Math.max(2, Math.min(3, 2400/img.width));
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale);
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data=ctx.getImageData(0,0,canvas.width,canvas.height), a=data.data;
    for(let i=0;i<a.length;i+=4){
      const g=.299*a[i]+.587*a[i+1]+.114*a[i+2];
      const v=g>210?255:g<105?0:Math.max(0,Math.min(255,(g-128)*1.65+128));
      a[i]=a[i+1]=a[i+2]=v;
    }
    ctx.putImageData(data,0,0);
    return {dataUrl:canvas.toDataURL("image/png"),width:canvas.width,height:canvas.height};
  } finally { URL.revokeObjectURL(url); }
}
function makeScreenshotCandidates(result){
  const lines=(result.data.lines||[]).map((l,i)=>({id:i,text:(l.text||"").trim(),bbox:l.bbox})).filter(l=>l.text);
  const candidates=[];
  for(const l of lines){
    const tokens=shiftTokens(l.text); const name=candidateName(l.text);
    if(name && tokens.length>=2)candidates.push({...l,name,tokens});
  }
  return candidates;
}
function rowsFromScreenshot(importData, candidate, chosenName){
  const words=importData.words||[];
  const b=candidate.bbox||{}; const cy=((b.y0||0)+(b.y1||0))/2; const h=Math.max(18,(b.y1||0)-(b.y0||0));
  const rowWords=words.filter(w=>{const wb=w.bbox||{}; const wy=((wb.y0||0)+(wb.y1||0))/2; return Math.abs(wy-cy)<=h*.8 && String(w.text||"").trim();}).sort((a,b)=>(a.bbox?.x0||0)-(b.bbox?.x0||0));
  const firstShift=rowWords.find(w=>shiftTokens(w.text).length || /^(?:RDO|AL|ALLV|ALTH|HACC|TRNG|OFF)$/i.test(w.text));
  if(!firstShift)return [];
  const xStart=Math.max(0,(firstShift.bbox?.x0||0)-4);
  const hourWord=[...rowWords].reverse().find(w=>/^\d{1,3}[.,]\d{1,2}$/.test(String(w.text||"").trim()));
  let xEnd=hourWord?.bbox?.x0 || importData.width*.96;
  if(xEnd<=xStart)xEnd=importData.width*.96;
  const colW=(xEnd-xStart)/14;
  const cells=Array.from({length:14},()=>[]);
  rowWords.forEach(w=>{
    const wb=w.bbox||{}; const cx=((wb.x0||0)+(wb.x1||0))/2;
    if(cx<xStart||cx>=xEnd)return;
    const idx=Math.max(0,Math.min(13,Math.floor((cx-xStart)/colW)));
    cells[idx].push(String(w.text||"").trim());
  });
  return cells.map((parts,i)=>{
    let cell=normalizeShiftText(parts.join(" "));
    const pieces=shiftTokens(cell);
    if(!pieces.length && !/RDO|AL|ALLV|ALTH|HACC|TRNG|OFF/i.test(cell))return null;
    if(pieces.length) cell=cell.replace(/.*?(?=(?:RDO|AL|ALLV|ALTH|HACC|TRNG|OFF|\d))/i,"").trim();
    const time=(cell.match(/\b\d{4}\s*[-–]\s*\d{4}\b/)||[])[0]||"";
    return {id:`shot-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,name:chosenName||candidate.name,date:addDays(importData.startDate,i),time:cell,hours:time?(hoursFromTime(time)||""):0,team:"",role:"",source:importData.fileName};
  }).filter(Boolean);
}

function clean(s=""){return String(s).toLowerCase().replace(/[_-]/g," ").replace(/\s+/g," ").trim();}
function col(keys, patterns){return keys.find(k=>patterns.some(p=>clean(k).includes(p)));}
function dateValue(v){
  if(!v) return "";
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  const s=String(v).trim();
  const m=s.match(/^(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})$/);
  if(m){let y=+m[3]; if(y<100)y+=2000; return `${y}-${String(+m[2]).padStart(2,"0")}-${String(+m[1]).padStart(2,"0")}`;}
  const t=Date.parse(s); return isNaN(t)?s:new Date(t).toISOString().slice(0,10);
}
function detect(row){
  const k=Object.keys(row);
  return {
    name:col(k,["employee name","staff name","full name","employee","staff","name","person"]),
    date:col(k,["roster date","work date","shift date","date","day"]),
    start:col(k,["start time","clock in","in time","start","in"]),
    end:col(k,["finish time","end time","clock out","out time","finish","end","out"]),
    time:col(k,["shift time","shift","time"]),
    hours:col(k,["total hours","paid hours","working hours","hours","hrs"]),
    team:col(k,["team","crew","group","squad"]),
    role:col(k,["role","position","job","duty"])
  };
}
function hoursFromTime(time){
  if(!time) return null;
  const m=String(time).match(/(\\d{1,2})(?::|\\.)(\\d{2})\\s*(AM|PM)?\\s*[–-]\\s*(\\d{1,2})(?::|\\.)(\\d{2})\\s*(AM|PM)?/i);
  if(!m)return null;
  let sh=+m[1], sm=+m[2], eh=+m[4], em=+m[5];
  const ap1=m[3]?.toUpperCase(), ap2=m[6]?.toUpperCase();
  if(ap1==="PM"&&sh<12)sh+=12; if(ap1==="AM"&&sh===12)sh=0;
  if(ap2==="PM"&&eh<12)eh+=12; if(ap2==="AM"&&eh===12)eh=0;
  let mins=eh*60+em-(sh*60+sm); if(mins<0)mins+=1440;
  return mins/60;
}
function parseHours(v){if(v===null||v===undefined||v==="")return null; const n=parseFloat(String(v).replace(",",".")); return isNaN(n)?null:n;}
function normalize(rows, source){
  if(!rows?.length)return [];
  const c=detect(rows[0]);
  return rows.map((r,i)=>{
    const name=c.name?String(r[c.name]??"").trim():"";
    if(!name)return null;
    let time="";
    if(c.start||c.end){
      const a=c.start?String(r[c.start]??"").trim():"", b=c.end?String(r[c.end]??"").trim():"";
      if(a||b)time=`${a}${a||b?" – ":""}${b}`;
    }
    if(!time&&c.time)time=String(r[c.time]??"").trim();
    const supplied=c.hours?parseHours(r[c.hours]):null;
    return {
      id:`${source}-${i}-${Math.random().toString(36).slice(2)}`,
      name,date:c.date?dateValue(r[c.date]):"",time,
      hours:supplied??hoursFromTime(time)??"",
      team:c.team?String(r[c.team]??"").trim():"",
      role:c.role?String(r[c.role]??"").trim():"",
      source
    };
  }).filter(Boolean);
}
function isoToday(){return new Date().toISOString().slice(0,10);}
function addDays(iso,n){const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function monthStart(iso){const d=new Date(iso+"T12:00:00");return new Date(d.getFullYear(),d.getMonth(),1);}
function fmtDate(iso){if(!iso)return "No date"; const d=new Date(iso+"T12:00:00");return d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}
function fmtShort(iso){if(!iso)return ""; const d=new Date(iso+"T12:00:00");return d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});}
function keyDate(d){return d.toISOString().slice(0,10);}
function exportXlsx(rows){
  const ws=XLSX.utils.json_to_sheet(rows.map(e=>({Name:e.name,Date:e.date,Time:e.time,Hours:e.hours,Team:e.team,Role:e.role,Source:e.source})));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Roster"); XLSX.writeFile(wb,"vv-roster.xlsx");
}
function exportCsv(rows){
  const csv=Papa.unparse(rows.map(e=>({Name:e.name,Date:e.date,Time:e.time,Hours:e.hours,Team:e.team,Role:e.role,Source:e.source})));
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="vv-roster.csv"; a.click();
}
function sumHours(rows){return rows.reduce((s,e)=>s+(parseHours(e.hours)??hoursFromTime(e.time)??0),0);}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

function App(){
  const [entries,setEntries]=useState([]);
  const [files,setFiles]=useState([]);
  const [query,setQuery]=useState("");
  const [dateFilter,setDateFilter]=useState("");
  const [teamFilter,setTeamFilter]=useState("");
  const [view,setView]=useState("dashboard");
  const [calendarMonth,setCalendarMonth]=useState(isoToday().slice(0,7)+"-01");
  const [weekStart,setWeekStart]=useState(addDays(isoToday(),-(new Date().getDay()+6)%7));
  const [selectedDay,setSelectedDay]=useState(isoToday());
  const [settings,setSettings]=useState(false);
  const [overtime,setOvertime]=useState(40);
  const [isOCR,setIsOCR]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState("");
  const [drag,setDrag]=useState(false);
  const [shotImport,setShotImport]=useState(null);
  const [shotName,setShotName]=useState("");
  const [shotCandidate,setShotCandidate]=useState(null);
  const input=useRef();

  useEffect(()=>{
    try{
      const x=JSON.parse(localStorage.getItem(STORE)||"{}");
      setEntries(x.entries||[]); setFiles(x.files||[]); setOvertime(x.overtime||40);
    }catch{}
  },[]);
  useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify({entries,files,overtime}))}catch{}},[entries,files,overtime]);

  const addRows=useCallback(rows=>{
    setEntries(old=>{
      const seen=new Set(old.map(e=>[e.name,e.date,e.time,e.hours,e.team,e.role].join("|")));
      return [...old,...rows.filter(e=>{const k=[e.name,e.date,e.time,e.hours,e.team,e.role].join("|");if(seen.has(k))return false;seen.add(k);return true;})];
    });
  },[]);

  const ocr=useCallback(async file=>{
    setIsOCR(true);setProgress(0);setError("");
    try{
      const prepared=await preprocessRosterImage(file);
      const r=await Tesseract.recognize(prepared.dataUrl,"eng",{logger:m=>m.status==="recognizing text"&&setProgress(Math.round(m.progress*100))});
      const candidates=makeScreenshotCandidates(r);
      const startDate=firstRosterDate(r.data.text)||isoToday();
      const data={fileName:file.name,text:r.data.text,words:r.data.words||[],lines:r.data.lines||[],width:prepared.width,height:prepared.height,candidates,startDate};
      if(!candidates.length){
        setError("I could read the screenshot, but could not confidently find staff rows. Crop the screenshot so the roster table fills most of the image and try again.");
      }else{
        setShotImport(data); setShotCandidate(candidates[0]); setShotName(candidates[0].name);
      }
      setFiles(f=>f.includes(file.name)?f:[...f,file.name]);
    }catch(e){console.error(e);setError("Could not read the screenshot. Try a clearer crop of the roster table.")}
    finally{setIsOCR(false);setProgress(0)}
  },[]);

  const handleFiles=useCallback(list=>{
    setError("");
    [...(list||[])].forEach(file=>{
      const ext=file.name.split(".").pop().toLowerCase();
      if(["png","jpg","jpeg","gif","webp"].includes(ext)){ocr(file);return;}
      if(ext==="csv"){
        const r=new FileReader(); r.onload=e=>Papa.parse(e.target.result,{header:true,skipEmptyLines:true,complete:x=>{const rows=normalize(x.data,file.name); if(!rows.length)setError(`No employee/name column found in ${file.name}.`); else addRows(rows);}}); r.readAsText(file); setFiles(f=>f.includes(file.name)?f:[...f,file.name]); return;
      }
      if(["xlsx","xls"].includes(ext)){
        const r=new FileReader(); r.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:"array"}), sh=wb.Sheets[wb.SheetNames[0]], rows=normalize(XLSX.utils.sheet_to_json(sh,{defval:""}),file.name); if(!rows.length)setError(`No employee/name column found in ${file.name}.`); else addRows(rows);}catch{setError(`Could not read ${file.name}.`)}}; r.readAsArrayBuffer(file); setFiles(f=>f.includes(file.name)?f:[...f,file.name]); return;
      }
      setError("Unsupported file. Use CSV, XLSX, XLS or an image.");
    });
  },[addRows,ocr]);

  const teams=useMemo(()=>[...new Set(entries.map(e=>e.team).filter(Boolean))].sort(),[entries]);
  const names=useMemo(()=>[...new Set(entries.map(e=>e.name))].sort(),[entries]);
  const filtered=useMemo(()=>entries.filter(e=>(!query||e.name.toLowerCase().includes(query.toLowerCase()))&&(!dateFilter||e.date===dateFilter)&&(!teamFilter||e.team===teamFilter)).sort((a,b)=>String(a.date).localeCompare(String(b.date))),[entries,query,dateFilter,teamFilter]);

  const thisWeek=useMemo(()=>entries.filter(e=>e.date>=weekStart&&e.date<addDays(weekStart,7)),[entries,weekStart]);
  const thisMonth=useMemo(()=>{const m=calendarMonth.slice(0,7);return entries.filter(e=>e.date.startsWith(m))},[entries,calendarMonth]);
  const upcoming=useMemo(()=>entries.filter(e=>e.date>=isoToday()).sort((a,b)=>a.date.localeCompare(b.date))[0],[entries]);
  const totalWeek=sumHours(thisWeek), totalMonth=sumHours(thisMonth);
  const overtimeWeek=Math.max(0,totalWeek-overtime);

  const calendarDays=useMemo(()=>{
    const start=monthStart(calendarMonth);
    const first=(start.getDay()+6)%7;
    const count=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
    const cells=[];
    for(let i=0;i<first;i++)cells.push(null);
    for(let d=1;d<=count;d++)cells.push(new Date(start.getFullYear(),start.getMonth(),d));
    while(cells.length%7)cells.push(null);
    return cells;
  },[calendarMonth]);

  const reset=()=>{if(confirm("Delete the saved roster from this device?")){setEntries([]);setFiles([]);localStorage.removeItem(STORE)}};

  return <div className="app">
    <header className="header">
      <div><div className="logo">VV</div><div className="eyebrow">DUTY ROSTER</div></div>
      <button className="iconBtn" onClick={()=>setSettings(!settings)}><Settings2 size={18}/></button>
    </header>

    {settings&&<section className="panel settings">
      <div><b>Roster settings</b><span className="muted">Local device storage</span></div>
      <label>Weekly overtime threshold
        <input type="number" value={overtime} min="1" onChange={e=>setOvertime(+e.target.value||40)}/>
      </label>
      <button className="dangerBtn" onClick={reset}><Trash2 size={14}/> Delete all saved roster data</button>
    </section>}

    <section className="upload" onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handleFiles(e.dataTransfer.files)}} onClick={()=>!isOCR&&input.current?.click()}>
      {isOCR?<><LoaderIcon/><b>Reading roster image…</b><small>{progress}%</small></>:<><Upload size={23}/><b>Upload roster</b><small>CSV · Excel · Screenshot · Photo</small></>}
      <input ref={input} hidden type="file" multiple accept=".csv,.xlsx,.xls,image/*" onChange={e=>{handleFiles(e.target.files);e.target.value=""}}/>
    </section>


    {shotImport&&<div className="modalBackdrop"><div className="shotModal">
      <div className="modalHead"><div><b>Screenshot roster detected</b><small>Choose your row before importing</small></div><button className="iconBtn" onClick={()=>setShotImport(null)}><X size={16}/></button></div>
      <div className="shotHint"><ScanLine size={16}/><span>For best results, crop the screenshot so the roster table fills the screen. The app reads 14 day columns from left to right.</span></div>
      <label>Your name<input value={shotName} onChange={e=>setShotName(e.target.value)} placeholder="e.g. PRABHAKAR, Vimal"/></label>
      <label>First date in roster<input type="date" value={shotImport.startDate} onChange={e=>setShotImport(x=>({...x,startDate:e.target.value}))}/></label>
      <div className="candidateTitle">Detected staff rows</div>
      <div className="candidateList">{shotImport.candidates.slice(0,30).map(c=><button key={c.id} className={shotCandidate?.id===c.id?"candidate selected":"candidate"} onClick={()=>{setShotCandidate(c);setShotName(c.name)}}><span><b>{c.name}</b><small>{c.tokens.slice(0,5).join(" · ")}</small></span>{shotCandidate?.id===c.id&&<Check size={16}/>}</button>)}</div>
      <button className="importBtn" disabled={!shotCandidate||!shotImport.startDate} onClick={()=>{
        const rows=rowsFromScreenshot(shotImport,shotCandidate,shotName.trim()||shotCandidate.name);
        if(!rows.length){setError("No shift cells were detected for that row. Try a tighter crop of the table.");return;}
        addRows(rows); setQuery(shotName.trim()||shotCandidate.name); setView("list"); setShotImport(null);
      }}><Check size={16}/>Import this roster row</button>
    </div></div>}

    {error&&<div className="error">{error}</div>}

    {files.length>0&&<div className="fileRow">{files.map(f=><span key={f}>{f}<button onClick={()=>{setFiles(x=>x.filter(y=>y!==f));setEntries(x=>x.filter(e=>e.source!==f))}}><X size={10}/></button></span>)}</div>}

    <nav className="tabs">
      <button className={view==="dashboard"?"active":""} onClick={()=>setView("dashboard")}><LayoutDashboard size={15}/>Dashboard</button>
      <button className={view==="calendar"?"active":""} onClick={()=>setView("calendar")}><CalendarDays size={15}/>Calendar</button>
      <button className={view==="list"?"active":""} onClick={()=>setView("list")}><List size={15}/>Roster</button>
    </nav>

    {view==="dashboard"&&<main>
      <section className="hero">
        <div><small>NEXT SHIFT</small>{upcoming?<><h2>{fmtShort(upcoming.date)}</h2><p>{upcoming.name} · {upcoming.time||"Time not listed"}</p></>:<h2>No upcoming shift</h2>}</div>
        {upcoming&&<div className="badge">{upcoming.team||"Roster"}</div>}
      </section>

      <div className="stats">
        <Stat label="This week" value={`${totalWeek.toFixed(1)}h`} icon={<Clock3 size={15}/>}/>
        <Stat label="This month" value={`${totalMonth.toFixed(1)}h`} icon={<CalendarDays size={15}/>}/>
        <Stat label="Overtime" value={`${overtimeWeek.toFixed(1)}h`} icon={<Clock3 size={15}/>}/>
      </div>

      <section className="panel">
        <div className="sectionTitle"><b>This week</b><button onClick={()=>setView("calendar")}>Open calendar →</button></div>
        <div className="weekStrip">{Array.from({length:7},(_,i)=>addDays(weekStart,i)).map(d=>{
          const rows=entries.filter(e=>e.date===d);
          return <button key={d} className={d===selectedDay?"day activeDay":"day"} onClick={()=>{setSelectedDay(d);setView("calendar")}}><small>{new Date(d+"T12:00:00").toLocaleDateString(undefined,{weekday:"short"})}</small><b>{new Date(d+"T12:00:00").getDate()}</b><span>{rows.length}</span></button>
        })}</div>
      </section>

      <section className="panel">
        <div className="sectionTitle"><b>Upcoming roster</b><span className="muted">{entries.length} records</span></div>
        <RosterList rows={entries.filter(e=>e.date>=isoToday()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8)}/>
      </section>
    </main>}

    {view==="calendar"&&<main>
      <div className="calendarHeader"><button className="iconBtn" onClick={()=>setCalendarMonth(addDays(calendarMonth,-1).slice(0,7)+"-01")}><ChevronLeft/></button><h2>{new Date(calendarMonth+"T12:00:00").toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2><button className="iconBtn" onClick={()=>setCalendarMonth(addDays(calendarMonth,32).slice(0,7)+"-01")}><ChevronRight/></button></div>
      <div className="calendar">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=><div className="dow" key={x}>{x}</div>)}
        {calendarDays.map((d,i)=>{const iso=d&&keyDate(d), rows=iso?entries.filter(e=>e.date===iso):[]; return <button key={i} disabled={!d} className={"cell "+(iso===isoToday()?"today":"")} onClick={()=>{if(iso){setSelectedDay(iso);setDateFilter(iso)}}}>{d&&<><b>{d.getDate()}</b>{rows.slice(0,3).map((e,j)=><span key={j} className="shiftDot">{e.team||e.name.split(" ")[0]}</span>)}{rows.length>3&&<small>+{rows.length-3}</small>}</>}</button>})}
      </div>
      <section className="panel">
        <div className="sectionTitle"><b>{fmtShort(selectedDay)}</b><button onClick={()=>setDateFilter(dateFilter?"":selectedDay)}>{dateFilter?"Clear":"Filter"}</button></div>
        <RosterList rows={entries.filter(e=>e.date===selectedDay)}/>
      </section>
    </main>}

    {view==="list"&&<main>
      <div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search employee…"/>{query&&<button onClick={()=>setQuery("")}><X size={14}/></button>}</div>
      <div className="filters"><select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}><option value="">All teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select><select value={dateFilter} onChange={e=>setDateFilter(e.target.value)}><option value="">All dates</option>{[...new Set(entries.map(e=>e.date).filter(Boolean))].sort().map(d=><option key={d}>{d}</option>)}</select></div>
      <div className="quick">{names.slice(0,12).map(n=><button key={n} onClick={()=>setQuery(n)}>{n}</button>)}</div>
      <div className="sectionTitle"><b>{filtered.length} entries</b><div className="export"><button onClick={()=>exportCsv(filtered)}><Download size={13}/>CSV</button><button onClick={()=>exportXlsx(filtered)}>Excel</button></div></div>
      <RosterList rows={filtered}/>
    </main>}

    <footer><Save size={12}/> Saved locally on this device</footer>
  </div>
}

function LoaderIcon(){return <div className="spinner"/>}
function Stat({label,value,icon}){return <div className="stat"><div>{icon}</div><small>{label}</small><b>{value}</b></div>}
function RosterList({rows}){if(!rows.length)return <div className="empty">No shifts found.</div>;return <div className="rosterList">{rows.map(e=><article className="shift" key={e.id}><div className="shiftBar"/><div className="shiftMain"><b>{e.name}</b><small>{fmtDate(e.date)} {e.time&&"· "+e.time}</small>{(e.team||e.role)&&<span>{e.team}{e.team&&e.role?" · ":""}{e.role}</span>}</div><strong>{e.hours!==""&&e.hours!=null?`${Number(e.hours).toFixed(1)}h`:"—"}</strong></article>)}</div>}

createRoot(document.getElementById("root")).render(<App/>);
