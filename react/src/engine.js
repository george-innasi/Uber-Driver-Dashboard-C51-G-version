/* =====================================================================
   Mock data engine, ported from the v11 HTML prototype.
   Seeded and deterministic: 52 weeks of Alex's shifts, a zone-by-hour
   demand model, market-level surge, and 80 comparable part-time drivers.
   Pure functions only; the React layer renders what these return.
   ===================================================================== */
import * as M from './metrics.js';
export { THRESHOLDS, RULES, SIGNALS, DAY_PARTS, tierOf, meets, rate, rateView, moveEstimate, safetyCheck } from './metrics.js';
const {RULES,THRESHOLDS}=M;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const HOUR=3600000, DAY=86400000;
export function addDays(d,n){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);}
export function at(day,h){return new Date(day.getFullYear(),day.getMonth(),day.getDate(),0,Math.round(h*60));}
export function sod(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
export function monday(d){const s=sod(d);return addDays(s,-((s.getDay()+6)%7));}
export function hourOf(d){return d.getHours()+d.getMinutes()/60;}

export const ZONES=[
  {id:'dt',name:'Downtown',  fare:11.0,tripMin:16,tripKm:5.5},
  {id:'mt',name:'Midtown',   fare:9.5, tripMin:13,tripKm:4.5},
  {id:'ap',name:'Airport',   fare:26.0,tripMin:30,tripKm:22},
  {id:'un',name:'University',fare:7.5, tripMin:11,tripKm:3.5},
  {id:'wf',name:'Waterfront',fare:11.5,tripMin:15,tripKm:5},
  {id:'ns',name:'Northside', fare:10.0,tripMin:17,tripKm:7}
];
export const Z=Object.fromEntries(ZONES.map(z=>[z.id,z]));
const TT={dt:{mt:8,ap:25,un:12,wf:10,ns:20},mt:{ap:20,un:10,wf:15,ns:14},ap:{un:28,wf:30,ns:18},un:{wf:18,ns:12},wf:{ns:26}};
export function travel(a,b){if(a===b)return 0;return (TT[a]&&TT[a][b])||(TT[b]&&TT[b][a])||30;}
export const km=m=>Math.round(m*.45);

function bump(h,c,w,amp){let d=Math.abs(h-c);d=Math.min(d,24-d);return amp*Math.exp(-(d*d)/(2*w*w));}
export function demand(zid,dow,h){
  if(h>=24){h-=24;dow=(dow+1)%7;}
  const wkend=dow===0||dow===6, nightOut=dow===4||dow===5||dow===6;
  let d;
  switch(zid){
    case 'dt': d=0.24+(wkend?bump(h,13,3,.25):bump(h,8,1.2,.42)+bump(h,17.6,1.5,.5)+bump(h,12.5,1,.18))+(nightOut?bump(h,23.6,1.8,.55):0);break;
    case 'mt': d=0.30+bump(h,12.5,1.5,.25)+bump(h,18.5,2,.3)+(wkend?.08:0);break;
    case 'ap': d=0.12+bump(h,7,1,.55)+bump(h,13.6,.9,.5)+bump(h,17.8,1,.55)+bump(h,22.5,.9,.35);break;
    case 'un': d=0.14+bump(h,10,2,.14)+bump(h,15.5,1.5,.1)+(nightOut?bump(h,22.8,1.8,.5):0);break;
    case 'wf': d=wkend?0.28+bump(h,14,3,.4)+bump(h,20,2,.38):0.18+bump(h,19.5,2,.32)+bump(h,12.5,1.2,.12);break;
    default:   d=0.18+(wkend?bump(h,11,2.5,.15):bump(h,7.5,1,.42)+bump(h,17,1.2,.24));
  }
  if(h>=3&&h<5.5)d*=.45;
  return clamp(d,.05,.98);
}
const ZI=Object.fromEntries(ZONES.map((z,i)=>[z.id,i]));
function surgeP(d){return clamp((d-.5)*2.4,0,.9);}
export function surgeAt(zid,t){
  const dt=new Date(t), h=dt.getHours(), d=demand(zid,dt.getDay(),h+.5), p=surgeP(d);
  if(p<=0)return 1;
  const dayN=Math.round(sod(dt).getTime()/DAY);
  const r=mulberry32(((ZI[zid]+1)*1000003+dayN*97+h*7919)|0);
  if(r()>=p)return 1;
  return 1+(.25+.75*r())*(d-.4)*2;
}
export const ACC_T=.8;
export function expected(zid,dow,h){
  const z=Z[zid], d=demand(zid,dow,h);
  const util=clamp(.28+.6*d,.1,.9)*(zid==='ap'?.82:1);
  const surgeE=1+surgeP(d)*.625*Math.max(0,d-.4)*2;
  const rate=(60/z.tripMin)*z.fare*surgeE*1.066;
  return {d,util,rate,surgeE,epoh:util*rate};
}
function standing(dr,t){
  const cancel=dr.cancelAt?dr.cancelAt(t):dr.cancel, rating=dr.ratingAt?dr.ratingAt(t):dr.rating;
  return {cancel,rating,mult:clamp(1-3*Math.max(0,cancel-THRESHOLDS.cancellation.goal)-.9*Math.max(0,THRESHOLDS.rating.goal-rating),.6,1.03)};
}
export function expectedAtRec(r){const s=new Date(r.s);return expected(r.zone,s.getDay(),hourOf(s)+r.dur/2);}

function pickWeighted(w,r){const ks=Object.keys(w);let t=ks.reduce((a,k)=>a+w[k],0),x=r()*t;for(const k of ks){x-=w[k];if(x<=0)return k;}return ks[ks.length-1];}
function chooseZone(dr,r,cur,sd){
  const h=hourOf(sd),dow=sd.getDay();
  const near=ZONES.filter(z=>travel(cur,z.id)<=RULES.maxDrive);
  if(r()<dr.smart){let best=cur,bv=-1;near.forEach(z=>{const v=expected(z.id,dow,h+.5+travel(cur,z.id)/60).epoh-travel(cur,z.id)*.15;if(v>bv){bv=v;best=z.id;}});return best;}
  if(r()<.22){const w={};near.forEach(z=>w[z.id]=dr.pref[z.id]||.01);return pickWeighted(w,r);}
  return cur;
}
function simRecord(dr,r,sd,dur,zid){
  const mid=sd.getTime()+dur*HOUR/2;
  const e=expected(zid,sd.getDay(),hourOf(sd)+dur/2), z=Z[zid], st=standing(dr,mid);
  const uT=clamp((.28+.6*e.d+gauss(r)*.07)*(zid==='ap'?.82:1),.08,.93);
  const tripLen=z.tripMin*(.85+r()*.3);
  const offT=uT*dur*60/tripLen/ACC_T;
  const refill=(1+(1-dr.acc)*e.d*.6)/(1+(1-ACC_T)*e.d*.6);
  const offers=Math.max(0,Math.round(offT*st.mult*refill+gauss(r)*.6));
  let accepted=0,cancels=0;
  for(let i=0;i<offers;i++)if(r()<dr.acc)accepted++;
  for(let i=0;i<accepted;i++)if(r()<st.cancel)cancels++;
  const trips=Math.min(accepted-cancels,Math.floor(dur*.95*60/tripLen));
  const engaged=trips*tripLen/60;
  const pick=1+.9*(ACC_T-dr.acc);
  const mult=surgeAt(zid,mid);
  const base=trips*z.fare*(.9+r()*.2)*pick;
  const fare=base*mult, tips=fare*(r()<.6?.06+r()*.1:0);
  let rc=0,rs=0;for(let i=0;i<trips;i++)if(r()<.7){rc++;rs+=r()<st.rating-4?5:4;}
  const kmv=trips*(z.tripKm*(.9+r()*.2)+2)+Math.max(0,dur-engaged)*6;
  return {s:sd.getTime(),dur,zone:zid,engaged,trips,fare,tips,surge:base*(mult-1),mult,offers,accepted,cancels,rc,rs,offT,km:kmv};
}
let shiftSeq=0;
function simShift(dr,r,startMs,lenH,plan){
  let zone=plan?plan[0]:pickWeighted(dr.pref,r);
  const recs=[];let t=startMs,left=lenH,i=0;
  while(left>1e-6){
    const dur=Math.min(1,left), sd=new Date(t);
    if(i>0) zone=plan?plan[Math.min(i,plan.length-1)]:chooseZone(dr,r,zone,sd);
    recs.push(simRecord(dr,r,sd,dur,zone));
    t+=dur*HOUR;left-=dur;i++;
  }
  const id='s'+(shiftSeq++);
  recs.forEach(x=>x.shift=id);
  return {id,s:startMs,e:t,recs};
}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function genWeek(dr,r,wk){
  const target=dr.hMin+r()*(dr.hMax-dr.hMin), tm=[];
  const days=shuffle([0,1,2,3,4],r), n=2+(r()<.55?1:0);
  for(let i=0;i<n;i++){const aft=r()<.2;tm.push({day:days[i],start:aft?13+r()*2:16.75+r()*1.75,len:3.5+r()*1.5});}
  if(r()<.75){const late=r()<.35;tm.push({day:5,start:late?19.5+r()*1.5:9.5+r()*3,len:4.5+r()*1.5});}
  if(r()<.45)tm.push({day:6,start:10.5+r()*2.5,len:3.5+r()*1.2});
  const tot=tm.reduce((a,t)=>a+t.len,0),k=target/tot;
  return tm.map(t=>{const len=Math.round(clamp(t.len*k,2.5,7)*4)/4;const start=at(addDays(wk,t.day),Math.round(t.start*4)/4);return simShift(dr,r,start.getTime(),len,null);});
}
export function agg(recs){
  const a={online:0,engaged:0,trips:0,fare:0,tips:0,surge:0,offers:0,accepted:0,cancels:0,rc:0,rs:0,offT:0,km:0};
  recs.forEach(x=>{a.online+=x.dur;a.engaged+=x.engaged;a.trips+=x.trips;a.fare+=x.fare;a.tips+=x.tips;a.surge+=x.surge;a.offers+=x.offers;a.accepted+=x.accepted;a.cancels+=x.cancels;a.rc+=x.rc;a.rs+=x.rs;a.offT+=x.offT;a.km+=x.km||0;});
  a.earn=a.fare+a.tips;
  a.base=a.fare-a.surge;
  const R=M.rate;
  a.epoh=R(a.earn,a.online);
  a.util=R(a.engaged,a.online);
  a.rate=R(a.earn,a.engaged);
  a.acc=R(a.accepted,a.offers);
  a.offph=R(a.offers,a.online);
  a.offIdx=R(a.offers,a.offT);
  a.cancelRate=R(a.cancels,a.accepted);
  a.rating=R(a.rs,a.rc);
  a.tph=R(a.trips,a.online);
  a.kmph=R(a.km,a.online);
  return a;
}

/* ---- Alex ---- */
const ramp=(t,a,b,v0,v1)=>v0+(v1-v0)*clamp((t-a)/(b-a),0,1);
const ALEX={acc:.72,smart:.3,hMin:20,hMax:25,pref:{dt:.3,un:.22,ns:.24,mt:.14,wf:.06,ap:.04},
  cancelAt:t=>ramp(t,new Date(2026,7,10).getTime(),new Date(2026,8,20).getTime(),.03,.09),
  ratingAt:t=>ramp(t,new Date(2026,7,3).getTime(),new Date(2026,8,26).getTime(),4.94,4.82)};
/* Alex as a Gold driver: same seeds and the same fixed Sep 21-27 week, but
   steady behaviour (about 78% acceptance, 2% cancellations, 4.94 rating).
   Used only by the Gold scenario, labelled as an alternate history. */
const ALEX_GOLD={...ALEX,acc:.78,cancelAt:()=>.02,ratingAt:()=>4.94};
const FIXED_WEEK=[
  [new Date(2026,8,21),17,   4,   ['un','un','ns','ns']],
  [new Date(2026,8,22),14.67,5,   ['ns','ns','dt','dt','dt']],
  [new Date(2026,8,24),17.5, 4,   ['dt','dt','mt','mt']],
  [new Date(2026,8,25),18.17,6.33,['wf','wf','wf','dt','dt','dt','dt']],
  [new Date(2026,8,26),9.42, 5,   ['wf','wf','wf','dt','dt']],
  [new Date(2026,8,27),12,   10,  ['wf','wf','wf','mt','mt','dt','dt','wf','wf','wf']]
];
/* Fixed-plan replacements inside the last 4 weeks, on their own seed so the
   rest of the history is untouched. Sun Sep 13: Alex moves from Downtown to
   Waterfront mid-shift, giving enough Waterfront weekend hours (5.5h) for the
   personal Waterfront vs Downtown comparison. */
const FIXED_REPLACE=[[new Date(2026,8,13),10.75,4.5,['dt','dt','wf','wf','wf']]];
function genAlex(profile){
  const rA=mulberry32(42), out=[];
  for(let wk=new Date(2025,8,29);wk<new Date(2026,8,21);wk=addDays(wk,7)) out.push(...genWeek(profile,rA,wk));
  const rW=mulberry32(913);
  FIXED_REPLACE.forEach(([d,h,len,plan])=>{const st=at(d,h).getTime(),i=out.findIndex(x=>x.s===st);if(i>=0)out[i]=simShift(profile,rW,st,len,plan);});
  const rF=mulberry32(777);
  FIXED_WEEK.forEach(([d,h,len,plan])=>out.push(simShift(profile,rF,at(d,h).getTime(),len,plan)));
  return out;
}
const HISTORY={base:genAlex(ALEX),gold:genAlex(ALEX_GOLD)};

/* ---- 80 comparable part-time drivers, same 52 weeks ---- */
export const PEER_RECS=[];
for(let i=0;i<80;i++){
  const r=mulberry32(1000+i);
  const pref={};ZONES.forEach(z=>pref[z.id]=.05+r());
  const dr={acc:.6+r()*.35,smart:.1+.8*Math.pow(r(),1.2),hMin:18,hMax:26,pref,cancel:.015+r()*.06,rating:4.8+r()*.18};
  const recs=[];
  for(let wk=new Date(2025,8,29);wk<new Date(2026,8,28);wk=addDays(wk,7)) genWeek(dr,r,wk).forEach(s=>recs.push(...s.recs));
  PEER_RECS.push(recs);
}
const PEER_CACHE={};
export function peerDist(s,e){
  const k=s+'|'+e;if(PEER_CACHE[k])return PEER_CACHE[k];
  const aggs=PEER_RECS.map(rs=>agg(rs.filter(x=>x.s>=s&&x.s<e))).filter(a=>a.online>0);
  const out={n:aggs.length};['epoh','util','rate','offph','cancelRate','rating'].forEach(m=>out[m]=aggs.map(a=>a[m]));
  return PEER_CACHE[k]=out;
}
export function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;}
export function quantile(a,q){const s=[...a].sort((x,y)=>x-y);if(!s.length)return 0;const i=(s.length-1)*q,lo=Math.floor(i);return s[lo]+(s[Math.min(lo+1,s.length-1)]-s[lo])*(i-lo);}
export function pctBelow(v,arr){return Math.round(100*arr.filter(x=>x<v).length/arr.length);}

