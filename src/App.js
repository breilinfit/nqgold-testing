import { useState, useEffect, useRef, useCallback } from "react";

// ─── ASSETS ───────────────────────────────────────────────────────────────────
const ASSETS = {
  NQ:    { label:"NQ — Nasdaq 100 Futures", base:18200, vol:180, tick:0.25, tickVal:5 },
  MNQ:   { label:"MNQ — Micro Nasdaq",      base:18200, vol:180, tick:0.25, tickVal:0.5 },
  GC:    { label:"GC — Gold Futures",        base:2320,  vol:22,  tick:0.10, tickVal:10 },
  MGC:   { label:"MGC — Micro Gold",         base:2320,  vol:22,  tick:0.10, tickVal:1 },
  ES:    { label:"ES — S&P 500 Futures",     base:4700,  vol:50,  tick:0.25, tickVal:12.5 },
  CL:    { label:"CL — Petróleo",            base:78,    vol:1.2, tick:0.01, tickVal:10 },
  XAUUSD:{ label:"XAUUSD — Oro CFD",         base:2320,  vol:22,  tick:0.01, tickVal:1 },
};

const TF_MS = {"1m":60000,"5m":300000,"10m":600000,"15m":900000,"30m":1800000,"1h":3600000,"4h":14400000,"1D":86400000};
const VISIBLE_DEFAULT = 80;

// ─── SESSION ──────────────────────────────────────────────────────────────────
function getSession(h){
  if(h>=9&&h<16) return "ny";
  if(h>=3&&h<9)  return "lon";
  if(h>=20||h<3) return "asia";
  return "none";
}

// ─── CANDLE GENERATOR ─────────────────────────────────────────────────────────
function genCandles(n, start, vol, tfMs){
  const c=[]; let p=start;
  const sd=new Date(2024,0,2,9,0,0);
  for(let i=0;i<n;i++){
    const dt=new Date(sd.getTime()+i*tfMs);
    const trend=(Math.random()-.47)*vol;
    const o=p, cl=p+trend;
    const hi=Math.max(o,cl)+Math.random()*vol*.4;
    const lo=Math.min(o,cl)-Math.random()*vol*.4;
    c.push({dt,o:+o.toFixed(2),h:+hi.toFixed(2),l:+lo.toFixed(2),c:+cl.toFixed(2),v:+(200+Math.random()*800).toFixed(0),sess:getSession(dt.getHours())});
    p=cl;
  }
  return c;
}

// ─── FORMAT ───────────────────────────────────────────────────────────────────
function fmt(n){
  if(n>=1000) return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  if(n<10)    return n.toFixed(4);
  return n.toFixed(2);
}
function fmtDate(dt,tf){
  const d=dt.getDate().toString().padStart(2,"0");
  const mo=(dt.getMonth()+1).toString().padStart(2,"0");
  const h=dt.getHours().toString().padStart(2,"0");
  const mi=dt.getMinutes().toString().padStart(2,"0");
  if(tf==="1D") return `${d}/${mo}/${dt.getFullYear()}`;
  return `${d}/${mo} ${h}:${mi}`;
}

// ─── TOOL GROUPS ──────────────────────────────────────────────────────────────
const TOOL_GROUPS = [
  { id:"lines", label:"Líneas", tools:[
    { id:"cursor",   icon:"⊹",  label:"Cursor" },
    { id:"tline",    icon:"╱",  label:"Trend Line" },
    { id:"hline",    icon:"─",  label:"Horizontal Line" },
    { id:"hray",     icon:"→",  label:"Horizontal Ray" },
    { id:"vline",    icon:"│",  label:"Vertical Line" },
  ]},
  { id:"shapes", label:"Formas", tools:[
    { id:"rect",     icon:"▭",  label:"Rectangle" },
    { id:"circle",   icon:"○",  label:"Circle" },
    { id:"path",     icon:"✏", label:"Path" },
    { id:"brush",    icon:"🖌", label:"Brush" },
  ]},
  { id:"projection", label:"Proyecciones", tools:[
    { id:"longpos",  icon:"▲",  label:"Long Position" },
    { id:"shortpos", icon:"▼",  label:"Short Position" },
    { id:"pricerange",icon:"↕", label:"Price Range" },
    { id:"daterange", icon:"↔", label:"Date Range" },
  ]},
  { id:"annotations", label:"Anotaciones", tools:[
    { id:"text",     icon:"T",  label:"Text" },
    { id:"arrow",    icon:"↑",  label:"Arrow Marker" },
    { id:"arrowup",  icon:"⬆", label:"Arrow Up" },
    { id:"arrowdown",icon:"⬇", label:"Arrow Down" },
  ]},
];