/* ---- Scenarios (the React build currently uses 'login', the Demand scenario) ---- */
export const MOMENTS=[
  {id:'login',tag:'Demand',blurb:'Alex opens the app at home in Northside, offline. Demand is running above normal in nearby Downtown and Midtown.',now:new Date(2026,8,23,15,45),boost:{},live:{dt:.24,mt:.15}},
  {id:'gold',tag:'Gold',history:'gold',blurb:'Alternate history: Alex as a Gold driver who meets the standard. Online in Waterfront for 15 minutes. A homecoming concert lets out at University tonight, 10 PM to 12 AM.',now:new Date(2026,8,25,18,25),boost:{},live:{}},
  {id:'rest',tag:'Rest',blurb:'Alex reached the 10-hour limit and was taken offline for a 7-hour rest. Demand is starting to rise on the left side of the city.',now:new Date(2026,8,27,22,0),boost:{},live:{un:.26,mt:.18}}
];

export function snapshot(m){
  const now=m.now.getTime();
  const shifts=[];
  HISTORY[m.history||'base'].forEach(s=>{
    if(s.s>=now)return;
    const recs=[];
    s.recs.forEach(r=>{
      if(r.s>=now)return;
      const end=r.s+r.dur*HOUR;
      if(end<=now){recs.push(r);return;}
      const f=(now-r.s)/(r.dur*HOUR);
      recs.push({...r,dur:r.dur*f,engaged:r.engaged*f,trips:Math.round(r.trips*f),fare:r.fare*f,tips:r.tips*f,surge:r.surge*f,offers:Math.round(r.offers*f),accepted:Math.round(r.accepted*f),cancels:Math.round(r.cancels*f),rc:Math.round(r.rc*f),rs:Math.round(r.rc*f)*(r.rc?r.rs/r.rc:0),offT:r.offT*f,km:(r.km||0)*f,partial:true});
    });
    const e=Math.min(s.e,now);
    shifts.push({id:s.id,s:s.s,e,recs,live:s.e>now});
  });
  const recs=shifts.flatMap(s=>s.recs);
  const live=shifts.find(s=>s.live)||null;
  return {m,now,shifts,recs,live};
}

/* =====================================================================
   Decision logic
   ===================================================================== */

function consecutiveDays(snap){
  const byDay=new Set(snap.recs.map(r=>sod(new Date(r.s)).getTime()));
  let d=sod(new Date(snap.now));
  if(!byDay.has(d.getTime()))d=addDays(d,-1);
  let n=0;while(byDay.has(d.getTime())){n++;d=addDays(d,-1);}
  return n;
}
export function duty(snap){
  const recs=snap.recs.slice().sort((a,b)=>a.s-b.s), REST=RULES.restHrs*HOUR, out=[];
  for(let i=recs.length-1;i>=0;i--){
    const end=recs[i].s+recs[i].dur*HOUR, nextStart=i===recs.length-1?snap.now:recs[i+1].s;
    if(nextStart-end>=REST)break;
    out.unshift(recs[i]);
  }
  const hours=out.reduce((t,r)=>t+r.dur,0), lastEnd=out.length?out[out.length-1].s+out[out.length-1].dur*HOUR:null;
  const capped=hours>=RULES.maxShift-1e-6;
  const until=capped?lastEnd+REST:null;
  return {recs:out,hours,since:out.length?out[0].s:null,lastEnd,capped,until,cool:capped&&snap.now<until};
}
export function wellbeing(snap){
  const now=snap.now, nd=new Date(now), h=hourOf(nd);
  const liveH=snap.live?agg(snap.live.recs).online:0;
  const last24=snap.recs.filter(r=>r.s>=now-24*HOUR).reduce((a,r)=>a+r.dur,0);
  const isLate=h>=RULES.lateStart||h<RULES.lateEnd;
  const cons=consecutiveDays(snap);
  const du=duty(snap);
  const checks=[
    {label:RULES.maxShift+' hrs online: forced offline',val:fmtH(Math.min(du.hours,RULES.maxShift)),hit:du.capped},
    {label:'On for '+RULES.longDay+'+ hours this shift',val:fmtH(liveH),hit:liveH>=RULES.longDay},
    {label:'Past 10 PM, 3+ hours in',val:fmtClock(nd),hit:isLate&&liveH>=RULES.lateMinHours},
    {label:RULES.last24+'+ hours in the last 24',val:fmtH(last24),hit:last24>=RULES.last24},
    {label:RULES.noRestDays+'+ days without a rest day',val:cons+(cons===1?' day':' days'),hit:cons>=RULES.noRestDays}
  ];
  return {liveH,last24,isLate,cons,checks,duty:du,tripped:checks.some(c=>c.hit)};
}
/* expected $/online hr in a zone at a clock hour (hours past 24 roll into the next day) */
export function rateAtFor(snap){
  const dow=new Date(snap.now).getDay(), boost=snap.m.boost||{};
  return (z,hh)=>expected(z,(dow+Math.floor(hh/24))%7,((hh%24)+24)%24).epoh*((boost[z]&&boost[z].m)||1);
}
export function currentZone(snap){
  const lastRec=snap.recs.length?snap.recs.reduce((x,y)=>x.s>y.s?x:y):null;
  return snap.live?snap.live.recs[snap.live.recs.length-1].zone:(lastRec&&snap.now-(lastRec.s+lastRec.dur*HOUR)<2*HOUR?lastRec.zone:'ns');
}
export function opportunities(snap){
  const nd=new Date(snap.now), h=hourOf(nd), boost=snap.m.boost||{};
  const cur=currentZone(snap), H=RULES.horizon, rateAt=rateAtFor(snap);
  const here=rateAt(cur,h+.25);
  const list=ZONES.filter(z=>z.id!==cur&&travel(cur,z.id)<=RULES.maxDrive).map(z=>{
    const mins=travel(cur,z.id);
    const est=M.moveEstimate({rateAt,from:cur,to:z.id,startH:h,horizonH:H,driveMins:mins});
    return {zone:z.id,move:est.move,gain:est.gain,gainPerHr:est.gainPerHr,movePerHr:est.movePerHr,est,mins,arrive:h+mins/60,boost:boost[z.id]||null};
  }).sort((a,b)=>b.move-a.move);
  const stay=list.length?list[0].est.stay:0;
  const best=list[0];
  const qualifies=!!best&&best.est.qualifies;
  return {cur,here,stay,H,list,best,qualifies};
}
/* a Gold slot as a move: drive (unpaid) from the current zone, arriving at the
   slot start, then earn the slot rate; compared with staying put for the same hours */
export function goldEstimate(snap,e,cur){
  const nd=new Date(snap.now), dow=nd.getDay(), mins=travel(cur,e.zone), base=rateAtFor(snap);
  const w=windowStats(e.zone,dow,e.a,e.b), goldRate=w.epoh*(1+e.prem);
  const rateAt=(z,hh)=>z===e.zone&&hh>=e.a&&hh<e.b?goldRate:base(z,hh);
  const startH=Math.max(hourOf(nd),e.a-mins/60);
  const est=M.moveEstimate({rateAt,from:cur,to:e.zone,startH,horizonH:e.b-startH,driveMins:mins});
  return {...est,typical:w.epoh,goldRate,mins,km:km(mins)};
}
export function decide(snap,claims={}){
  const wb=wellbeing(snap), op=opportunities(snap);
  const gt=goldTop(snap,wb,claims);
  const state=wb.duty.cool?'cool':(!snap.live?'start':(wb.tripped?'warn':(gt?'gold':(op.qualifies?'go':'calm'))));
  return {wb,op,state,gt};
}