const DEFAULT_FAVS = ["cursor","tline","hline","rect","longpos","shortpos","text","arrowup","arrowdown"];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App(){
  const [asset,  setAsset]  = useState("NQ");
  const [tf,     setTf]     = useState("15m");
  const [theme,  setTheme]  = useState("dark");
  const [lang,   setLang]   = useState("es");
  const [candles,setCandles]= useState([]);
  const [idx,    setIdx]    = useState(120);
  const [playing,setPlaying]= useState(false);
  const [speed,  setSpeed]  = useState(2);
  const [tool,   setTool]   = useState("cursor");
  const [favs,   setFavs]   = useState(DEFAULT_FAVS);
  const [showToolMenu, setShowToolMenu] = useState(false);
  const [showNY,   setShowNY]   = useState(true);
  const [showLON,  setShowLON]  = useState(true);
  const [showASIA, setShowASIA] = useState(true);
  const [showMA,   setShowMA]   = useState(true);
  const [showEMA,  setShowEMA]  = useState(true);
  const [showRSI,  setShowRSI]  = useState(false);
  const [pos,    setPos]    = useState(null);
  const [capital,setCapital]= useState(10000);
  const [lots,   setLots]   = useState(1);
  const [sl,     setSl]     = useState("");
  const [tp,     setTp]     = useState("");
  const [trades, setTrades] = useState([]);
  const [totalPnl,setTotalPnl]=useState(0);
  const [maxCap, setMaxCap] = useState(10000);
  const [crosshair,setCrosshair]=useState(null);
  const [jumpDate, setJumpDate]=useState("");
  const [jumpTime, setJumpTime]=useState("09:00");
  const [drawings,setDrawings]=useState([]);
  const [selectedDrawing, setSelectedDrawing]=useState(null);
  const [drawStart,setDrawStart]=useState(null);
  const [zoomLevel,setZoomLevel]=useState(0);
  const [panOffset,setPanOffset]=useState(0);
  const [activeTab,setActiveTab]=useState("orders");
  const [commission,setCommission]=useState(2.5);
  const [slippage,setSlippage]=useState(0.5);
  const [magnet,setMagnet]=useState(false);
  const [barTimer,setBarTimer]=useState(0);
  const [showObjectTree,setShowObjectTree]=useState(false);

  const canvasRef = useRef(null);
  const volRef    = useRef(null);
  const timerRef  = useRef(null);
  const barTimerRef = useRef(null);

  const isDark  = theme==="dark";
  const bg      = isDark?"#131722":"#ffffff";
  const bgCard  = isDark?"#1e222d":"#f0f3fa";
  const bgCard2 = isDark?"#161b27":"#e8ecf5";
  const border  = isDark?"#2a2e39":"#d1d5db";
  const text    = isDark?"#d1d4dc":"#131722";
  const textSec = isDark?"#787b86":"#6b7280";
  const upCol   = "#26a69a";
  const dnCol   = "#ef5350";
  const visibleCount = Math.max(20, VISIBLE_DEFAULT - zoomLevel);

  // ── RESET ─────────────────────────────────────────────────────────────────
  const reset = useCallback(()=>{
    const a = ASSETS[asset];
    setCandles(genCandles(600, a.base, a.vol, TF_MS[tf]));
    setIdx(120); setPlaying(false); setPos(null);
    setCapital(10000); setTrades([]); setTotalPnl(0); setMaxCap(10000);
    setSl(""); setTp(""); setDrawings([]); setSelectedDrawing(null);
    setPanOffset(0); setZoomLevel(0);
  },[asset,tf]);

  useEffect(()=>{ reset(); },[reset]);

  // ── REPLAY TIMER ──────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!playing){ clearInterval(timerRef.current); return; }
    const delays=[800,400,180,80,20];
    timerRef.current=setInterval(()=>{
      setIdx(i=>{ if(i>=candles.length){setPlaying(false);return i;} return i+1; });
    },delays[speed-1]);
    return()=>clearInterval(timerRef.current);
  },[playing,speed,candles.length]);

  // ── BAR CLOSE TIMER ───────────────────────────────────────────────────────
  useEffect(()=>{
    clearInterval(barTimerRef.current);
    if(!candles.length||!candles[idx-1]) return;
    const tfMs = TF_MS[tf];
    barTimerRef.current=setInterval(()=>{
      const now = Date.now();
      const lastBar = candles[idx-1].dt.getTime();
      const next = lastBar + tfMs;
      const remaining = Math.max(0, Math.floor((next-lastBar)/1000 - (now%tfMs)/1000));
      setBarTimer(remaining%tfMs);
    },1000);
    return()=>clearInterval(barTimerRef.current);
  },[idx,candles,tf]);

  // ── INDICATORS ────────────────────────────────────────────────────────────
  function maCalc(data,p){ return data.map((_,i)=>i<p-1?null:data.slice(i-p+1,i+1).reduce((a,c)=>a+c.c,0)/p); }
  function emaCalc(data,p){
    const k=2/(p+1); const o=[]; let pv=null;
    for(let i=0;i<data.length;i++){
      if(i<p-1){o.push(null);continue;}
      if(!pv){pv=data.slice(0,p).reduce((a,c)=>a+c.c,0)/p;o.push(pv);continue;}
      pv=data[i].c*k+pv*(1-k); o.push(pv);
    }
    return o;
  }
  function rsiCalc(data,p=14){
    const out=[];
    for(let i=0;i<data.length;i++){
      if(i<p){out.push(null);continue;}
      const changes=data.slice(i-p+1,i+1).map((d,j,a)=>j===0?0:d.c-a[j-1].c);
      const gains=changes.filter(c=>c>0).reduce((a,b)=>a+b,0)/p;
      const losses=Math.abs(changes.filter(c=>c<0).reduce((a,b)=>a+b,0))/p;
      const rs=losses===0?100:gains/losses;
      out.push(100-(100/(1+rs)));
    }
    return out;
  }

  // ── DERIVED ───────────────────────────────────────────────────────────────
  const last = candles[idx-1];
  const assetInfo = ASSETS[asset];
  const calcPnl = price=>pos?(pos.type==="long"?price-pos.entry:pos.entry-price)*pos.lots:0;
  const livePnl = last&&pos?calcPnl(last.c):0;
  const wins    = trades.filter(t=>t.pnl>0).length;
  const losses  = trades.length-wins;
  const avgWin  = wins>0?trades.filter(t=>t.pnl>0).reduce((a,t)=>a+t.pnl,0)/wins:0;
  const avgLoss = losses>0?Math.abs(trades.filter(t=>t.pnl<=0).reduce((a,t)=>a+t.pnl,0)/losses):0;
  const rrRatio = avgLoss>0?(avgWin/avgLoss).toFixed(2):"—";
  const drawdown= maxCap>0?((maxCap-(capital+livePnl))/maxCap*100).toFixed(1):0;

  // ── CHART DRAW ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const cv=canvasRef.current;
    const vc=volRef.current;
    if(!cv||!vc||!candles.length) return;
    const wrap=cv.parentElement;
    const W=wrap.clientWidth, H=wrap.clientHeight;
    cv.width=W; cv.height=H;
    const ctx=cv.getContext("2d");
    ctx.clearRect(0,0,W,H);

    const data=candles.slice(0,idx);
    const startIdx=Math.max(0,data.length-visibleCount+panOffset);
    const slice=data.slice(Math.max(0,startIdx),Math.min(data.length,startIdx+visibleCount));
    const off=Math.max(0,startIdx);
    if(!slice.length) return;

    const pad={t:28,b:28,l:4,r:80};
    const cw=(W-pad.l-pad.r)/visibleCount;
    const rawMin=Math.min(...slice.map(d=>d.l));
    const rawMax=Math.max(...slice.map(d=>d.h));
    const margin=(rawMax-rawMin)*0.05;
    const minP=rawMin-margin, maxP=rawMax+margin;
    const rng=maxP-minP||1;
    const sy=v=>pad.t+(maxP-v)/rng*(H-pad.t-pad.b);
    const sx=i=>pad.l+i*cw+cw*0.5;

    // BG
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    // Sessions
    slice.forEach((cd,i)=>{
      const x=pad.l+i*cw;
      if(showNY   &&cd.sess==="ny")  {ctx.fillStyle="rgba(59,130,246,.08)"; ctx.fillRect(x,pad.t,cw,H-pad.t-pad.b);}
      if(showLON  &&cd.sess==="lon") {ctx.fillStyle="rgba(168,85,247,.08)"; ctx.fillRect(x,pad.t,cw,H-pad.t-pad.b);}
      if(showASIA &&cd.sess==="asia"){ctx.fillStyle="rgba(245,158,11,.06)";  ctx.fillRect(x,pad.t,cw,H-pad.t-pad.b);}
    });

    // Grid
    for(let i=0;i<=8;i++){
      const y=pad.t+i*(H-pad.t-pad.b)/8;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y);
      ctx.strokeStyle=isDark?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)";
      ctx.lineWidth=0.5; ctx.stroke();
      ctx.fillStyle=textSec; ctx.font="10px monospace"; ctx.textAlign="right";
      ctx.fillText(fmt(maxP-(i/8)*rng), W-4, y+3);
    }
    const gstep=Math.max(1,Math.floor(visibleCount/8));
    for(let i=0;i<slice.length;i+=gstep){
      const x=sx(i);
      ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,H-pad.b);
      ctx.strokeStyle=isDark?"rgba(255,255,255,.03)":"rgba(0,0,0,.03)";
      ctx.lineWidth=0.5; ctx.stroke();
    }

    // MA / EMA
    const cd0=candles.slice(0,idx);
    if(showMA){
      const arr=maCalc(cd0,20);
      ctx.beginPath(); let s=false;
      slice.forEach((_,i)=>{const v=arr[off+i];if(v==null)return;s?ctx.lineTo(sx(i),sy(v)):(ctx.moveTo(sx(i),sy(v)),s=true);});
      ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1.2; ctx.stroke();
    }
    if(showEMA){
      const arr=emaCalc(cd0,50);
      ctx.beginPath(); let s=false;
      slice.forEach((_,i)=>{const v=arr[off+i];if(v==null)return;s?ctx.lineTo(sx(i),sy(v)):(ctx.moveTo(sx(i),sy(v)),s=true);});
      ctx.strokeStyle="#3b82f6"; ctx.lineWidth=1.2; ctx.stroke();
    }

    // Candles
    slice.forEach((cd,i)=>{
      const x=sx(i), bw=Math.max(1,cw*0.55);
      const bull=cd.c>=cd.o, col=bull?upCol:dnCol;
      ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,sy(cd.h)); ctx.lineTo(x,sy(cd.l)); ctx.stroke();
      const bt=sy(Math.max(cd.o,cd.c)), bb2=sy(Math.min(cd.o,cd.c));
      ctx.fillRect(x-bw/2,bt,bw,Math.max(1,bb2-bt));
    });

    // ── DRAWINGS ────────────────────────────────────────────────────────────
    drawings.forEach((d,di)=>{
      const isSel=selectedDrawing===di;
      ctx.setLineDash([]);

      // Convert stored price coords to screen coords
      const y1s=d.price1!==undefined?sy(d.price1):d.y1;
      const y2s=d.price2!==undefined?sy(d.price2):d.y2;
      const x1s=d.bar1!==undefined?pad.l+(d.bar1-off)*cw+cw*0.5:d.x1;
      const x2s=d.bar2!==undefined?pad.l+(d.bar2-off)*cw+cw*0.5:d.x2;

      ctx.strokeStyle=isSel?"#fff":d.color||"#f59e0b";
      ctx.lineWidth=isSel?2:1.2;

      if(d.type==="hline"||d.type==="hray"){
        const y=sy(d.price1);
        ctx.beginPath();
        ctx.moveTo(d.type==="hray"?x1s:pad.l,y);
        ctx.lineTo(W-pad.r,y);
        ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle=d.color||"#f59e0b";
        ctx.font="10px monospace"; ctx.textAlign="right";
        ctx.fillText(fmt(d.price1),W-pad.r-4,y-3);
      }
      if(d.type==="vline"){
        const x=pad.l+(d.bar1-off)*cw+cw*0.5;
        ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,H-pad.b);
        ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([]);
      }
      if(d.type==="tline"&&x2s!==undefined){
        ctx.beginPath(); ctx.moveTo(x1s,y1s); ctx.lineTo(x2s,y2s);
        ctx.stroke();
        // Extend line
        if(x2s!==x1s){
          const slope=(y2s-y1s)/(x2s-x1s);
          const yEnd=y1s+slope*(W-pad.r-x1s);
          ctx.beginPath(); ctx.moveTo(x2s,y2s); ctx.lineTo(W-pad.r,yEnd);
          ctx.strokeStyle=(d.color||"#f59e0b")+"66"; ctx.stroke();
        }
      }
      if(d.type==="rect"&&x2s!==undefined){
        ctx.fillStyle=(d.color||"rgba(59,130,246,.08)");
        ctx.fillRect(x1s,y1s,x2s-x1s,y2s-y1s);
        ctx.strokeRect(x1s,y1s,x2s-x1s,y2s-y1s);
      }
      if(d.type==="circle"&&x2s!==undefined){
        const rx=Math.abs(x2s-x1s)/2, ry=Math.abs(y2s-y1s)/2;
        const cx2=(x1s+x2s)/2, cy=(y1s+y2s)/2;
        ctx.beginPath(); ctx.ellipse(cx2,cy,rx,ry,0,0,Math.PI*2);
        ctx.fillStyle="rgba(168,85,247,.08)"; ctx.fill(); ctx.stroke();
      }
      if(d.type==="longpos"&&y2s!==undefined){
        const entryY=sy(d.price1);
        const tpY=d.price2!==undefined?sy(d.price2):entryY-50;
        const slY=d.price3!==undefined?sy(d.price3):entryY+30;
        ctx.fillStyle="rgba(38,166,154,.12)"; ctx.fillRect(pad.l,tpY,W-pad.r-pad.l,entryY-tpY);
        ctx.fillStyle="rgba(239,83,80,.12)";  ctx.fillRect(pad.l,entryY,W-pad.r-pad.l,slY-entryY);
        ctx.beginPath(); ctx.moveTo(pad.l,entryY); ctx.lineTo(W-pad.r,entryY); ctx.strokeStyle=upCol; ctx.lineWidth=1.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad.l,tpY);    ctx.lineTo(W-pad.r,tpY);    ctx.strokeStyle=upCol; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(pad.l,slY);    ctx.lineTo(W-pad.r,slY);    ctx.strokeStyle=dnCol; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
        const rr=d.price2&&d.price3?((d.price2-d.price1)/(d.price1-d.price3)).toFixed(2):"?";
        ctx.fillStyle=upCol; ctx.font="bold 10px monospace"; ctx.textAlign="left";
        ctx.fillText(`▲ LONG ${fmt(d.price1)}  R:R ${rr}`,pad.l+4,entryY-4);
      }
      if(d.type==="shortpos"&&y2s!==undefined){
        const entryY=sy(d.price1);
        const tpY=d.price2!==undefined?sy(d.price2):entryY+50;
        const slY=d.price3!==undefined?sy(d.price3):entryY-30;
        ctx.fillStyle="rgba(239,83,80,.12)";  ctx.fillRect(pad.l,entryY,W-pad.r-pad.l,tpY-entryY);
        ctx.fillStyle="rgba(38,166,154,.12)"; ctx.fillRect(pad.l,slY,W-pad.r-pad.l,entryY-slY);
        ctx.beginPath(); ctx.moveTo(pad.l,entryY); ctx.lineTo(W-pad.r,entryY); ctx.strokeStyle=dnCol; ctx.lineWidth=1.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad.l,tpY);    ctx.lineTo(W-pad.r,tpY);    ctx.strokeStyle=dnCol; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(pad.l,slY);    ctx.lineTo(W-pad.r,slY);    ctx.strokeStyle=upCol; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
        const rr=d.price2&&d.price3?((d.price1-d.price2)/(d.price3-d.price1)).toFixed(2):"?";
        ctx.fillStyle=dnCol; ctx.font="bold 10px monospace"; ctx.textAlign="left";
        ctx.fillText(`▼ SHORT ${fmt(d.price1)}  R:R ${rr}`,pad.l+4,entryY+12);
      }
      if(d.type==="pricerange"&&d.price2!==undefined){
        const y1r=sy(d.price1), y2r=sy(d.price2);
        ctx.fillStyle="rgba(59,130,246,.08)"; ctx.fillRect(pad.l,Math.min(y1r,y2r),W-pad.r-pad.l,Math.abs(y2r-y1r));
        ctx.strokeStyle="#3b82f6"; ctx.setLineDash([3,3]); ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(pad.l,y1r); ctx.lineTo(W-pad.r,y1r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad.l,y2r); ctx.lineTo(W-pad.r,y2r); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle="#3b82f6"; ctx.font="bold 10px monospace"; ctx.textAlign="left";
        ctx.fillText(`Δ ${fmt(Math.abs(d.price1-d.price2))}`,pad.l+4,(y1r+y2r)/2+4);
      }
      if(d.type==="text"){
        ctx.fillStyle=d.color||"#f59e0b"; ctx.font="12px monospace"; ctx.textAlign="left";
        ctx.fillText(d.text||"Note",d.x,d.y);
      }
      if(d.type==="arrowup"||d.type==="arrowdown"){
        ctx.fillStyle=d.type==="arrowup"?upCol:dnCol;
        ctx.font="18px monospace"; ctx.textAlign="center";
        ctx.fillText(d.type==="arrowup"?"⬆":"⬇",d.x,d.y);
      }

      // Selection handles
      if(isSel&&x1s!==undefined){
        ctx.fillStyle="#fff";
        [[x1s,y1s],[x2s,y2s]].forEach(([hx,hy])=>{
          if(hx!==undefined&&hy!==undefined){ctx.beginPath();ctx.arc(hx,hy,4,0,Math.PI*2);ctx.fill();}
        });
      }
    });

    // Active draw preview
    if(drawStart&&crosshair){
      ctx.setLineDash([4,3]);
      ctx.strokeStyle="rgba(245,158,11,.7)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(drawStart.x,drawStart.y); ctx.lineTo(crosshair.x,crosshair.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── ACTIVE POSITION ─────────────────────────────────────────────────────
    if(pos){
      const ey=sy(pos.entry);
      ctx.beginPath(); ctx.moveTo(pad.l,ey); ctx.lineTo(W-pad.r,ey);
      ctx.strokeStyle=pos.type==="long"?"rgba(38,166,154,.9)":"rgba(239,83,80,.9)";
      ctx.lineWidth=1.5; ctx.setLineDash([5,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=pos.type==="long"?upCol:dnCol;
      ctx.fillRect(W-pad.r+2,ey-10,pad.r-4,20);
      ctx.fillStyle="#fff"; ctx.font="bold 9px monospace"; ctx.textAlign="center";
      ctx.fillText(fmt(pos.entry),W-pad.r/2,ey+4);
      if(+sl>0){
        const sly=sy(+sl);
        ctx.beginPath(); ctx.moveTo(pad.l,sly); ctx.lineTo(W-pad.r,sly);
        ctx.strokeStyle="rgba(239,83,80,.7)"; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle="#ef5350"; ctx.font="9px monospace"; ctx.textAlign="left";
        ctx.fillText("SL "+fmt(+sl),pad.l+4,sly-3);
      }
      if(+tp>0){
        const tpy=sy(+tp);
        ctx.beginPath(); ctx.moveTo(pad.l,tpy); ctx.lineTo(W-pad.r,tpy);
        ctx.strokeStyle="rgba(38,166,154,.7)"; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle="#26a69a"; ctx.font="9px monospace"; ctx.textAlign="left";
        ctx.fillText("TP "+fmt(+tp),pad.l+4,tpy-3);
      }
      if(last){
        const pnl=calcPnl(last.c);
        const midY=(ey+sy(last.c))/2;
        ctx.fillStyle=pnl>=0?"rgba(38,166,154,.85)":"rgba(239,83,80,.85)";
        ctx.fillRect(pad.l+4,midY-10,100,20);
        ctx.fillStyle="#fff"; ctx.font="bold 9px monospace"; ctx.textAlign="left";
        ctx.fillText((pnl>=0?"+":"")+pnl.toFixed(2)+" USD",pad.l+8,midY+4);
      }
    }

    // Price tag
    if(last){
      const ly=sy(last.c);
      ctx.fillStyle=last.c>=last.o?upCol:dnCol;
      ctx.fillRect(W-pad.r+2,ly-10,pad.r-4,20);
      ctx.fillStyle="#fff"; ctx.font="bold 10px monospace"; ctx.textAlign="center";
      ctx.fillText(fmt(last.c),W-pad.r/2,ly+4);
    }

    // Crosshair
    if(crosshair){
      ctx.strokeStyle=isDark?"rgba(255,255,255,.2)":"rgba(0,0,0,.2)";
      ctx.lineWidth=0.5; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(crosshair.x,pad.t); ctx.lineTo(crosshair.x,H-pad.b); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l,crosshair.y); ctx.lineTo(W-pad.r,crosshair.y); ctx.stroke();
      ctx.setLineDash([]);
      const price=maxP-(crosshair.y-pad.t)/(H-pad.t-pad.b)*rng;
      ctx.fillStyle=isDark?"#363a45":"#d1d5db";
      ctx.fillRect(W-pad.r+2,crosshair.y-9,pad.r-4,18);
      ctx.fillStyle=text; ctx.font="9px monospace"; ctx.textAlign="center";
      ctx.fillText(fmt(price),W-pad.r/2,crosshair.y+4);
      const barI=Math.floor((crosshair.x-pad.l)/cw);
      if(barI>=0&&barI<slice.length){
        const lw=ctx.measureText(fmtDate(slice[barI].dt,tf)).width+12;
        ctx.fillStyle=isDark?"#363a45":"#d1d5db";
        ctx.fillRect(crosshair.x-lw/2,H-pad.b,lw,16);
        ctx.fillStyle=text; ctx.font="9px monospace"; ctx.textAlign="center";
        ctx.fillText(fmtDate(slice[barI].dt,tf),crosshair.x,H-pad.b+11);
      }
    }

    // Date axis
    ctx.fillStyle=textSec; ctx.font="10px monospace"; ctx.textAlign="center";
    for(let i=0;i<slice.length;i+=gstep){
      ctx.fillText(fmtDate(slice[i].dt,tf),sx(i),H-6);
    }

    // ── VOLUME ──────────────────────────────────────────────────────────────
    vc.width=W; vc.height=55;
    const vctx=vc.getContext("2d"); vctx.clearRect(0,0,W,55);
    vctx.fillStyle=bg; vctx.fillRect(0,0,W,55);
    const maxV=Math.max(...slice.map(d=>d.v));
    const vcw=(W-pad.l-pad.r)/visibleCount;
    slice.forEach((cd,i)=>{
      vctx.fillStyle=cd.c>=cd.o?"rgba(38,166,154,.4)":"rgba(239,83,80,.4)";
      const bh=(cd.v/maxV)*50;
      vctx.fillRect(pad.l+i*vcw+1,55-bh,vcw-2,bh);
    });

  },[idx,candles,showMA,showEMA,showNY,showLON,showASIA,pos,sl,tp,crosshair,drawings,selectedDrawing,theme,visibleCount,panOffset,drawStart]);

  // ── CHART HELPERS ─────────────────────────────────────────────────────────
  function getCoords(e){
    const r=canvasRef.current.getBoundingClientRect();
    return{x:e.clientX-r.left, y:e.clientY-r.top};
  }
  function getPriceAtY(y){
    const cv=canvasRef.current; const H=cv.height;
    const pad={t:28,b:28};
    const data=candles.slice(0,idx);
    const startIdx=Math.max(0,data.length-visibleCount+panOffset);
    const slice=data.slice(Math.max(0,startIdx),Math.min(data.length,startIdx+visibleCount));
    const rawMin=Math.min(...slice.map(d=>d.l));
    const rawMax=Math.max(...slice.map(d=>d.h));
    const margin=(rawMax-rawMin)*0.05;
    const minP=rawMin-margin, maxP=rawMax+margin;
    const rng=maxP-minP||1;
    return maxP-(y-pad.t)/(H-pad.t-pad.b)*rng;
  }
  function getBarAtX(x){
    const cv=canvasRef.current; const W=cv.width;
    const pad={l:4,r:80};
    const cw=(W-pad.l-pad.r)/visibleCount;
    const data=candles.slice(0,idx);
    const startIdx=Math.max(0,data.length-visibleCount+panOffset);
    return startIdx+Math.floor((x-pad.l)/cw);
  }
  function snapToCandle(price){
    if(!magnet||!last) return price;
    const snaps=[last.o,last.h,last.l,last.c];
    return snaps.reduce((a,b)=>Math.abs(b-price)<Math.abs(a-price)?b:a);
  }

  // ── CANVAS EVENTS ─────────────────────────────────────────────────────────
  function handleMouseMove(e){
    const c=getCoords(e);
    if(magnet){ const p=getPriceAtY(c.y); const snapped=snapToCandle(p); const cv=canvasRef.current; const H=cv.height; const pad={t:28,b:28}; const data=candles.slice(0,idx); const startIdx=Math.max(0,data.length-visibleCount+panOffset); const slice=data.slice(Math.max(0,startIdx),Math.min(data.length,startIdx+visibleCount)); const rawMin=Math.min(...slice.map(d=>d.l)); const rawMax=Math.max(...slice.map(d=>d.h)); const margin=(rawMax-rawMin)*0.05; const maxP=rawMax+margin; const rng=(rawMax+margin)-(rawMin-margin)||1; const sy2=v=>pad.t+(maxP-v)/rng*(H-pad.t-pad.b); setCrosshair({x:c.x,y:sy2(snapped)}); }
    else setCrosshair(c);
  }
  function handleMouseDown(e){
    const c=getCoords(e);
    if(["tline","rect","circle","longpos","shortpos","pricerange","daterange"].includes(tool)) setDrawStart(c);
  }
  function handleMouseUp(e){
    if(!drawStart) return;
    const c=getCoords(e);
    const price1=snapToCandle(getPriceAtY(drawStart.y));
    const price2=snapToCandle(getPriceAtY(c.y));
    const bar1=getBarAtX(drawStart.x);
    const bar2=getBarAtX(c.x);
    const newD={type:tool,price1,price2,bar1,bar2,x1:drawStart.x,y1:drawStart.y,x2:c.x,y2:c.y,color:tool==="rect"?"rgba(59,130,246,.08)":tool==="longpos"?upCol:tool==="shortpos"?dnCol:"#f59e0b"};
    setDrawings(d=>[...d,newD]);
    setDrawStart(null);
    setTool("cursor");
  }
  function handleClick(e){
    if(drawStart) return;
    const c=getCoords(e);
    const price=snapToCandle(getPriceAtY(c.y));
    const bar=getBarAtX(c.x);
    if(tool==="hline")    {setDrawings(d=>[...d,{type:"hline",price1:price,color:"#f59e0b"}]);setTool("cursor");}
    if(tool==="hray")     {setDrawings(d=>[...d,{type:"hray",price1:price,bar1:bar,color:"#f59e0b"}]);setTool("cursor");}
    if(tool==="vline")    {setDrawings(d=>[...d,{type:"vline",bar1:bar,color:"#787b86"}]);setTool("cursor");}
    if(tool==="arrowup")  {setDrawings(d=>[...d,{type:"arrowup",x:c.x,y:c.y}]);setTool("cursor");}
    if(tool==="arrowdown"){setDrawings(d=>[...d,{type:"arrowdown",x:c.x,y:c.y}]);setTool("cursor");}
    if(tool==="text")     {const t2=prompt("Texto:");if(t2)setDrawings(d=>[...d,{type:"text",x:c.x,y:c.y,text:t2,color:"#f59e0b"}]);setTool("cursor");}
    // Click on existing drawing to select
    if(tool==="cursor"){
      let found=null;
      drawings.forEach((d,i)=>{
        if(d.type==="hline"&&Math.abs(getPriceAtY(c.y)-d.price1)<(getPriceAtY(0)-getPriceAtY(10))) found=i;
      });
      setSelectedDrawing(found);
    }
  }
  function handleWheel(e){
    e.preventDefault();
    setZoomLevel(z=>Math.max(-40,Math.min(60,z+(e.deltaY>0?-3:3))));
  }
  function handleKeyDown(e){
    if(e.key==="Delete"&&selectedDrawing!==null){
      setDrawings(d=>d.filter((_,i)=>i!==selectedDrawing));
      setSelectedDrawing(null);
    }
  }

  // ── TRADE ACTIONS ─────────────────────────────────────────────────────────
  function enterTrade(type){
    if(pos||!last) return;
    const entryPrice=last.c+(type==="long"?assetInfo.tick:-assetInfo.tick)*slippage;
    setPos({type,entry:+entryPrice.toFixed(2),lots:+lots});
  }
  function closeTrade(){
    if(!pos||!last) return;
    const exitPrice=last.c+(pos.type==="long"?-assetInfo.tick:assetInfo.tick)*slippage;
    const pnl=calcPnl(exitPrice)-(commission*2*pos.lots);
    setCapital(c=>{ const nc=c+pnl; setMaxCap(m=>Math.max(m,nc)); return nc; });
    setTotalPnl(p=>p+pnl);
    setTrades(prev=>[{type:pos.type,entry:pos.entry,exit:+exitPrice.toFixed(2),pnl,lots:pos.lots,date:last.dt},...prev].slice(0,50));
    setPos(null); setSl(""); setTp("");
  }
  function jumpToDate(){
    if(!jumpDate) return;
    const target=new Date(`${jumpDate}T${jumpTime}`);
    const i=candles.findIndex(c=>c.dt>=target);
    if(i>0) setIdx(i+1);
  }
  function toggleFav(id){setFavs(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id]);}

  const allTools=TOOL_GROUPS.flatMap(g=>g.tools);
  const favTools=allTools.filter(t=>favs.includes(t.id));
  const riskAmt=pos&&+sl>0?Math.abs((pos.type==="long"?pos.entry-+sl:+sl-pos.entry)*pos.lots):pos?pos.entry*0.003*pos.lots:0;

  const lbl=lang==="es"
    ?{replay:"Replay",pausar:"Pausar",cerrar:"Cerrar",balance:"Balance",riesgo:"Riesgo",ganancia:"Ganancia",ops:"Ops",wr:"Win Rate",jump:"Ir a fecha",tools:"Herramientas",orders:"Órdenes",positions:"Posiciones",history:"Historial",stats:"Estadísticas"}
    :{replay:"Replay",pausar:"Pause",cerrar:"Close",balance:"Balance",riesgo:"Risk",ganancia:"P&L",ops:"Trades",wr:"Win Rate",jump:"Go to",tools:"Tools",orders:"Orders",positions:"Positions",history:"History",stats:"Stats"};

  const btnS=(active,col="#3b82f6")=>({fontSize:11,padding:"3px 8px",border:`0.5px solid ${active?col:border}`,borderRadius:4,cursor:"pointer",background:active?`${col}22`:"transparent",color:active?col:textSec});

  return(
    <div style={{background:bg,height:"100vh",color:text,fontFamily:"'Segoe UI',monospace",display:"flex",flexDirection:"column",overflow:"hidden"}} onKeyDown={handleKeyDown} tabIndex={0}>

      {/* ── TOP BAR ── */}
      <div style={{background:bgCard,borderBottom:`1px solid ${border}`,padding:"5px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",zIndex:10,minHeight:36}}>
        <span style={{fontSize:14,fontWeight:700}}>NQ<span style={{color:"#f59e0b"}}>Gold</span><span style={{color:textSec,fontWeight:400}}> Testing</span></span>
        <div style={{width:1,height:16,background:border}}/>
        <select value={asset} onChange={e=>setAsset(e.target.value)} style={{fontSize:12,padding:"2px 6px",border:`0.5px solid ${border}`,borderRadius:4,background:bgCard,color:text,cursor:"pointer"}}>
          {Object.entries(ASSETS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        {last&&<span style={{fontSize:11,color:textSec}}>
          O:<b style={{color:text,marginLeft:2}}>{fmt(last.o)}</b>{" "}
          H:<b style={{color:upCol,marginLeft:2}}>{fmt(last.h)}</b>{" "}
          L:<b style={{color:dnCol,marginLeft:2}}>{fmt(last.l)}</b>{" "}
          C:<b style={{color:last.c>=last.o?upCol:dnCol,marginLeft:2}}>{fmt(last.c)}</b>
        </span>}
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:10,color:textSec}}>Bar: <b style={{color:text}}>{Math.floor(barTimer/60).toString().padStart(2,"0")}:{(barTimer%60).toString().padStart(2,"0")}</b></span>
          {pos&&<span style={{fontSize:12,fontWeight:700,color:livePnl>=0?upCol:dnCol,background:livePnl>=0?"rgba(38,166,154,.1)":"rgba(239,83,80,.1)",padding:"2px 8px",borderRadius:4}}>{livePnl>=0?"+":""}{livePnl.toFixed(2)}</span>}
          <span style={{fontSize:11,color:textSec}}>{lbl.balance}: <b style={{color:text}}>${(capital+livePnl).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></span>
          <button onClick={()=>setMagnet(m=>!m)} style={btnS(magnet,"#f59e0b")} title="Magnet Mode">🧲</button>
          <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} style={btnS(false)}>{isDark?"☀️":"🌙"}</button>
          <button onClick={()=>setLang(l=>l==="es"?"en":"es")} style={btnS(false)}>{lang.toUpperCase()}</button>
        </div>
      </div>

      {/* ── TF + SESSIONS ── */}
      <div style={{background:bgCard2,borderBottom:`1px solid ${border}`,padding:"3px 12px",display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",minHeight:30}}>
        {Object.keys(TF_MS).map(t=><button key={t} onClick={()=>setTf(t)} style={btnS(tf===t)}>{t}</button>)}
        <div style={{width:1,height:14,background:border,margin:"0 4px"}}/>
        <button style={btnS(showNY,"#3b82f6")}    onClick={()=>setShowNY(v=>!v)}>● NY</button>
        <button style={btnS(showLON,"#a855f7")}   onClick={()=>setShowLON(v=>!v)}>● LON</button>
        <button style={btnS(showASIA,"#f59e0b")}  onClick={()=>setShowASIA(v=>!v)}>● ASIA</button>
        <div style={{width:1,height:14,background:border,margin:"0 4px"}}/>
        <button style={btnS(showMA,"#f59e0b")}    onClick={()=>setShowMA(v=>!v)}>MA 20</button>
        <button style={btnS(showEMA,"#3b82f6")}   onClick={()=>setShowEMA(v=>!v)}>EMA 50</button>
        <button style={btnS(showRSI,"#a855f7")}   onClick={()=>setShowRSI(v=>!v)}>RSI</button>
        <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center"}}>
          <span style={{fontSize:11,color:textSec}}>📅</span>
          <input type="date" value={jumpDate} onChange={e=>setJumpDate(e.target.value)} style={{fontSize:11,padding:"2px 5px",border:`0.5px solid ${border}`,borderRadius:4,background:bgCard,color:text}}/>
          <input type="time" value={jumpTime} onChange={e=>setJumpTime(e.target.value)} style={{fontSize:11,padding:"2px 5px",border:`0.5px solid ${border}`,borderRadius:4,background:bgCard,color:text,width:75}}/>
          <button onClick={jumpToDate} style={{...btnS(false),border:`0.5px solid #3b82f6`,color:"#3b82f6",background:"rgba(59,130,246,.12)"}}>{lbl.jump}</button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* LEFT TOOLBAR */}
        <div style={{width:38,background:bgCard,borderRight:`1px solid ${border}`,display:"flex",flexDirection:"column",alignItems:"center",padding:"6px 0",gap:2,zIndex:10}}>
          {favTools.map(t=>(
            <button key={t.id} title={t.label} onClick={()=>setTool(t.id)}
              style={{width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,border:`0.5px solid ${tool===t.id?"#3b82f6":border}`,borderRadius:4,cursor:"pointer",background:tool===t.id?"rgba(59,130,246,.2)":"transparent",color:tool===t.id?"#3b82f6":textSec}}>
              {t.icon}
            </button>
          ))}
          <div style={{flex:1}}/>
          {/* Object Tree */}
          <button title="Object Tree" onClick={()=>setShowObjectTree(v=>!v)}
            style={{width:30,height:30,fontSize:12,border:`0.5px solid ${showObjectTree?"#3b82f6":border}`,borderRadius:4,cursor:"pointer",background:showObjectTree?"rgba(59,130,246,.2)":"transparent",color:showObjectTree?"#3b82f6":textSec}}>☰</button>
          {/* All Tools Menu */}
          <div style={{position:"relative"}}>
            <button title={lbl.tools} onClick={()=>setShowToolMenu(v=>!v)}
              style={{width:30,height:30,fontSize:13,border:`0.5px solid ${showToolMenu?"#3b82f6":border}`,borderRadius:4,cursor:"pointer",background:showToolMenu?"rgba(59,130,246,.2)":"transparent",color:showToolMenu?"#3b82f6":textSec}}>⚙</button>
            {showToolMenu&&(
              <div style={{position:"absolute",left:38,bottom:0,width:230,background:bgCard,border:`1px solid ${border}`,borderRadius:8,padding:"8px",zIndex:200,maxHeight:420,overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
                <div style={{fontSize:11,fontWeight:600,color:text,marginBottom:8}}>⭐ {lbl.tools}</div>
                {TOOL_GROUPS.map(g=>(
                  <div key={g.id} style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:textSec,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4,paddingBottom:3,borderBottom:`0.5px solid ${border}`}}>{g.label}</div>
                    {g.tools.map(t=>(
                      <div key={t.id} onClick={()=>{setTool(t.id);setShowToolMenu(false);}}
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 6px",borderRadius:4,cursor:"pointer",background:tool===t.id?"rgba(59,130,246,.15)":"transparent",marginBottom:2}}>
                        <span style={{fontSize:12,color:tool===t.id?"#3b82f6":text}}>{t.icon} {t.label}</span>
                        <span onClick={e=>{e.stopPropagation();toggleFav(t.id);}} style={{fontSize:13,cursor:"pointer",color:favs.includes(t.id)?"#f59e0b":textSec}}>
                          {favs.includes(t.id)?"★":"☆"}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* OBJECT TREE */}
        {showObjectTree&&(
          <div style={{width:160,background:bgCard,borderRight:`1px solid ${border}`,display:"flex",flexDirection:"column",padding:"8px",overflowY:"auto",zIndex:5}}>
            <div style={{fontSize:10,fontWeight:600,color:textSec,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Objetos ({drawings.length})</div>
            {drawings.length===0&&<span style={{fontSize:10,color:textSec}}>Sin dibujos</span>}
            {drawings.map((d,i)=>(
              <div key={i} onClick={()=>setSelectedDrawing(i===selectedDrawing?null:i)}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 6px",borderRadius:4,cursor:"pointer",background:selectedDrawing===i?"rgba(59,130,246,.2)":"transparent",marginBottom:2,border:`0.5px solid ${selectedDrawing===i?"#3b82f6":"transparent"}`}}>
                <span style={{fontSize:11,color:selectedDrawing===i?"#3b82f6":text}}>{d.type} {i+1}</span>
                <button onClick={e=>{e.stopPropagation();setDrawings(dr=>dr.filter((_,j)=>j!==i));if(selectedDrawing===i)setSelectedDrawing(null);}}
                  style={{fontSize:10,color:"#ef5350",background:"transparent",border:"none",cursor:"pointer",padding:"0 2px"}}>✕</button>
              </div>
            ))}
            {drawings.length>0&&<button onClick={()=>{setDrawings([]);setSelectedDrawing(null);}} style={{marginTop:8,fontSize:10,padding:"3px",border:`0.5px solid #ef535055`,borderRadius:4,cursor:"pointer",background:"transparent",color:"#ef5350"}}>Borrar todo</button>}
          </div>
        )}

        {/* CHART */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{position:"relative",flex:1}}>
            <canvas ref={canvasRef}
              style={{position:"absolute",top:0,left:0,cursor:tool==="cursor"?"crosshair":"crosshair"}}
              onMouseMove={handleMouseMove}
              onMouseLeave={()=>setCrosshair(null)}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onClick={handleClick}
              onWheel={handleWheel}
            />
          </div>
          <div style={{position:"relative",height:55,borderTop:`0.5px solid ${border}`}}>
            <canvas ref={volRef} style={{position:"absolute",top:0,left:0}}/>
          </div>

          {/* REPLAY BAR */}
          <div style={{background:bgCard2,borderTop:`1px solid ${border}`,padding:"4px 12px",display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>setIdx(i=>Math.max(1,i-10))} style={btnS(false)}>⏪</button>
            <button onClick={()=>setIdx(i=>Math.max(1,i-1))}  style={btnS(false)}>◀</button>
            <button onClick={()=>setPlaying(p=>!p)} style={{fontSize:12,padding:"3px 14px",border:"none",borderRadius:4,cursor:"pointer",fontWeight:700,background:playing?"rgba(245,158,11,.2)":"rgba(34,197,94,.2)",color:playing?"#f59e0b":"#22c55e"}}>
              {playing?`⏸ ${lbl.pausar}`:`▶ ${lbl.replay}`}
            </button>
            <button onClick={()=>setIdx(i=>Math.min(candles.length,i+1))}  style={btnS(false)}>▶</button>
            <button onClick={()=>setIdx(i=>Math.min(candles.length,i+10))} style={btnS(false)}>⏩</button>
            <span style={{fontSize:10,color:textSec}}>Vel:</span>
            <input type="range" min="1" max="5" value={speed} onChange={e=>setSpeed(+e.target.value)} style={{width:55}}/>
            <span style={{fontSize:10,color:textSec}}>x{speed}</span>
            <div style={{width:1,height:14,background:border}}/>
            {last&&<span style={{fontSize:10,color:text,fontWeight:500}}>{fmtDate(last.dt,tf)}</span>}
            <span style={{fontSize:10,color:textSec}}>| {idx}/{candles.length}</span>
            <div style={{marginLeft:"auto",display:"flex",gap:4}}>
              <button onClick={()=>setPanOffset(p=>Math.max(-100,p-10))} style={btnS(false)}>◂</button>
              <button onClick={()=>setPanOffset(p=>p+10)} style={btnS(false)}>▸</button>
              <button onClick={reset} title="Reiniciar" style={btnS(false)}>↺</button>
            </div>
          </div>

          {/* BOTTOM DASHBOARD */}
          <div style={{background:bgCard,borderTop:`1px solid ${border}`,height:140,display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",borderBottom:`0.5px solid ${border}`}}>
              {[["orders",lbl.orders],["positions",lbl.positions],["history",lbl.history],["stats",lbl.stats]].map(([id,label])=>(
                <button key={id} onClick={()=>setActiveTab(id)}
                  style={{fontSize:11,padding:"5px 12px",border:"none",cursor:"pointer",background:"transparent",color:activeTab===id?text:textSec,borderBottom:activeTab===id?`2px solid #3b82f6`:"2px solid transparent",fontWeight:activeTab===id?600:400}}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
              {activeTab==="orders"&&(
                <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:10,color:textSec,marginBottom:4}}>Comisión/lado</div>
                    <input type="number" value={commission} onChange={e=>setCommission(+e.target.value)} style={{width:60,fontSize:11,padding:"2px 4px",border:`0.5px solid ${border}`,borderRadius:4,background:"transparent",color:text}}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:textSec,marginBottom:4}}>Slippage (ticks)</div>
                    <input type="number" value={slippage} onChange={e=>setSlippage(+e.target.value)} style={{width:60,fontSize:11,padding:"2px 4px",border:`0.5px solid ${border}`,borderRadius:4,background:"transparent",color:text}}/>
                  </div>
                  {pos&&(
                    <div style={{background:isDark?"#0d1117":"#e8ecf5",borderRadius:6,padding:"8px 12px"}}>
                      <div style={{fontSize:10,color:textSec}}>Posición activa</div>
                      <div style={{fontSize:13,fontWeight:700,color:pos.type==="long"?upCol:dnCol}}>{pos.type==="long"?"▲ LONG":"▼ SHORT"} @ {fmt(pos.entry)}</div>
                      <div style={{fontSize:12,color:livePnl>=0?upCol:dnCol,fontWeight:600}}>{livePnl>=0?"+":""}{livePnl.toFixed(2)} USD</div>
                    </div>
                  )}
                </div>
              )}
              {activeTab==="positions"&&(
                pos
                  ?<div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:11}}>
                    {[["Tipo",pos.type==="long"?"▲ Long":"▼ Short"],["Entrada",fmt(pos.entry)],["Lots",pos.lots],["P&L",(livePnl>=0?"+":"")+livePnl.toFixed(2)],["SL",sl||"—"],["TP",tp||"—"]].map(([k,v])=>(
                      <div key={k}><div style={{color:textSec,fontSize:10}}>{k}</div><div style={{fontWeight:600}}>{v}</div></div>
                    ))}
                    <button onClick={closeTrade} style={{alignSelf:"flex-end",fontSize:11,padding:"3px 10px",border:`0.5px solid ${border}`,borderRadius:4,cursor:"pointer",background:"transparent",color:"#ef5350"}}>{lbl.cerrar}</button>
                  </div>
                  :<span style={{fontSize:11,color:textSec}}>Sin posiciones abiertas.</span>
              )}
              {activeTab==="history"&&(
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {trades.length===0
                    ?<span style={{fontSize:11,color:textSec}}>Sin operaciones.</span>
                    :trades.slice(0,10).map((tr,i)=>(
                      <div key={i} style={{fontSize:10,padding:"4px 8px",borderRadius:4,background:tr.pnl>=0?"rgba(38,166,154,.1)":"rgba(239,83,80,.1)",border:`0.5px solid ${tr.pnl>=0?"rgba(38,166,154,.3)":"rgba(239,83,80,.3)"}`}}>
                        <span style={{color:tr.type==="long"?upCol:dnCol,fontWeight:700}}>{tr.type==="long"?"▲":"▼"}</span>
                        <span style={{color:textSec,margin:"0 4px"}}>{fmt(tr.entry)}→{fmt(tr.exit)}</span>
                        <span style={{color:tr.pnl>=0?upCol:dnCol,fontWeight:700}}>{tr.pnl>=0?"+":""}{tr.pnl.toFixed(2)}</span>
                      </div>
                    ))
                  }
                </div>
              )}
              {activeTab==="stats"&&(
                <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                  {[["Ops",trades.length],["Ganadas",wins],["Perdidas",losses],["Win Rate",trades.length?(wins/trades.length*100).toFixed(0)+"%":"—"],["P&L Total",(totalPnl>=0?"+":"")+totalPnl.toFixed(2)],["Avg Win",avgWin.toFixed(2)],["Avg Loss",(-avgLoss).toFixed(2)],["R:R",rrRatio],["Drawdown",drawdown+"%"]].map(([k,v])=>(
                    <div key={k}><div style={{fontSize:10,color:textSec}}>{k}</div><div style={{fontSize:13,fontWeight:600,color:k==="P&L Total"?(totalPnl>=0?upCol:dnCol):k==="Drawdown"?"#ef5350":text}}>{v}</div></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{width:185,background:bgCard,borderLeft:`1px solid ${border}`,display:"flex",flexDirection:"column",padding:"10px",gap:8,overflowY:"auto"}}>
          <div>
            <div style={{fontSize:10,color:textSec,marginBottom:5,textTransform:"uppercase",letterSpacing:".05em"}}>Lots / Contratos</div>
            <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:4}}>
              {[1,3,5,10,15].map(l=>(
                <button key={l} onClick={()=>setLots(l)} style={{...btnS(lots===l),padding:"3px 8px",fontSize:12,fontWeight:lots===l?700:400}}>{l}</button>
              ))}
            </div>
            <input type="number" value={lots} onChange={e=>setLots(Math.max(1,+e.target.value))} min="1" style={{width:"100%",fontSize:12,padding:"3px 6px",border:`0.5px solid ${border}`,borderRadius:4,background:"transparent",color:text}}/>
          </div>
          <div style={{borderTop:`0.5px solid ${border}`,paddingTop:8}}>
            <div style={{fontSize:10,color:"#ef5350",marginBottom:3}}>Stop Loss</div>
            <input type="number" value={sl} onChange={e=>setSl(e.target.value)} placeholder={last?fmt(last.c-assetInfo.vol*0.5):"0.00"} style={{width:"100%",fontSize:12,padding:"3px 6px",border:`0.5px solid rgba(239,83,80,.4)`,borderRadius:4,background:"transparent",color:"#ef5350"}}/>
            <div style={{fontSize:10,color:"#26a69a",marginTop:6,marginBottom:3}}>Take Profit</div>
            <input type="number" value={tp} onChange={e=>setTp(e.target.value)} placeholder={last?fmt(last.c+assetInfo.vol*0.5):"0.00"} style={{width:"100%",fontSize:12,padding:"3px 6px",border:`0.5px solid rgba(38,166,154,.4)`,borderRadius:4,background:"transparent",color:"#26a69a"}}/>
          </div>
          {pos&&(
            <div style={{background:isDark?"#0d1117":"#e8ecf5",borderRadius:6,padding:"8px",border:`0.5px solid ${border}`}}>
              <div style={{fontSize:10,color:textSec,marginBottom:2}}>{lbl.riesgo}</div>
              <div style={{fontSize:14,fontWeight:700,color:"#ef5350",marginBottom:6}}>${riskAmt.toFixed(2)}</div>
              <div style={{fontSize:10,color:textSec,marginBottom:2}}>{lbl.ganancia}</div>
              <div style={{fontSize:14,fontWeight:700,color:livePnl>=0?upCol:dnCol}}>{livePnl>=0?"+":""}{livePnl.toFixed(2)}</div>
            </div>
          )}
          <button onClick={()=>enterTrade("long")}  style={{width:"100%",padding:"9px 0",fontSize:14,fontWeight:700,borderRadius:6,cursor:"pointer",border:"none",background:upCol,color:"#fff"}}>▲ BUY LONG</button>
          <button onClick={()=>enterTrade("short")} style={{width:"100%",padding:"9px 0",fontSize:14,fontWeight:700,borderRadius:6,cursor:"pointer",border:"none",background:dnCol,color:"#fff"}}>▼ SELL SHORT</button>
          <button onClick={closeTrade} style={{width:"100%",padding:"6px 0",fontSize:12,borderRadius:6,cursor:"pointer",border:`0.5px solid ${border}`,background:"transparent",color:textSec}}>{lbl.cerrar} Posición</button>
          <div style={{borderTop:`0.5px solid ${border}`,paddingTop:8}}>
            <div style={{fontSize:10,color:textSec,textTransform:"uppercase",marginBottom:6}}>Stats</div>
            {[[lbl.ops,trades.length],[lbl.wr,trades.length?(wins/trades.length*100).toFixed(0)+"%":"—"],["P&L",(totalPnl>=0?"+":"")+totalPnl.toFixed(2)]].map(([k,v],i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                <span style={{color:textSec}}>{k}</span>
                <span style={{color:k==="P&L"?(totalPnl>=0?upCol:dnCol):text,fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}