/* A2: driving mode reads the active scenario. One number, one action, one status.
   Cool-down returns null: no driving mode and no earning prompt. */
export function drivingView(snap,dec){
  if(dec.state==='cool')return null;
  const du=dec.wb.duty, op=dec.op, cur=op.cur;
  let action;
  if(dec.state==='gold'){const e=dec.gt,g=goldEstimate(snap,e,cur);action={kind:'gold',title:`Gold slot at ${Z[e.zone].name}`,detail:`${e.name} · ${fmtHour(e.a)}–${fmtHour(e.b)}`,zone:e.zone,mins:g.mins,km:g.km,gainPerHr:g.gainPerHr};}
  else if(dec.state==='warn')action={kind:'rest',title:'Time to wrap up',detail:'Find a safe place to stop'};
  else if(op.qualifies){const b=op.best;action={kind:'move',title:`Head to ${Z[b.zone].name}`,zone:b.zone,mins:b.mins,km:km(b.mins),gainPerHr:b.gainPerHr,movePerHr:b.movePerHr};}
  else action={kind:'stay',title:`Stay in ${Z[cur].name}`,zone:cur,mins:0,km:0};
  let number;
  if(snap.live){
    const a=agg(snap.live.recs);
    number=a.online>=RULES.minRateHours-1e-9?{value:a.epoh,label:'This shift'}:{value:null,label:`This shift · rate shows after ${Math.round(RULES.minRateHours*60)} min online`};
  }else{
    /* offline: no "current average"; the number is the best next move */
    number=action.kind==='move'?{value:action.movePerHr,label:`Expected in ${Z[action.zone].name}, drive included`}:{value:op.here,label:`Typical in ${Z[cur].name} now`};
  }
  return {number,action,status:{hours:du.hours,label:'since last rest'},from:cur};
}

/* =====================================================================
   Formatting
   ===================================================================== */
export const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const DOW_FULL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function money(v,dp){dp=dp==null?(Math.abs(v)<100?2:0):dp;return '$'+v.toLocaleString('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp});}
export function fmtH(h){const hh=Math.floor(h+1e-6),mm=Math.round((h-hh)*60);return mm?(hh?hh+'h '+mm+'m':mm+'m'):hh+'h';}
export function hrsWord(h){return (Math.round(h*10)/10)+' hrs';}
export function fmtClock(d){let h=d.getHours(),m=d.getMinutes();const ap=h>=12?'PM':'AM';h=h%12||12;return h+(m?':'+String(m).padStart(2,'0'):'')+' '+ap;}
export function fmtHour(h){h=((Math.round(h)%24)+24)%24;const ap=h>=12?'PM':'AM';return (h%12||12)+' '+ap;}
export function fmtRange(a,b){return fmtClock(new Date(a))+'–'+fmtClock(new Date(b));}
export function dayLabel(d){return DOW[d.getDay()]+' '+MON[d.getMonth()]+' '+d.getDate();}
export function pct(v){return Math.round(v*100)+'%';}
export function whenLabel(snap,ms){const d=new Date(ms),n=new Date(snap.now);return fmtClock(d)+(sod(d).getTime()!==sod(n).getTime()?' '+DOW[d.getDay()]:'');}

/* =====================================================================
   Earnings tab
   ===================================================================== */
export const PERIODS=[['today','Today'],['week','Week'],['month','Month'],['quarter','Quarter'],['year','Year']];
export function periodBuckets(snap,dec,p){
  const nd=new Date(snap.now), b=[];
  if(p==='today'){
    const recs=dec.wb.duty.recs.length?dec.wb.duty.recs:(snap.live?snap.live.recs:snap.recs.filter(r=>r.s>=sod(nd).getTime()));
    recs.forEach(r=>b.push({label:fmtHour(hourOf(new Date(r.s))).replace(' ',''),full:fmtRange(r.s,r.s+r.dur*HOUR),recs:[r]}));
    return {start:sod(nd),label:'Today, total earnings so far',buckets:b};
  }
  if(p==='week'){
    const w=monday(nd);
    for(let i=0;i<7;i++){const d=addDays(w,i),e=addDays(w,i+1);b.push({label:DOW[d.getDay()][0],full:dayLabel(d),future:d>nd,recs:snap.recs.filter(r=>r.s>=d.getTime()&&r.s<e.getTime())});}
    return {start:w,label:'This week, total earnings so far',buckets:b};
  }
  if(p==='month'||p==='quarter'){
    const start=p==='month'?new Date(nd.getFullYear(),nd.getMonth(),1):new Date(nd.getFullYear(),Math.floor(nd.getMonth()/3)*3,1);
    let w=monday(start);
    while(w<=nd){const s=w<start?start:w,e=addDays(w,7);b.push({label:MON[s.getMonth()]+' '+s.getDate(),full:'Week of '+MON[s.getMonth()]+' '+s.getDate(),recs:snap.recs.filter(r=>r.s>=s.getTime()&&r.s<e.getTime())});w=e;}
    return {start,label:p==='month'?'This month ('+MON[nd.getMonth()]+'), total earnings so far':'This quarter (Q'+(Math.floor(nd.getMonth()/3)+1)+'), total earnings so far',buckets:b,sparse:p==='quarter'};
  }
  const start=new Date(nd.getFullYear(),nd.getMonth()-11,1);
  for(let i=0;i<12;i++){const s=new Date(start.getFullYear(),start.getMonth()+i,1),e=new Date(s.getFullYear(),s.getMonth()+1,1);b.push({label:MON[s.getMonth()],full:MON[s.getMonth()]+' '+s.getFullYear(),recs:snap.recs.filter(r=>r.s>=s.getTime()&&r.s<e.getTime())});}
  return {start,label:'Last 12 months, total earnings',buckets:b,sparse:true};
}
export function peakHour(recs){
  const by={};recs.forEach(r=>{const h=new Date(r.s).getHours();(by[h]=by[h]||[]).push(r);});
  let best=null;Object.keys(by).forEach(h=>{const a=agg(by[h]);if(a.online<(recs.length>8?1.5:.3))return;if(!best||a.epoh>best.epoh)best={h:+h,epoh:a.epoh};});
  return best;
}
export function completedShifts(snap){return snap.shifts.filter(s=>!s.live&&s.recs.length).sort((a,b)=>b.s-a.s);}
/* "Your usual $/hr": one definition, in metrics.usualEpoh (median weekly $/hr in
   the same day-part over the last 8 weeks). recs = the hours being compared
   (a shift, or today); refMs = compare only with weeks before this moment. */
export function weightsFor(recs,refMs){return recs&&recs.length?M.dayPartWeights(recs):{[M.dayPartOf(hourOf(new Date(refMs)))]:1};}
export function usualFor(snap,recs,refMs){refMs=refMs==null?(recs&&recs.length?recs[0].s:snap.now):refMs;return M.usualEpoh(snap.recs.filter(r=>r.s<refMs),refMs,weightsFor(recs,refMs));}
const PEER_USUAL={};
export function peerUsualFor(recs,refMs){
  const w=weightsFor(recs,refMs),k=refMs+'|'+JSON.stringify(w);if(PEER_USUAL[k]!=null)return PEER_USUAL[k];
  return PEER_USUAL[k]=median(PEER_RECS.map(rs=>M.usualEpoh(rs.filter(r=>r.s<refMs&&r.s>=refMs-56*DAY),refMs,w)).filter(v=>v>0));
}
export function dayPartLabel(recs,refMs){const w=weightsFor(recs,refMs);return Object.keys(w).sort((a,b)=>w[b]-w[a]).map(k=>M.DAY_PARTS.find(p=>p.id===k).label.toLowerCase()).join(' + ');}

/* benchmark line under earnings per online hour */
export function bench(snap,P,a,period){
  if(!a.online)return null;
  if(period==='today'){
    const recs=P.buckets.flatMap(b=>b.recs), usual=usualFor(snap,recs), d=a.epoh/usual-1;
    return {tone:d>=-.05?'go':'neutral',chip:Math.abs(d)<.05?'On par':d>0?'Ahead':'Behind',usual,
      text:`${Math.abs(d)<.05?'Level with':Math.round(Math.abs(d)*100)+'% '+(d>0?'above':'below')} your usual ${money(usual)}/hr (${dayPartLabel(recs)}, last 8 weeks)`};
  }
  const pd=peerDist(P.start.getTime(),snap.now), p=pctBelow(a.epoh,pd.epoh);
  return {tone:p>=50?'go':'neutral',chip:p>=50?'Above median':'Below median',text:`Beats ${p}% of similar part-time drivers over the same dates`};
}

/* levers that would raise Alex's $/hr, estimated from the last 4 weeks */
export function maximizeLevers(snap){
  const recs=snap.recs.filter(r=>r.s>=snap.now-28*DAY), a=agg(recs), hrs=a.online;
  if(!hrs)return {empty:true};
  const levers=[];
  const zl=personalZoneLever(recs,hrs);
  if(zl)levers.push(zl);
  if(!M.meets('tripOffers',a.offIdx)){
    const bits=[];if(!M.meets('cancellation',a.cancelRate))bits.push(`your cancellation rate is ${pct(a.cancelRate)}; the goal is ${THRESHOLDS.cancellation.label}`);if(!M.meets('rating',a.rating))bits.push(`your rating is ${a.rating.toFixed(2)}; the goal is ${THRESHOLDS.rating.label}`);
    levers.push({t:'Cancel fewer accepted trips',g:a.epoh*(Math.min(1/a.offIdx,1.25)-1)*.8,
      x:`You get ${pct(1-a.offIdx)} fewer offers than drivers in the same zones and hours. ${bits.length?bits.join(', and ').replace(/^./,c=>c.toUpperCase())+'.':''}`});
  }
  const quiet=recs.filter(r=>expectedAtRec(r).d<.45), q=agg(quiet);
  if(q.offers>=10&&q.acc<ACC_T-.03){
    const factor=(ACC_T/q.acc)/(1+.9*(ACC_T-q.acc));
    if(factor>1)levers.push({t:'Accept more offers in quiet hours',g:q.earn*(factor-1)/hrs,
      x:`In slow periods you accepted ${pct(q.acc)} of offers. When trips are scarce, a skipped offer means a long wait for the next one. In busy hours, being choosy is fine.`});
  }
  let eS=0;recs.forEach(r=>eS+=(1-1/expectedAtRec(r).surgeE)*r.dur);eS/=hrs;
  const share=a.fare?a.surge/a.fare:0;
  if(share<eS*.85){
    const main=Object.entries(recs.reduce((m,r)=>(m[r.zone]=(m[r.zone]||0)+r.dur,m),{})).sort((x,y)=>y[1]-x[1])[0][0];
    const nd=new Date(snap.now), hist=surgeHistory(nd).filter(zh=>zh.win&&zh.win.b<=22&&travel(main,zh.zone)<=RULES.maxDrive).sort((x,y)=>y.winDays-x.winDays)[0];
    levers.push({t:'Be in position before surge starts',g:(eS-share)*a.epoh,
      x:`Surge made up ${pct(share)} of your fares; typical for your zones and hours is ${pct(eS)}.`+(hist?` On ${DOW_FULL[nd.getDay()]}s, ${Z[hist.zone].name} surges ${fmtHour(hist.win.a)}–${fmtHour(hist.win.b)} on ${hist.winDays} of the last 8 weeks. Arrive before it starts.`:'')});
  }
  const list=levers.filter(l=>l.g>=.25).sort((x,y)=>y.g-x.g).slice(0,4);
  return {a,list,reach:a.epoh+list.reduce((t,l)=>t+l.g,0)};
}

/* A5: the zone lever is personal. It compares Alex's own $/hr in two nearby
   zones over the last 4 weeks, same day type, with at least MIN_ZONE_H hours
   in each, and counts one unpaid drive per shift block via moveEstimate. */
export const MIN_ZONE_H=4;
export function zoneHistory(recs){
  const out={};
  recs.forEach(r=>{const d=new Date(r.s).getDay(),wk=d===0||d===6?'weekend':'weekday',k=r.zone+'|'+wk;(out[k]=out[k]||[]).push(r);});
  return Object.fromEntries(Object.entries(out).map(([k,rs])=>[k,{...agg(rs),blocks:new Set(rs.map(r=>r.shift)).size}]));
}
export function personalZoneLever(recs,hrs){
  const H=zoneHistory(recs);let best=null;
  ['weekday','weekend'].forEach(wk=>ZONES.forEach(f=>ZONES.forEach(t=>{
    if(f.id===t.id||travel(f.id,t.id)>RULES.maxDrive)return;
    const A=H[f.id+'|'+wk],B=H[t.id+'|'+wk];
    if(!A||!B||A.online<MIN_ZONE_H||B.online<MIN_ZONE_H)return;
    const blockH=A.online/A.blocks;
    const est=M.moveEstimate({rateAt:z=>z===t.id?B.epoh:A.epoh,from:f.id,to:t.id,startH:0,horizonH:blockH,driveMins:travel(f.id,t.id)});
    if(est.gainPerHr<=0)return;
    const g=est.gainPerHr*A.online/hrs;
    if(!best||g>best.g)best={g,wk,from:f.id,to:t.id,A,B,est};
  })));
  if(!best||best.g<.25)return null;
  const {A,B,from,to,wk,est}=best, fn=Z[from].name, tn=Z[to].name, why=[];
  if(B.util-A.util>=.05)why.push(`you were on a trip ${pct(B.util)} of the time in ${tn} vs ${pct(A.util)} in ${fn}, so shorter waits between trips`);
  if(A.cancelRate-B.cancelRate>=.02)why.push(`you cancelled fewer trips there (${pct(B.cancelRate)} vs ${pct(A.cancelRate)})`);
  if(B.rate-A.rate>=2)why.push(`each hour on a trip paid more there (${money(B.rate,0)} vs ${money(A.rate,0)})`);
  return {key:'zone',personal:true,g:best.g,zoneGain:est.gainPerHr,from,to,wk,
    t:`${wk==='weekend'?'Weekends':'Weekdays'}: drive in ${tn} instead of ${fn}`,
    sub:`Based on your last 4 weeks: you earn +${money(est.gainPerHr)}/hr in ${tn} vs ${fn}, after the ${travel(from,to)} min drive.`,
    why:why.length?`Why: ${why.join('; ')}.`:'',
    x:`Your ${wk}s, last 4 weeks: ${tn} ${money(B.epoh)}/hr over ${fmtH(B.online)}; ${fn} ${money(A.epoh)}/hr over ${fmtH(A.online)}. City-wide averages can differ; this is your own history.`};
}

/* you vs the top 20% of earners in the same zones, over comparable time */
export function performed(snap,P,recs,a,period){
  if(!a.online)return {msg:'No driving in this period to compare.'};
  const zones=new Set(recs.map(r=>r.zone));
  let filt,desc;
  if(period==='today'){
    const nd=new Date(snap.now), dow=nd.getDay(), hs=recs.map(r=>hourOf(new Date(r.s))), lo=Math.floor(Math.min(...hs)), hi=Math.ceil(Math.max(...hs.map((h,i)=>h+recs[i].dur)));
    filt=r=>{const d=new Date(r.s),h=hourOf(d);return r.s>=snap.now-56*DAY&&r.s<sod(nd).getTime()&&d.getDay()===dow&&h>=lo-1&&h<hi+1&&zones.has(r.zone);};
    desc=`${DOW_FULL[dow]}s, ${fmtHour(lo)}–${fmtHour(hi)}, last 8 weeks`;
  }else{
    filt=r=>r.s>=P.start.getTime()&&r.s<snap.now&&zones.has(r.zone);desc='same dates';
  }
  const minH=period==='today'?1:Math.max(1,a.online*.25);
  const peers=PEER_RECS.map(rs=>{const x=rs.filter(filt);return {recs:x,a:agg(x)};}).filter(p=>p.a.online>=minH).sort((x,y)=>y.a.epoh-x.a.epoh);
  if(peers.length<5)return {msg:'Not enough comparable drivers for this period yet.'};
  const n=Math.max(3,Math.round(peers.length*.2)), top=agg(peers.slice(0,n).flatMap(p=>p.recs));
  const zoneNames=[...zones].map(z=>Z[z].name).join(', ');
  const rows=[
    ['Earnings per online hour',a.epoh,top.epoh,v=>money(v),1,true],
    ['Trips per online hour',a.tph,top.tph,v=>v.toFixed(1),1],
    ['Trip offers per hour',a.offph,top.offph,v=>v.toFixed(1),1],
    ['Acceptance rate',a.acc,top.acc,pct,0],
    ['Cancellation rate',a.cancelRate,top.cancelRate,pct,-1],
    ['Time on a trip',a.util,top.util,pct,1],
    ['Km driven per online hour',a.kmph,top.kmph,v=>Math.round(v)+' km',0]
  ].map(([l,y,t,f,dir,hero])=>({l,you:f(y),top:f(t),hero:!!hero,tone:!dir?'':(dir*(y-t)>=-Math.abs(t)*.03?'good':'bad')}));
  return {n,zoneNames,desc,rows};
}

/* why a shift landed where it did: split the gap to your usual into zone & time, market today, your driving */
export function slowSplit(snap,recs,usual){
  const a=agg(recs), hrs=a.online;
  let E=0;recs.forEach(r=>E+=expectedAtRec(r).epoh*r.dur);E/=hrs;
  const zones=[...new Set(recs.map(r=>r.zone))];
  const peer=[];PEER_RECS.forEach(rs=>rs.forEach(q=>{if(q.s>=snap.now)return;if(recs.some(r=>r.zone===q.zone&&Math.abs(q.s-r.s)<HOUR))peer.push(q);}));
  const pa=agg(peer);let pE=0;peer.forEach(q=>pE+=expectedAtRec(q).epoh*q.dur);pE=pa.online?pE/pa.online:0;
  const ok=pa.online>=2, f=ok?pa.epoh/pE:1;
  const startZone=recs[0].zone;let best=null;
  ZONES.filter(z=>travel(startZone,z.id)<=RULES.maxDrive).forEach(z=>{let v=0;recs.forEach(r=>{const d=new Date(r.s);v+=expected(z.id,d.getDay(),hourOf(d)+r.dur/2).epoh*r.dur;});v/=hrs;if(!best||v>best.v)best={zone:z.id,v};});
  const lo=hourOf(new Date(recs[0].s)), hi=lo+(recs[recs.length-1].s+recs[recs.length-1].dur*HOUR-recs[0].s)/HOUR;
  const zn=zones.map(z=>Z[z].name).join(' + '), win=`${fmtHour(Math.floor(lo))}–${fmtHour(Math.ceil(hi))}`;
  const detail={
    zone:[[`${zn}, ${win}, usually`,money(E)+'/hr'],['Your usual',money(usual)+'/hr']].concat(best&&!zones.includes(best.zone)&&best.v>E*1.1?[[`${Z[best.zone].name} (${travel(zones[0],best.zone)} min), usually`,money(best.v)+'/hr']]:[]),
    market:ok?[['Drivers here today',money(E*f)+'/hr'],['Same zones & hours, usually',money(E)+'/hr']]:null,
    you:[['You',money(a.epoh)+'/hr'],['Drivers here today',money(E*f)+'/hr'],['Offers per hour',`${a.offph.toFixed(1)} vs ${ok?pa.offph.toFixed(1):'–'}`],['Cancellations',`${pct(a.cancelRate)} vs ${ok?pct(pa.cancelRate):'–'}`],['Time on a trip',`${pct(a.util)} vs ${ok?pct(pa.util):'–'}`]]
  };
  return {a,usual,E,f,ok,
    parts:[{k:'zone',t:'Zone & time',v:E-usual,rows:detail.zone},{k:'market',t:'Market today',v:E*(f-1),rows:detail.market},{k:'you',t:'Your driving',v:a.epoh-E*f,rows:detail.you}]};
}
export function shiftUsual(snap,sh){return usualFor(snap,sh.recs,sh.s);}

/* =====================================================================
   Opportunities tab
   ===================================================================== */
/* Gold standard = the same goals as account standing (metrics.THRESHOLDS) */
export const EVENTS=[
  {id:'e1',day:0,name:'Evening classes let out',venue:'University Quad',type:'College',zone:'un',a:21,b:23,prem:.15,left:14,of:30},
  {id:'e2',day:1,name:'Harbor Hawks vs Ridgeview',venue:'Downtown Arena',type:'Sports',zone:'dt',a:21.5,b:23.5,prem:.30,left:12,of:40},
  {id:'e3',day:2,name:'Finals week: library closes',venue:'University Library',type:'College',zone:'un',a:23,b:25,prem:.20,left:9,of:25},
  {id:'e4',day:3,name:'Nova Reyes, live',venue:'Waterfront Amphitheatre',type:'Concert',zone:'wf',a:22.5,b:24.5,prem:.35,left:8,of:35},
  {id:'e5',day:4,name:'Homecoming Concert',venue:'University Hall',type:'Concert',zone:'un',a:22,b:24,prem:.40,left:10,of:30},
  {id:'e6',day:5,name:'Metro FC vs Eastside United',venue:'Downtown Arena',type:'Sports',zone:'dt',a:21.5,b:23.5,prem:.30,left:6,of:40},
  {id:'e7',day:6,name:'Jazz in the Park',venue:'Waterfront Park',type:'Live event',zone:'wf',a:17,b:19,prem:.25,left:15,of:30},
  {id:'e8',day:6,name:'Comedy Night',venue:'Downtown Theatre',type:'Live event',zone:'dt',a:21.5,b:23.5,prem:.25,left:11,of:25}
];
export function curMetrics(snap){
  const a=agg(snap.recs.filter(r=>r.s>=snap.now-28*DAY&&r.s<=snap.now));
  return a;
}
export function goldElig(snap){
  const a=curMetrics(snap), T=THRESHOLDS;
  const rows=[
    {k:'Star rating',key:'rating',need:T.rating.need,you:a.rc?(Math.round(a.rating*100)/100).toFixed(2):'–',ok:M.meets('rating',a.rating)},
    {k:'Cancellation rate',key:'cancellation',need:T.cancellation.need,you:pct(a.cancelRate),num:a.cancels,den:a.accepted,ok:M.meets('cancellation',a.cancelRate)},
    {k:'Acceptance rate',key:'acceptance',need:T.acceptance.need,you:pct(a.acc),num:a.accepted,den:a.offers,ok:M.meets('acceptance',a.acc)}
  ];
  return {rows,ok:rows.every(x=>x.ok)};
}
export function evBlock(e,snap,wb,G,isToday){
  if(!G.ok)return 'Locked';
  if(isToday&&wb.duty.cool)return 'Resting until '+whenLabel(snap,wb.duty.until);
  if(isToday){
    if(wb.tripped)return 'Not offered late in a long shift';
    const nowH=hourOf(new Date(snap.now)), hrs=wb.duty.hours+(snap.live?Math.max(0,e.b-nowH):Math.max(0,e.b-Math.max(nowH,e.a)));
    if(hrs>RULES.maxShift+1e-6)return 'Passes your '+RULES.maxShift+'h limit';
  }
  return '';
}
function goldTop(snap,wb,claims){
  const G=goldElig(snap);if(!G.ok)return null;
  const nd=new Date(snap.now), dow=(nd.getDay()+6)%7, nowH=hourOf(nd);
  return EVENTS.filter(e=>e.day===dow&&e.b>nowH&&!evBlock(e,snap,wb,G,true)&&!(claims[e.id]==='no')).sort((x,y)=>y.prem-x.prem)[0]||null;
}
export const OPP_WINDOWS=[[6,10],[10,14],[14,18],[18,22],[22,26]];
export function windowStats(zid,dow,a,b){
  let e=0,sg=1,d=0,n=0;
  for(let h=a;h<b;h+=1){const x=expected(zid,(dow+Math.floor((h+.5)/24))%7,(h+.5)%24);e+=x.epoh;d+=x.d;sg=Math.max(sg,x.surgeE);n++;}
  return {epoh:e/n,d:d/n,surge:sg};
}

/* options by day: right-now list (today only), earnings windows and gold slots, sorted by time */
export function optionsForDay(snap,dec,dayIdx,claims){
  /* rolling 7 days starting today; event slots repeat weekly by weekday */
  const {op,wb}=dec, nd=new Date(snap.now), today=sod(nd), cool=wb.duty.cool;
  const days=[...Array(7)].map((_,i)=>addDays(today,i));
  const day=days[dayIdx], isToday=dayIdx===0, dow=day.getDay(), evDay=(dow+6)%7, cur=op.cur;
  let rightNow=null;
  if(isToday&&!cool){
    const list=[...op.list].sort((x,y)=>Math.round(y.gain)-Math.round(x.gain)||x.mins-y.mins).slice(0,2).map((o,i)=>{
      const good=o.est.qualifies, dem=wb.tripped&&o.gain>0, g=Math.round(o.gain);
      const reason=g>0?`Picks up around ${fmtHour(o.arrive+.5)}`:g===0?'About the same as staying':'Earns less than staying';
      return {...o,g,good,dem,reason,best:i===0&&g>0&&!dem};
    });
    rightNow={cur,here:op.here,stay:op.stay,H:op.H,list};
  }
  const nowH=hourOf(nd), near=ZONES.filter(z=>travel(cur,z.id)<=RULES.maxDrive);
  const items=OPP_WINDOWS.filter(([a,b])=>!isToday||b>nowH).map(([a,b])=>{
    const rateAt=(z,hh)=>expected(z,(dow+Math.floor(hh/24))%7,((hh%24)+24)%24).epoh;
    const st=near.map(z=>{const est=M.moveEstimate({rateAt,from:cur,to:z.id,startH:a,horizonH:b-a,driveMins:travel(cur,z.id)});return {z:z.id,...windowStats(z.id,dow,a,b),afterDrive:est.movePerHr,mins:travel(cur,z.id)};}).sort((x,y)=>y.afterDrive-x.afterDrive), best=st[0], mine=st.find(x=>x.z===cur);
    return {kind:'window',a,b,best,mine:best.z!==cur?mine:null,now:isToday&&a<=nowH&&nowH<b,
      surge:best.surge>=1.15?best.surge:null,busy:best.d>=.55?'Busy':best.d<.3?'Quiet':'Steady'};
  });
  const G=goldElig(snap);
  EVENTS.filter(e=>e.day===evDay&&(!isToday||e.b>nowH)).forEach(e=>{
    const w=windowStats(e.zone,dow,e.a,e.b), st=claims[e.id], ge=goldEstimate({...snap,now:isToday?snap.now:at(day,0).getTime()},e,cur);
    items.push({kind:'gold',a:e.a,e,typ:w.epoh,gold:w.epoh*(1+e.prem),ge,leftN:e.left-(st==='yes'?1:0),block:evBlock(e,snap,wb,G,isToday),st});
  });
  items.sort((x,y)=>x.a-y.a);
  return {days,today,day,isToday,cur,rightNow,items,G,cool,until:cool?whenLabel(snap,wb.duty.until):null};
}

/* surging now: live multipliers by area */
export function surgeNow(snap,cur){
  const boost=snap.m.boost||{};
  const st=ZONES.map(z=>({z:z.id,m:Math.max(surgeAt(z.id,snap.now),(boost[z.id]&&boost[z.id].m)||1)}));
  const hot=st.filter(x=>M.surgePricingOn(x.m)).sort((x,y)=>y.m-x.m);
  const txt=!hot.length?'Surge pricing is off everywhere right now (1.0×).':hot.length===1?`Surge pricing is on in ${Z[hot[0].z].name}.`:`Surge pricing is on in ${Z[hot[0].z].name} and ${hot.length-1} other area${hot.length>2?'s':''}.`;
  return {hot,txt};
}

/* surge schedule for one weekday: regular windows over the last 8 of that weekday */
export function surgeHistory(nd){
  const days=[];for(let k=1;k<=8;k++)days.push(addDays(sod(nd),-7*k));
  const hours=[];for(let h=6;h<26;h++)hours.push(h);
  return ZONES.map(z=>{
    const cells=hours.map(h=>{let n=0,m=0;days.forEach(d=>{const v=surgeAt(z.id,at(d,h+.5).getTime());if(v>1){n++;m+=v;}});return {h,freq:n/days.length,n,mult:n?m/n:1};});
    let best=null,cur=null;
    cells.forEach(c=>{if(c.freq>=.5){if(!cur)cur={a:c.h,b:c.h+1,cells:[]};cur.b=c.h+1;cur.cells.push(c);if(!best||cur.cells.length>best.cells.length)best=cur;}else cur=null;});
    return {zone:z.id,cells,win:best,winDays:best?Math.round(best.cells.reduce((x,c)=>x+c.n,0)/best.cells.length):0};
  });
}
export function surgeByDay(snap,dow){
  const today=sod(new Date(snap.now));let d=addDays(today,-((today.getDay()-dow+7)%7||7));
  const days=[];for(let k=0;k<8;k++)days.push(addDays(d,-7*k));
  const rows=ZONES.map(z=>{
    const cells=[];for(let h=6;h<27;h++){let n=0,m=0;days.forEach(dd=>{const v=surgeAt(z.id,at(dd,h+.5).getTime());if(v>1){n++;m+=v;}});cells.push({h,n,mult:n?m/n:1});}
    const wins=[];let cur=null;
    cells.forEach(c=>{if(c.n>=4){if(!cur){cur={a:c.h,b:c.h+1,n:0,m:0,k:0};wins.push(cur);}cur.b=c.h+1;cur.n+=c.n;cur.m+=c.mult;cur.k++;}else cur=null;});
    return {zone:z.id,wins:wins.map(w=>({a:w.a,b:w.b,days:Math.round(w.n/w.k),mult:w.m/w.k}))};
  });
  const score=r=>r.wins.reduce((t,w)=>t+w.days*(w.b-w.a),0);
  return {withS:rows.filter(r=>r.wins.length).sort((x,y)=>score(y)-score(x)),none:rows.filter(r=>!r.wins.length).map(r=>Z[r.zone].name)};
}

/* where and when it pays: typical $/online hr by zone and two-hour block */
export function heatData(snap,mode){
  const dow=mode==='wk'?2:6, blocks=[];for(let h=6;h<26;h+=2)blocks.push(h);
  const mine={};snap.recs.filter(r=>r.s>=snap.now-56*DAY).forEach(r=>{const s=new Date(r.s);const wk=s.getDay()===0||s.getDay()===6;if((mode==='wk')===wk)return;let h=s.getHours();if(h<6)h+=24;const b=6+Math.floor((h-6)/2)*2;const k=r.zone+'|'+b;mine[k]=(mine[k]||0)+r.dur;});
  const top=Object.entries(mine).sort((a,b)=>b[1]-a[1]).slice(0,4).map(e=>e[0]);
  const rows=ZONES.map(z=>({z,cells:blocks.map(b=>{const e=expected(z.id,dow,b+1);return {b,epoh:e.epoh,util:e.util,mine:top.includes(z.id+'|'+b)};})}));
  return {blocks,rows};
}

/* =====================================================================
   Menu tab
   ===================================================================== */
export function weekData(snap,dec){
  const nd=new Date(snap.now), w=monday(nd);
  const days=[];
  for(let i=0;i<7;i++){
    const d=addDays(w,i),e=addDays(w,i+1);
    let day=0,late=0;
    snap.recs.filter(r=>r.s>=d.getTime()&&r.s<e.getTime()).forEach(r=>{const h=hourOf(new Date(r.s));(h>=RULES.lateStart||h<RULES.lateEnd)?late+=r.dur:day+=r.dur;});
    days.push({d,day,late,tot:day+late,future:d>nd,today:sod(nd).getTime()===d.getTime()});
  }
  const tot=days.reduce((a,x)=>a+x.tot,0), lateTot=days.reduce((a,x)=>a+x.late,0);
  const wkHrs=[];for(let k=1;k<=8;k++){const ws=addDays(w,-7*k),we=addDays(ws,7);wkHrs.push(snap.recs.filter(r=>r.s>=ws.getTime()&&r.s<we.getTime()).reduce((x,r)=>x+r.dur,0));}
  const uLo=Math.round(quantile(wkHrs,.25)),uHi=Math.round(quantile(wkHrs,.75));
  return {days,tot,lateTot,uLo,uHi,over:tot>uHi*1.15,cons:dec.wb.cons};
}
export function offersData(snap){
  const nd=new Date(snap.now), wk=monday(nd), ends=[];
  for(let k=11;k>=0;k--)ends.push(k===0?snap.now:addDays(wk,-7*(k-1)).getTime());
  const roll=ends.map(e=>agg(snap.recs.filter(r=>r.s>=e-28*DAY&&r.s<e)));
  const now=roll[roll.length-1], then=roll[0];
  const lostPerWk=Math.max(0,(now.offT-now.offers)/4)*(now.offers?now.earn/now.offers:0);
  const reasons=[];
  if(!M.meets('cancellation',now.cancelRate))reasons.push(`your cancellation rate went from ${pct(then.cancelRate)} to ${pct(now.cancelRate)}`);
  if(!M.meets('rating',now.rating))reasons.push(`your rating slid from ${then.rating.toFixed(2)} to ${now.rating.toFixed(2)}`);
  return {roll,now,then,lostPerWk,reasons,
    chip:!M.meets('tripOffers',now.offIdx)?{tone:'warn',t:`${pct(1-now.offIdx)} fewer than typical`}:now.offIdx<.98?{tone:'neutral',t:'Slightly below typical'}:{tone:'go',t:'In line with typical'}};
}

/* =====================================================================
   Home tab: live demand (normal demand for the zone and hour, plus the
   live gap above it). "Demand above normal" = at least 12 points above
   normal for this hour (metrics.SIGNALS). This is not surge pricing.
   ===================================================================== */
export const STATE_LABEL={go:'Opportunity',warn:'Take a break',calm:'On pace',cool:'Cool-down',start:'Demand building',gold:'Gold offer'};
export const dmCol=v=>v>=.70?'#D92D3A':v>=.55?'#8E2A7E':v>=.40?'#D98E00':null;
export function liveDemand(snap,cur){
  const nd=new Date(snap.now), dow=nd.getDay(), h=hourOf(nd), L=snap.m.live||{};
  return ZONES.map(z=>{
    const d0=demand(z.id,dow,h), gap=L[z.id]||0, lv=clamp(d0+gap,.05,.98), e0=expected(z.id,dow,h).epoh;
    return {z:z.id,d0,gap,lv,e0,e:e0*(1+(lv/d0-1)*.5),mins:travel(cur,z.id),near:travel(cur,z.id)<=RULES.maxDrive,above:M.demandAboveNormal(lv,d0),surge:surgeAt(z.id,snap.now),surgeOn:M.surgePricingOn(surgeAt(z.id,snap.now))};
  });
}
export function demandSummary(snap,cur){
  const live=liveDemand(snap,cur), near=live.filter(x=>x.near&&x.above).sort((a,b)=>b.gap-a.gap);
  const txt=!near.length?'Demand is normal nearby for this time of day.':`Demand is above normal in ${near.map(x=>Z[x.z].name).join(' and ')}.`;
  return {live,near,txt};
}

/* =====================================================================
   Your standing by period: past day, 1 week, past month (28 days), this quarter.
   Counts behind each rate, and the median of similar drivers over the same dates.
   ===================================================================== */
export const STANDING_WINDOWS=[['day','Past day'],['week','1 week'],['month','Past month'],['quarter','This quarter']];
export function standingWindow(snap,key){
  const nd=new Date(snap.now);
  const start=key==='day'?snap.now-DAY:key==='week'?snap.now-7*DAY:key==='month'?snap.now-28*DAY:new Date(nd.getFullYear(),Math.floor(nd.getMonth()/3)*3,1).getTime();
  const desc={day:'Last 24 hours',week:'Last 7 days',month:'Last 28 days',quarter:`Since ${MON[Math.floor(nd.getMonth()/3)*3]} 1`}[key];
  const a=agg(snap.recs.filter(r=>r.s>=start&&r.s<snap.now));
  const peers=PEER_RECS.map(rs=>agg(rs.filter(x=>x.s>=start&&x.s<snap.now))).filter(p=>p.online>0);
  const med=(f,k)=>median(peers.filter(f).map(p=>p[k]));
  return {key,desc,a,empty:!a.online,n:peers.length,
    peer:{acc:med(p=>p.offers>0,'acc'),rating:med(p=>p.rc>0,'rating'),cancel:med(p=>p.accepted>0,'cancelRate'),offIdx:med(p=>p.offT>0,'offIdx')}};
}
