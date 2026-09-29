import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as E from './engine.js';

/* Scenarios come from the engine: Demand (Wed 3:45 PM, offline), Gold (Fri 6:25 PM, online), Rest (Sun 10 PM, cool-down). */
const R = E.RULES; /* all limits come from metrics.js via the engine */

/* ------------------------------------------------------------------ */
/* Icons (inline SVG, stroke-based)                                    */
/* ------------------------------------------------------------------ */
const Icon = ({ children, className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);
const HomeIcon = (p) => <Icon {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></Icon>;
const EarningsIcon = (p) => <Icon {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M7 12h.01M17 12h.01" /></Icon>;
const OpportunitiesIcon = (p) => <Icon {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" /></Icon>;
const MenuIcon = (p) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;
const SteeringIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="M12 14v7M10 12H3M14 12h7" /></Icon>;
const StopIcon = (p) => <Icon {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></Icon>;
const CheckIcon = (p) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
const XIcon = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
const ChevronIcon = (p) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
const StarIcon = ({ className = 'h-3 w-3' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Design system primitives                                            */
/* ------------------------------------------------------------------ */
const Card = ({ children, className = '' }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>
);

const Eyebrow = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</p>
);

const Pill = ({ children, tone = 'peach' }) => {
  const tones = {
    peach: 'bg-orange-50 text-orange-700 border-orange-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
};

const CHIP_TONES = {
  go: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-orange-50 text-orange-700 border-orange-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  gold: 'bg-amber-500 text-white border-amber-500',
  goldOutline: 'bg-white text-amber-800 border-amber-300',
};
const Chip = ({ children, tone = 'neutral' }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CHIP_TONES[tone]}`}>
    {children}
  </span>
);

const TabTitle = ({ children }) => <h1 className="pt-2 text-2xl font-bold tracking-tight">{children}</h1>;

const SectionHead = ({ title, note }) => (
  <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
    <h2 className="text-base font-bold">{title}</h2>
    {note && <span className="text-right text-[11px] text-slate-500">{note}</span>}
  </div>
);

const SubNote = ({ children, className = '' }) => <p className={`text-xs text-slate-500 ${className}`}>{children}</p>;

const Segmented = ({ options, value, onChange, label, dark = false }) => (
  <div className="flex gap-1 rounded-full bg-slate-100 p-1" role="group" aria-label={label}>
    {options.map(([k, l]) => {
      const on = value === k;
      return (
        <button key={k} type="button" aria-pressed={on} onClick={() => onChange(k)}
          className={`min-h-[32px] flex-1 rounded-full text-xs font-semibold transition ${on ? (dark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-500 hover:text-slate-700'}`}>
          {l}
        </button>
      );
    })}
  </div>
);

const KV = ({ rows }) => (
  <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
    {rows.map(([k, v, tone], i) => (
      <React.Fragment key={i}>
        <dt className="text-slate-600">{k}</dt>
        <dd className={`text-right font-semibold tabular-nums ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-orange-700' : 'text-slate-900'}`}>{v}</dd>
      </React.Fragment>
    ))}
  </dl>
);

/* Chart readout: shows the hovered, focused or tapped bar/cell below a chart. */
const Readout = ({ item, hint }) => (
  <p className="min-h-[2.5rem] rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600" aria-live="polite">
    {item ? (<><span className="font-semibold text-slate-900">{item[0]}</span><br />{item.slice(1).filter(Boolean).join(' · ')}</>) : hint}
  </p>
);

const hitProps = (tip, setTip) => ({
  tabIndex: 0,
  role: 'button',
  'aria-label': tip.filter(Boolean).join(', '),
  onMouseEnter: () => setTip(tip),
  onFocus: () => setTip(tip),
  onClick: () => setTip(tip),
  style: { cursor: 'pointer', outline: 'none' },
});

const niceMax = (v) => { if (v <= 0) return 10; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

/* ------------------------------------------------------------------ */
/* Home (Pit Stop mode, isDriving === false), driven by the engine     */
/* ------------------------------------------------------------------ */
const useTick = (on = true) => {
  const [, setT] = useState(0);
  useEffect(() => { if (!on) return undefined; const id = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(id); }, [on]);
};
const fmtHMS = (ms) => { ms = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(ms / 3600)}:${String(Math.floor((ms % 3600) / 60)).padStart(2, '0')}:${String(ms % 60).padStart(2, '0')}`; };
const LockIcon = (p) => <Icon {...p}><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>;
const MoonIcon = (p) => <Icon {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Icon>;
const CheckCircleIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.8" /></Icon>;
const ArrowUpIcon = (p) => <Icon {...p}><path d="M12 19V5M12 5l-6 6M12 5l6 6" /></Icon>;
const TrendIcon = (p) => <Icon {...p}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></Icon>;

const DriverGreeting = ({ snap, dec }) => {
  const nd = new Date(snap.now), cool = dec.state === 'cool', live = !!snap.live;
  return (
    <header className="flex items-start justify-between gap-3 pt-2">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
          Hi, Alex {snap.m.gold && <Chip tone="gold"><StarIcon className="h-2.5 w-2.5" />Gold driver</Chip>}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {cool || !live ? 'Offline' : E.Z[dec.op.cur].name} • {E.DOW[nd.getDay()]} {E.MON[nd.getMonth()]} {nd.getDate()} • {E.fmtClock(nd)}
        </p>
      </div>
      <span className={`mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
        <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        {live ? `Online · ${E.fmtH(dec.wb.liveH)}` : cool ? 'Offline · Cool-down' : 'Offline'}
      </span>
    </header>
  );
};

const NOW_TONES = {
  go: 'border-emerald-500 bg-emerald-50', warn: 'border-orange-500 bg-orange-50', calm: 'border-slate-400 bg-slate-100',
  cool: 'border-slate-400 bg-slate-100', start: 'border-slate-200 bg-white', gold: 'border-amber-300 bg-gradient-to-br from-amber-50 to-white',
};
const NowShell = ({ tone, chip, chipTone, children }) => (
  <section className={`space-y-2 rounded-2xl border-[1.5px] p-4 ${NOW_TONES[tone]}`} aria-live="polite" aria-label="Right now">
    <div className="flex items-center justify-between gap-3"><Eyebrow>Right now</Eyebrow><Chip tone={chipTone}>{chip}</Chip></div>
    {children}
  </section>
);

const CoolCard = ({ snap, dec }) => {
  const [start] = useState(Date.now());
  useTick();
  const du = dec.wb.duty, REST = R.restHrs * E.HOUR;
  const left = Math.max(0, du.until - (snap.now + (Date.now() - start)));
  return (
    <NowShell tone="cool" chip={<><LockIcon className="h-3 w-3" />Cool-down</>} chipTone="neutral">
      <p className="flex items-center gap-2 text-xl font-bold text-slate-800"><LockIcon className="h-6 w-6" />Cool-down mode</p>
      <p className="font-mono text-4xl font-semibold tabular-nums text-slate-700">{fmtHMS(left)}</p>
      <p className="text-xs text-slate-600">until you can go online · {E.whenLabel(snap, du.until)}</p>
      <div className="h-1.5 overflow-hidden rounded bg-white" role="img" aria-label="Rest progress"><div className="h-full bg-slate-500" style={{ width: `${100 * (1 - left / REST)}%` }} /></div>
      <button type="button" disabled aria-disabled="true" className="flex min-h-[44px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-slate-400 text-sm font-semibold text-slate-600">
        <LockIcon className="h-4 w-4" />Go online is locked
      </button>
      <p className="text-xs text-slate-600">You reached the {R.maxShift}-hour limit. Rest {R.restHrs} hours before your next shift.</p>
    </NowShell>
  );
};

const OFFER_SECS = 180;
const GoOffer = ({ snap, dec, ui, setUi }) => {
  const mid = snap.m.id, op = dec.op, b = op.best, zn = E.Z[b.zone].name, here = E.Z[op.cur].name;
  const resp = ui.resp[mid], deadline = ui.deadline[mid];
  useEffect(() => { if (!resp && !deadline) setUi((u) => ({ ...u, deadline: { ...u.deadline, [mid]: Date.now() + OFFER_SECS * 1000 } })); }, [resp, deadline, mid, setUi]);
  useTick(!resp);
  const setResp = (r) => setUi((u) => ({ ...u, resp: { ...u.resp, [mid]: r }, deadline: r ? u.deadline : { ...u.deadline, [mid]: undefined } }));
  const leftS = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : OFFER_SECS;
  useEffect(() => { if (!resp && deadline && leftS <= 0) setResp('expired'); });
  const Undo = ({ label = 'Undo' }) => <button type="button" onClick={() => setResp(undefined)} className="text-xs text-slate-500 underline">{label}</button>;
  if (resp === 'yes') return (
    <NowShell tone="go" chip={<><ArrowUpIcon className="h-3 w-3" />Accepted</>} chipTone="go">
      <p className="flex items-center gap-2 text-xl font-bold"><ArrowUpIcon className="h-6 w-6 text-emerald-700" />On your way to {zn}</p>
      <p className="text-xs text-slate-600">Arrive around {E.fmtClock(new Date(snap.now + b.mins * 60000))}. Expected {E.money(b.move, 0)} over the next {op.H} hrs.</p>
      <Undo />
    </NowShell>
  );
  if (resp === 'no' || resp === 'expired') return (
    <NowShell tone="calm" chip={<><CheckCircleIcon className="h-3 w-3" />{resp === 'no' ? 'Staying put' : 'Offer expired'}</>} chipTone="neutral">
      <p className="flex items-center gap-2 text-xl font-bold"><CheckCircleIcon className="h-6 w-6 text-slate-600" />Staying in {here}</p>
      <p className="text-xs text-slate-600">{resp === 'expired' ? `The ${zn} suggestion timed out. ` : ''}Expected {E.money(op.stay, 0)}{resp === 'expired' ? ' here' : ''} over the next {op.H} hrs.</p>
      <Undo label={resp === 'expired' ? 'Show it again' : 'Undo'} />
    </NowShell>
  );
  return (
    <section className="space-y-1.5 rounded-2xl border-[1.5px] border-emerald-500 bg-emerald-50 p-3.5" aria-live="polite" aria-label="Right now">
      <p className="text-xs font-semibold text-emerald-800">We found an opportunity for you</p>
      <p className="flex items-center gap-2 text-lg font-bold"><ArrowUpIcon className="h-5 w-5 text-emerald-700" />Head to {zn}</p>
      <p className="text-sm font-medium text-emerald-800">{b.mins} min drive</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white px-3 py-2"><p className="text-[11px] text-slate-500">Stay in {here}</p><p className="text-lg font-bold tabular-nums">{E.money(op.stay, 0)}</p></div>
        <div className="rounded-xl border-[1.5px] border-emerald-500 bg-white px-3 py-2"><p className="text-[11px] text-slate-500">Go to {zn}</p><p className="text-lg font-bold tabular-nums text-emerald-700">{E.money(b.move, 0)}</p></div>
      </div>
      <div className="flex justify-between text-[11px] text-slate-500"><span>Expected earnings, next {op.H} hrs, drive unpaid</span><b className="text-sm text-emerald-700">+{E.money(b.gainPerHr)}/hr after the drive</b></div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setResp('no')} className="min-h-[40px] rounded-xl border-[1.5px] border-emerald-500 bg-white text-sm font-semibold">Decline</button>
        <button type="button" onClick={() => setResp('yes')} className="min-h-[40px] rounded-xl bg-emerald-600 text-sm font-semibold text-white">Accept</button>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-white"><div className={`h-full ${leftS <= 30 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${(100 * leftS) / OFFER_SECS}%` }} /></div>
      <div className="flex justify-between text-[11px] text-slate-500"><span>Offer expires in</span><b className="font-mono text-slate-900">{Math.floor(leftS / 60)}:{String(leftS % 60).padStart(2, '0')}</b></div>
    </section>
  );
};

const NowCard = ({ snap, dec, claims, onClaim, ui, setUi }) => {
  const { state, wb, op } = dec;
  if (state === 'cool') return <CoolCard snap={snap} dec={dec} />;
  if (state === 'start') {
    const on = !!ui.online[snap.m.id], D = E.demandSummary(snap, op.cur), t = D.near[0];
    return (
      <NowShell tone="start" chip={<><TrendIcon className="h-3 w-3" />Demand building</>} chipTone="blue">
        <h2 className="text-lg font-bold leading-snug">Demand is building nearby</h2>
        <p className="text-sm leading-relaxed text-slate-600">{D.txt}{t ? ` ${E.Z[t.z].name} is ${t.mins} min away, at ${E.pct(t.lv)} demand against ${E.pct(t.d0)} normal.` : ''}</p>
        <button type="button" onClick={() => setUi((u) => ({ ...u, online: { ...u.online, [snap.m.id]: !on } }))}
          className={`w-full rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98] ${on ? 'border-[1.5px] border-emerald-500 bg-emerald-50 text-emerald-800' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
          {on ? `You are online in ${E.Z[op.cur].name} · tap to go offline` : 'Go online'}
        </button>
      </NowShell>
    );
  }
  if (state === 'gold') {
    const e = dec.gt, g = E.goldEstimate(snap, e, op.cur), st = claims[e.id], mins = g.mins;
    return (
      <NowShell tone="gold" chip={<><StarIcon className="h-2.5 w-2.5" />Gold offer</>} chipTone="gold">
        <p className="flex items-center gap-2 text-xl font-bold"><StarIcon className="h-5 w-5 text-amber-500" />{e.name}</p>
        <p className="text-sm font-medium text-amber-800">{e.venue} · {E.fmtHour(e.a)} – {E.fmtHour(e.b)} pickups</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2"><p className="text-[11px] text-slate-500">Typical in {E.Z[e.zone].name}</p><p className="text-xl font-bold tabular-nums">{E.money(g.typical, 0)}<span className="text-xs text-slate-500">/hr</span></p></div>
          <div className="rounded-xl border-[1.5px] border-amber-500 bg-white px-3 py-2"><p className="text-[11px] text-slate-500">Gold slot</p><p className="text-xl font-bold tabular-nums text-amber-800">{E.money(g.goldRate, 0)}<span className="text-xs">/hr</span></p></div>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>{Math.round(e.prem * 100)}% premium on fares · {e.left - (st === 'yes' ? 1 : 0)} of {e.of} slots left</span>
          <EventButtons id={e.id} st={st} block="" onClaim={onClaim} />
        </div>
        <p className="text-xs text-slate-600">{mins} min · {g.km} km from {E.Z[op.cur].name} · +{E.money(g.gainPerHr)}/hr vs staying, after the drive.</p>
      </NowShell>
    );
  }
  if (state === 'go') return <GoOffer snap={snap} dec={dec} ui={ui} setUi={setUi} />;
  const today = E.agg(snap.live ? snap.live.recs : []);
  if (state === 'warn') {
    const stat = wb.duty.hours >= R.nearLimit ? `${E.fmtH(wb.duty.hours)} on · ${E.fmtH(R.maxShift - wb.duty.hours)} to the ${R.maxShift}h limit` : `${E.fmtH(wb.liveH)} on · ${E.fmtClock(new Date(snap.now))}`;
    return (
      <NowShell tone="warn" chip={<><MoonIcon className="h-3 w-3" />Take a break</>} chipTone="warn">
        <p className="flex items-center gap-2 text-xl font-bold"><MoonIcon className="h-6 w-6 text-orange-700" />Time to wrap up</p>
        <p className="font-mono text-sm font-semibold text-orange-800">{stat}</p>
        <p className="text-xs text-slate-600">You've made {E.money(today.earn)} this shift. {op.qualifies && op.best ? `${E.Z[op.best.zone].name} is paying more right now, but it's late in a long shift.` : "Rest now and tomorrow's shift starts fresh."}</p>
      </NowShell>
    );
  }
  return (
    <NowShell tone="calm" chip={<><CheckCircleIcon className="h-3 w-3" />On pace</>} chipTone="neutral">
      <p className="flex items-center gap-2 text-xl font-bold"><CheckCircleIcon className="h-6 w-6 text-slate-600" />You're in a good spot</p>
      <p className="font-mono text-sm font-semibold text-slate-700">About {E.money(op.stay, 0)} expected here over the next {op.H} hrs</p>
      <p className="text-xs text-slate-600">Once drive time is counted, nothing within {R.maxDrive} minutes beats {E.Z[op.cur].name} by enough to be worth moving.</p>
    </NowShell>
  );
};

const DemandMap = ({ cur, live }) => {
  const hot = live.filter((x) => E.dmCol(x.lv));
  const gi = (c) => (c === '#D92D3A' ? 0 : c === '#8E2A7E' ? 1 : 2);
  return (
    <svg viewBox="0 0 340 210" className="block h-auto w-full" role="img" aria-label="Live city demand map">
      <defs>
        {['#D92D3A', '#8E2A7E', '#D98E00'].map((c, i) => (
          <radialGradient key={c} id={`dg${i}`}><stop offset="0" stopColor={c} stopOpacity=".6" /><stop offset="1" stopColor={c} stopOpacity="0" /></radialGradient>
        ))}
      </defs>
      <CityBase />
      {hot.map((x) => { const [px, py] = CITY_XY[x.z]; return <circle key={x.z} cx={px} cy={py} r={40 + 50 * (x.lv - 0.4)} fill={`url(#dg${gi(E.dmCol(x.lv))})`} />; })}
      {E.ZONES.map((z) => {
        const [px, py] = CITY_XY[z.id], x = hot.find((y) => y.z === z.id);
        const t = x ? `${x.above ? '↑ ' : ''}${E.money(x.e, 0)}/hr` : '', w = t.length * 6.3 + 16;
        return (
          <g key={z.id}>
            <circle cx={px} cy={py} r="4" fill={x ? E.dmCol(x.lv) : '#94a3b8'} />
            <text x={px} y={py + 16} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#475569">{z.name}</text>
            {x && <><rect x={px - w / 2} y={py - 30} width={w} height="20" rx="10" fill={E.dmCol(x.lv)} /><text x={px} y={py - 16} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{t}</text></>}
          </g>
        );
      })}
      <YouMarker zone={cur} />
    </svg>
  );
};

const DemandNear = ({ snap, dec }) => {
  const cur = dec.op.cur, D = E.demandSummary(snap, cur), cool = dec.state === 'cool';
  return (
    <section>
      <SectionHead title="Demand near you" note="Live" />
      {dec.state !== 'start' && <p className="mb-2 px-1 text-sm text-slate-600">{D.txt}</p>}
      <Card className="space-y-2 p-3">
        <div className="overflow-hidden rounded-xl border border-slate-100"><DemandMap cur={cur} live={D.live} /></div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>Demand: normal</span><i className="block h-1.5 w-14 rounded bg-gradient-to-r from-[#D98E00] via-[#8E2A7E] to-[#D92D3A]" /><span>high</span><span className="ml-auto">↑ above normal for this hour</span>
        </div>
        {D.near.slice(0, 3).map((x) => (
          <div key={x.z} className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-slate-100 py-2 text-xs text-slate-500">
            <span><b className="text-sm text-slate-900">{E.Z[x.z].name}</b>{x.z === cur && <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-px text-[9px] font-semibold uppercase text-white">You're here</span>}<br />{x.z === cur ? 'Your current area' : `${x.mins} min · ${E.km(x.mins)} km away`}</span>
            <span className="text-right font-semibold tabular-nums text-slate-900">{E.pct(x.d0)} → {E.pct(x.lv)} demand<br /><span className="font-medium text-slate-500">{E.money(x.e0, 0)} → {E.money(x.e, 0)}/hr</span></span>
          </div>
        ))}
        {cool && D.near.length > 0 && <SubNote>You're resting until {E.whenLabel(snap, dec.wb.duty.until)}. This is for information only.</SubNote>}
      </Card>
    </section>
  );
};

const HoursStrip = ({ snap, dec }) => {
  const du = dec.wb.duty, M = R.maxShift, h = Math.min(du.hours, M), left = Math.max(0, M - du.hours);
  const todayH = E.agg(snap.recs.filter((r) => r.s >= E.sod(new Date(snap.now)).getTime())).online;
  const tone = du.capped ? 'max' : du.hours >= R.nearLimit ? 'near' : '';
  return (
    <Card>
      <Eyebrow>Hours since last rest</Eyebrow>
      <p className="mt-2 text-2xl font-bold">{E.fmtH(h)} <span className="text-base font-medium text-slate-500">of {M}h</span></p>
      {Math.abs(todayH - du.hours) > 0.05 && <p className="text-xs text-slate-600">Online today: {E.fmtH(todayH)}</p>}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={h} aria-valuemin={0} aria-valuemax={M}>
        <div className={`h-full rounded-full ${tone === 'max' ? 'bg-red-600' : tone === 'near' ? 'bg-orange-500' : 'bg-blue-600'}`} style={{ width: `${(100 * h) / M}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        {du.capped ? (<><span className="font-semibold text-red-700">Limit reached</span><span>Online again {E.whenLabel(snap, du.until)}</span></>)
          : (<><span className={tone ? 'font-semibold text-orange-700' : ''}>{du.hours ? `${E.fmtH(left)} left` : `Full ${M}h available`}</span><span>{R.restHrs}h rest after {M}h</span></>)}
      </div>
    </Card>
  );
};

/* Three tiers per metric: good (green), medium (amber), focus (soft red). Supportive wording throughout. */
const TIER_STYLE = {
  good: { tile: 'border-emerald-200 bg-emerald-50', num: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  mid: { tile: 'border-amber-200 bg-amber-50', num: 'text-amber-700', chip: 'bg-amber-100 text-amber-800 border-amber-200' },
  bad: { tile: 'border-rose-200 bg-rose-50', num: 'text-rose-700', chip: 'bg-rose-100 text-rose-800 border-rose-200' },
};
const TIER_CHIP = { good: 'On track', mid: 'Almost there', bad: 'Focus' };

const AccountStandingGrid = ({ snap }) => {
  const [win, setWin] = useState('month');
  const W = useMemo(() => E.standingWindow(snap, win), [snap, win]);
  const a = W.a, p = W.peer;
  const T = E.THRESHOLDS;
  const fewer = Math.max(1, a.cancels - Math.floor(T.cancellation.goal * a.accepted));
  const tiles = [
    { key: 'acc', th: 'acceptance', label: 'Acceptance rate', value: E.pct(a.acc), num: a.accepted, den: a.offers, t: a.offers ? E.tierOf('acceptance', a.acc) : null, count: `${a.accepted} of ${a.offers} offers`, goal: T.acceptance.label, peer: E.pct(p.acc) },
    { key: 'rating', th: 'rating', label: 'Rating', value: a.rc ? (Math.round(a.rating * 100) / 100).toFixed(2) : '–', star: true, t: a.rc ? E.tierOf('rating', a.rating) : null, count: `${a.rc} ratings · ${a.trips} trips`, goal: T.rating.label, peer: p.rating.toFixed(2) },
    { key: 'cancel', th: 'cancellation', label: 'Cancellation rate', value: E.pct(a.cancelRate), num: a.cancels, den: a.accepted, t: a.accepted ? E.tierOf('cancellation', a.cancelRate) : null, count: `${a.cancels} of ${a.accepted} accepted trips`, goal: T.cancellation.label, peer: E.pct(p.cancel),
      tip: `Cancel ${fewer} fewer trip${fewer === 1 ? '' : 's'} to reach ${E.pct(T.cancellation.goal)}.` },
    { key: 'offers', th: 'tripOffers', label: 'Trip offers', value: E.pct(a.offIdx), num: a.offers, den: a.offT, t: a.offT ? E.tierOf('tripOffers', a.offIdx) : null, count: `${a.offers} of ${Math.round(a.offT)} typical`, goal: T.tripOffers.label, peer: E.pct(p.offIdx) },
  ];
  return (
    <section className="space-y-3">
      <SectionHead title="Your standing" note={W.desc} />
      <Segmented options={E.STANDING_WINDOWS} value={win} onChange={setWin} label="Standing period" />
      {W.empty ? (
        <Card><SubNote className="py-3 text-center">No trips in this period.</SubNote></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((t) => {
              const st = TIER_STYLE[t.t] || { tile: 'border-slate-200 bg-white', num: 'text-slate-900', chip: '' };
              return (
                <section key={t.key} className={`flex flex-col rounded-2xl border p-3.5 ${st.tile}`} data-metric={t.th} data-num={t.num} data-den={t.den} data-shown={t.value}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-2xl font-bold leading-tight tabular-nums ${st.num}`}>{t.value}{t.star && t.value !== '–' && <span className="text-lg">★</span>}</p>
                    {t.t && <span className={`mt-1 whitespace-nowrap rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${st.chip}`}>{TIER_CHIP[t.t]}</span>}
                  </div>
                  <p className="text-xs font-medium text-slate-800">{t.label}</p>
                  <p className="mt-2 text-[11px] text-slate-600">{t.count}</p>
                  <div className="mt-1.5 space-y-0.5 border-t border-black/5 pt-1.5 text-[11px] text-slate-500">
                    <p className="flex justify-between gap-2"><span>Goal</span><b className="font-semibold text-slate-700" data-threshold={t.th}>{t.goal}</b></p>
                    <p className="flex justify-between gap-2"><span>Similar drivers</span><b className="font-semibold text-slate-700">{t.peer}</b></p>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};

const PitStopView = (props) => (
  <div className="space-y-5">
    <DriverGreeting snap={props.snap} dec={props.dec} />
    <NowCard {...props} />
    <DemandNear snap={props.snap} dec={props.dec} />
    <HoursStrip snap={props.snap} dec={props.dec} />
    <AccountStandingGrid snap={props.snap} />
  </div>
);

/* ------------------------------------------------------------------ */
/* Traffic mode (isDriving === true): glanceable HUD, no scrolling     */
/* ------------------------------------------------------------------ */
/* Driving mode reads the active scenario through E.drivingView (A2). */
const ArrowUpRightIcon = (p) => <Icon {...p}><path d="M7 17 17 7" /><path d="M8 7h9v9" /></Icon>;

const GuardrailBar = ({ hours }) => {
  const pct = Math.min(100, (hours / R.maxShift) * 100);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 bg-slate-200 lg:absolute"
         role="progressbar" aria-label={`${E.fmtH(hours)} of ${R.maxShift} hours since last rest`}
         aria-valuenow={hours} aria-valuemin={0} aria-valuemax={R.maxShift}>
      <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
    </div>
  );
};

const TrafficView = ({ snap, dec }) => {
  const V = E.drivingView(snap, dec);
  if (!V) return null;
  const { number, action, status } = V;
  return (
    <div className="flex h-full flex-col" data-screen="driving">
      <GuardrailBar hours={status.hours} />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-6xl font-bold tracking-tight tabular-nums">{number.value == null ? '–' : `${E.money(number.value, 0)}/hr`}</p>
        <p className="mt-2 text-base font-medium text-slate-600">{number.label}</p>
        <p className="mt-4 text-base font-semibold text-slate-700">{E.fmtH(status.hours)} {status.label}</p>
      </div>
      <section className={`flex min-h-[220px] flex-col justify-between gap-3 rounded-2xl p-5 text-white shadow-sm ${action.kind === 'gold' ? 'bg-amber-700' : 'bg-blue-700'}`}>
        <div className="flex items-center gap-4">
          <ArrowUpRightIcon className="h-16 w-16 shrink-0" />
          <p className="text-2xl font-bold leading-tight">{action.title}{action.mins ? ` · ${action.mins} min` : ''}</p>
        </div>
        {action.detail && <p className="text-lg font-medium text-white/90">{action.detail}</p>}
        <p className="text-lg font-medium text-white/90">{action.mins ? `${action.mins} min · ${action.km} km from ${E.Z[V.from].name}` : ''}</p>
        <button type="button" className="h-14 w-full rounded-xl bg-white text-lg font-bold text-slate-900 active:scale-[0.98]">Navigate</button>
      </section>
    </div>
  );
};

/* ================================================================== */
/* EARNINGS TAB                                                        */
/* ================================================================== */
const EarningsBars = ({ P, period }) => {
  const [tip, setTip] = useState(null);
  const W = 364, H = 150, L = 34, R = 4, T = 14, B = 22, iw = W - L - R, ih = H - T - B;
  const vals = P.buckets.map((x) => E.agg(x.recs));
  const mx = niceMax(Math.max(...vals.map((v) => v.earn), 1));
  const n = Math.max(P.buckets.length, 1), band = iw / n, bw = Math.min(24, band * 0.62);
  let maxI = -1, maxV = -1; vals.forEach((v, i) => { if (v.earn > maxV) { maxV = v.earn; maxI = i; } });
  const lastI = P.buckets.map((q) => !q.future && q.recs.length > 0).lastIndexOf(true);
  if (!P.buckets.length) return <SubNote className="py-6 text-center">No driving yet today.</SubNote>;
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
           aria-label={`Earnings by ${period === 'today' ? 'hour' : 'period'}, bar chart`} onMouseLeave={() => setTip(null)}>
        {[0, 0.5, 1].map((f) => {
          const y = T + ih - ih * f;
          return (
            <g key={f}>
              <line x1={L} x2={W - R} y1={y} y2={y} stroke="#e2e8f0" />
              <text x={L - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="#64748b">{E.money(mx * f, 0)}</text>
            </g>
          );
        })}
        {P.buckets.map((bk, i) => {
          const v = vals[i], cx = L + band * i + band / 2, x = cx - bw / 2, h = (ih * v.earn) / mx, y = T + ih - h;
          const r = Math.min(4, h, bw / 2);
          const showLbl = !P.sparse || i % 2 === 0 || i === n - 1;
          const tipRow = [bk.full, bk.future ? 'Not yet' : `${E.money(v.earn)} earned`, v.online ? `${E.hrsWord(v.online)} online · ${E.money(v.epoh)}/hr` : bk.future ? '' : 'Rest day'];
          return (
            <g key={i}>
              {h > 0 && <path d={`M${x},${T + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${T + ih} Z`}
                               fill="#2563eb" opacity={i === lastI || P.buckets.length < 3 ? 1 : 0.55} />}
              {h <= 0 && bk.future && <line x1={x} x2={x + bw} y1={T + ih - 0.5} y2={T + ih - 0.5} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />}
              {showLbl && <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b">{bk.label}</text>}
              {i === maxI && maxV > 0 && <text x={cx} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#334155">{E.money(v.earn, 0)}</text>}
              <rect x={L + band * i} y={T} width={band} height={ih + B} fill="transparent" {...hitProps(tipRow, setTip)} />
            </g>
          );
        })}
      </svg>
      <Readout item={tip} hint="Tap a bar for hours and earnings per hour." />
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer py-1 text-slate-500">Show as table</summary>
        <table className="mt-1 w-full tabular-nums">
          <thead><tr className="text-slate-900">{['Period', 'Earned', 'Hours', '$/hr'].map((h, i) => <th key={h} className={`border-b border-slate-100 px-1.5 py-1 font-semibold ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
          <tbody>
            {P.buckets.filter((x) => !x.future).map((x) => {
              const g = E.agg(x.recs);
              return (
                <tr key={x.full}>
                  <td className="border-b border-slate-100 px-1.5 py-1">{x.full}</td>
                  <td className="border-b border-slate-100 px-1.5 py-1 text-right">{E.money(g.earn)}</td>
                  <td className="border-b border-slate-100 px-1.5 py-1 text-right">{g.online ? g.online.toFixed(1) : '0'}</td>
                  <td className="border-b border-slate-100 px-1.5 py-1 text-right">{g.online ? g.epoh.toFixed(2) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
};

/* one row of the three-part shift breakdown */
const SplitRows = ({ S }) => {
  const max = Math.max(...S.parts.map((p) => Math.abs(p.v)), 1);
  const sg = (v) => `${v >= 0 ? '+' : '−'}${E.money(Math.abs(v))}/hr`;
  return (
    <div className="divide-y divide-slate-200">
      {S.parts.map((p) => {
        const neg = p.v < 0, w = Math.max(4, (48 * Math.abs(p.v)) / max);
        return (
          <details key={p.k} className="group">
            <summary className="grid cursor-pointer list-none grid-cols-[92px_1fr_auto_16px] items-center gap-2 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="text-xs font-semibold">{p.t}</span>
              <span className="relative h-2 rounded bg-slate-200">
                <span className="absolute -bottom-1 -top-1 left-1/2 w-px bg-slate-400" />
                <span className={`absolute inset-y-0 rounded ${neg ? 'bg-orange-500' : 'bg-emerald-500'}`}
                      style={neg ? { right: '50%', width: `${w}%` } : { left: '50%', width: `${w}%` }} />
              </span>
              <span className={`min-w-[76px] text-right text-xs font-semibold tabular-nums ${neg ? 'text-orange-700' : 'text-emerald-700'}`}>{sg(p.v)}</span>
              <ChevronIcon className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
            </summary>
            <div className="pb-3">{p.rows ? <KV rows={p.rows} /> : <SubNote>Too few drivers here today to compare.</SubNote>}</div>
          </details>
        );
      })}
    </div>
  );
};

const EphBlock = ({ snap, dec, P, recs, a, period }) => {
  const [info, setInfo] = useState(false);
  const [sub, setSub] = useState('max');
  const pk = E.peakHour(recs);
  const b = E.bench(snap, P, a, period);
  const usual = E.usualFor(snap, recs);
  const showWhy = period === 'today' && snap.live && a.online >= 0.75 && a.epoh < usual * 0.95;
  const cool = dec.state === 'cool';
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-800">Earnings per online hour</span>
          <button type="button" onClick={() => setInfo((v) => !v)} aria-expanded={info} aria-label="How this is calculated"
            className={`grid h-5 w-5 place-items-center rounded-full border-[1.5px] border-blue-800 font-serif text-xs font-bold italic ${info ? 'bg-blue-800 text-white' : 'text-blue-800'}`}>i</button>
        </div>
        <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
          {a.online ? E.money(a.epoh) : '–'}{a.online > 0 && <span className="text-base font-medium text-slate-500"> /hr</span>}
        </p>
        {info && (
          <div className="mt-2 space-y-1 rounded-xl bg-white p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">How we calculate this</p>
            <p>Everything you earned (fares, surge and tips) divided by the time you were online, including time spent waiting for a trip.</p>
            {a.online > 0 && <p className="font-mono text-slate-900">{E.money(a.earn)} ÷ {E.fmtH(a.online)} online = {E.money(a.epoh)}/hr</p>}
            {pk && <p>Your best hour in this period was {E.fmtHour(pk.h)}, at {E.money(pk.epoh, 0)}/hr.</p>}
          </div>
        )}
        {b && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600"><Chip tone={b.tone}>{b.chip}</Chip><span>{b.text}</span></div>}
        {showWhy && (
          <details className="mt-2 rounded-xl bg-white px-3">
            <summary className="cursor-pointer py-2 text-xs font-semibold text-blue-800">Why is this shift slow?</summary>
            <SplitRows S={E.slowSplit(snap, snap.live.recs, usual)} />
          </details>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Hours online', a.online ? E.fmtH(a.online) : '–'],
          ['Rides accepted', <>{a.accepted} <span className="text-xs font-medium text-slate-500">of {a.offers} offers</span></>],
          ['Acceptance rate', a.offers ? E.pct(a.acc) : '–'],
          ['Km driven', <>{Math.round(a.km)} <span className="text-xs font-medium text-slate-500">km</span></>],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-100 px-3 py-2">
            <p className="text-[11px] text-slate-500">{k}</p>
            <p className="text-lg font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      {!cool && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Earnings per hour detail">
          {[['max', 'Maximize earnings'], ['perf', "How you've performed"]].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={sub === k} onClick={() => setSub(k)}
              className={`min-h-[38px] rounded-lg text-xs font-semibold ${sub === k ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      )}
      <Card>{!cool && sub === 'max' ? <Maximize snap={snap} /> : <Performed snap={snap} P={P} recs={recs} a={a} period={period} />}</Card>
    </div>
  );
};

const Maximize = ({ snap }) => {
  const M = useMemo(() => E.maximizeLevers(snap), [snap]);
  if (M.empty) return <SubNote>Not enough driving in the last 4 weeks to suggest changes.</SubNote>;
  if (!M.list.length) return <SubNote>You're already close to what your zones and hours can pay. Keep doing what you're doing.</SubNote>;
  return (
    <div className="space-y-2">
      <div className="flex justify-between rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
        <span>Last 4 weeks, all hours <b className="text-base">{E.money(M.a.epoh)}/hr</b></span>
        <span>Possible <b className="text-base">{E.money(M.reach)}/hr</b></span>
      </div>
      <div className="divide-y divide-slate-200">
        {M.list.map((l) => (
          <details key={l.t} className="group" data-lever={l.key || ''} data-from={l.from || ''} data-to={l.to || ''} data-zone-gain={l.zoneGain || ''}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold">{l.personal ? l.sub : l.t}{l.personal && <span className="block text-xs font-normal text-slate-600">{l.t}</span>}</span>
              <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold tabular-nums text-emerald-700">
                +{E.money(l.g)}/hr<ChevronIcon className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
              </span>
            </summary>
            {l.why && <p className="pb-1 text-xs font-medium leading-relaxed text-slate-700">{l.why}</p>}
            <p className="pb-3 text-xs leading-relaxed text-slate-600">{l.x}</p>
          </details>
        ))}
      </div>
      <SubNote>Right column: effect on your overall $/hr. Tap a row for details. Gains overlap, so “possible” is an upper estimate.</SubNote>
    </div>
  );
};

const Performed = ({ snap, P, recs, a, period }) => {
  const R = useMemo(() => E.performed(snap, P, recs, a, period), [snap, P, recs, a, period]);
  if (R.msg) return <SubNote>{R.msg}</SubNote>;
  return (
    <div className="space-y-2">
      <SubNote>Compared with the top 20% of earners ({R.n} drivers) in {R.zoneNames}, {R.desc}.</SubNote>
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="text-[11px] text-slate-500">
            <th className="pb-1.5 text-left font-semibold">Metric</th><th className="pb-1.5 text-right font-semibold">You</th><th className="pb-1.5 text-right font-semibold">Top earners</th>
          </tr>
        </thead>
        <tbody>
          {R.rows.map((r) => (
            <tr key={r.l} className={r.hero ? 'text-sm font-bold' : ''}>
              <td className="border-t border-slate-200 py-2 pr-2">{r.l}</td>
              <td className={`border-t border-slate-200 py-2 text-right font-semibold ${r.tone === 'good' ? 'text-emerald-700' : r.tone === 'bad' ? 'text-orange-700' : ''}`}>{r.you}</td>
              <td className="border-t border-slate-200 py-2 text-right">{r.top}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SubNote>Green: at or above top earners. Orange: the gap to close. Acceptance and km are context only: turning down poor offers can pay, and more km isn't better on its own.</SubNote>
    </div>
  );
};

const ShiftDiagnosis = ({ snap }) => {
  const list = useMemo(() => E.completedShifts(snap).slice(0, 12), [snap]);
  const [id, setId] = useState(list[0] && list[0].id);
  const sh = list.find((s) => s.id === id) || list[0];
  const D = useMemo(() => {
    if (!sh) return null;
    const usual = E.shiftUsual(snap, sh);
    return { a: E.agg(sh.recs), usual, S: E.slowSplit(snap, sh.recs, usual) };
  }, [snap, sh]);
  if (!sh) return null;
  const diff = D.a.epoh / D.usual - 1;
  return (
    <Card className="space-y-3">
      <label className="sr-only" htmlFor="shift-pick">Choose a shift</label>
      <select id="shift-pick" value={sh.id} onChange={(e) => setId(e.target.value)}
        className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
        {list.map((s) => <option key={s.id} value={s.id}>{E.dayLabel(new Date(s.s))} · {E.fmtRange(s.s, s.e)} · {E.money(E.agg(s.recs).earn, 0)}</option>)}
      </select>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{E.money(D.a.epoh)}/hr</span>
        {Math.abs(diff) < 0.05 ? <Chip>About your usual</Chip>
          : diff < 0 ? <Chip tone="warn">{Math.round(-diff * 100)}% below your usual {E.money(D.usual)}/hr</Chip>
          : <Chip tone="go">{Math.round(diff * 100)}% above your usual {E.money(D.usual)}/hr</Chip>}
      </div>
      <SplitRows S={D.S} />
      <SubNote>Your usual = median weekly $/hr for {E.dayPartLabel(sh.recs)} over the 8 weeks before this shift. Tap a row for the numbers behind it. The three parts add up to the gap against your usual.</SubNote>
    </Card>
  );
};

const EarningsView = ({ snap, dec }) => {
  const hasToday = E.periodBuckets(snap, dec, 'today').buckets.length > 0;
  const [period, setPeriod] = useState(dec.state === 'cool' || hasToday ? 'today' : 'week');
  const P = useMemo(() => E.periodBuckets(snap, dec, period), [snap, dec, period]);
  const recs = useMemo(() => P.buckets.flatMap((x) => x.recs), [P]);
  const a = useMemo(() => E.agg(recs), [recs]);
  const cool = dec.state === 'cool';
  return (
    <div className="space-y-6">
      <TabTitle>Earnings</TabTitle>
      <section className="space-y-3">
        {!cool && <Segmented options={E.PERIODS} value={period} onChange={setPeriod} label="Period" />}
        <div>
          <p className="text-xs text-slate-500">{P.label}</p>
          <p className="text-5xl font-bold tracking-tight tabular-nums">{E.money(a.earn)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium text-white">
            {[['bg-blue-700', E.money(a.base), 'fares'], ['bg-orange-700', E.money(a.surge), 'surge'], ['bg-emerald-700', E.money(a.tips), 'tips'], ['bg-slate-700', a.trips, 'trips']].map(([c, v, l]) => (
              <span key={l} className={`inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 ${c}`}><b className="text-xs tabular-nums">{v}</b>{l}</span>
            ))}
          </div>
        </div>
        <EarningsBars P={P} period={period} />
        <EphBlock snap={snap} dec={dec} P={P} recs={recs} a={a} period={period} />
      </section>
      <section>
        <SectionHead title="Why a shift landed where it did" />
        <ShiftDiagnosis snap={snap} />
      </section>
    </div>
  );
};

/* ================================================================== */
/* OPPORTUNITIES TAB                                                   */
/* ================================================================== */
const CITY_XY = { dt: [172, 100], mt: [108, 150], ap: [285, 45], un: [48, 178], wf: [255, 150], ns: [112, 44] };
const surgeCol = (m) => (m >= 1.5 ? '#D92D3A' : m >= 1.25 ? '#8E2A7E' : '#D98E00');

const CityBase = () => (
  <>
    <rect width="340" height="210" fill="#f1f5f9" />
    <path d="M250 0H340V70Q300 60 270 90Q250 50 250 0Z" fill="#dbeafe" />
    <g stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" fill="none">
      <path d="M10 120 Q120 90 330 130" /><path d="M110 8 Q140 100 100 205" /><path d="M60 170 Q160 150 280 40" /><path d="M200 205 Q230 120 300 90" />
    </g>
  </>
);
const YouMarker = ({ zone }) => {
  const [cx, cy] = CITY_XY[zone];
  return (
    <g>
      <circle cx={cx} cy={cy} r="11" fill="#fff" stroke="#0f172a" strokeWidth="2.5" />
      <path d={`M${cx} ${cy - 6}L${cx + 4.5} ${cy + 5}L${cx} ${cy + 2.5}L${cx - 4.5} ${cy + 5}Z`} fill="#0f172a" />
    </g>
  );
};

const SurgingNow = ({ snap, cur }) => {
  const S = useMemo(() => E.surgeNow(snap, cur), [snap, cur]);
  return (
    <section>
      <SectionHead title="Surge pricing now" note="Fare multiplier above 1.0×" />
      <p className="mb-2 px-1 text-sm text-slate-600">{S.txt}</p>
      <Card className="overflow-hidden p-0">
        <svg viewBox="0 0 340 210" className="block h-auto w-full" role="img" aria-label="Map of areas with surge pricing on now">
          <defs>
            {['#D92D3A', '#8E2A7E', '#D98E00'].map((c, i) => (
              <radialGradient key={c} id={`sg${i}`}><stop offset="0" stopColor={c} stopOpacity=".55" /><stop offset="1" stopColor={c} stopOpacity="0" /></radialGradient>
            ))}
          </defs>
          <CityBase />
          {S.hot.map((x) => { const [px, py] = CITY_XY[x.z]; return <circle key={x.z} cx={px} cy={py} r={46 + 18 * (x.m - 1)} fill={`url(#sg${x.m >= 1.5 ? 0 : x.m >= 1.25 ? 1 : 2})`} />; })}
          {E.ZONES.map((z) => {
            const [px, py] = CITY_XY[z.id], h = S.hot.find((x) => x.z === z.id);
            const t = h ? `${h.m.toFixed(1)}× +$${(z.fare * (h.m - 1)).toFixed(2)}` : '', w = t.length * 6.1 + 16;
            return (
              <g key={z.id}>
                <circle cx={px} cy={py} r="4" fill={h ? surgeCol(h.m) : '#94a3b8'} />
                <text x={px} y={py + 16} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#475569">{z.name}</text>
                {h && <><rect x={px - w / 2} y={py - 30} width={w} height="20" rx="10" fill={surgeCol(h.m)} /><text x={px} y={py - 16} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{t}</text></>}
              </g>
            );
          })}
          <YouMarker zone={cur} />
        </svg>
        {S.hot.length > 0 && (
          <ul className="divide-y divide-slate-100 px-4 py-1">
            {S.hot.map((x) => (
              <li key={x.z} className="flex items-center justify-between gap-3 py-2 text-xs text-slate-500">
                <span><b className="text-sm text-slate-900">{E.Z[x.z].name}</b><br />{x.z === cur ? 'Your current area' : `${E.travel(cur, x.z)} min · ${E.km(E.travel(cur, x.z))} km away`}</span>
                <span className="text-right font-semibold tabular-nums text-slate-900">{x.m.toFixed(1)}×<br /><span className="font-medium text-slate-500">+{E.money(E.Z[x.z].fare * (x.m - 1))}/trip</span></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
};

const MINI_XY = { dt: [38, 38], mt: [30, 52], ap: [64, 12], un: [18, 66], wf: [60, 58], ns: [34, 14] };
const MiniMap = ({ best, cur, gold }) => (
  <svg viewBox="0 0 76 76" className={`h-[76px] w-[76px] shrink-0 rounded-lg border ${gold ? 'border-amber-300 bg-white' : 'border-slate-200 bg-slate-50'}`} role="img" aria-label={`${E.Z[best].name} on the city map`}>
    <line x1="6" y1="28" x2="70" y2="46" stroke="#e2e8f0" strokeWidth="3" />
    <line x1="26" y1="6" x2="44" y2="70" stroke="#e2e8f0" strokeWidth="3" />
    {E.ZONES.map((z) => {
      const [x, y] = MINI_XY[z.id], b = z.id === best, c = z.id === cur;
      return (
        <g key={z.id}>
          <circle cx={x} cy={y} r={b ? 7 : 4} fill={b ? (gold ? '#d97706' : '#059669') : '#94a3b8'} opacity={b ? 1 : 0.55} />
          {c && <circle cx={x} cy={y} r={b ? 11 : 8} fill="none" stroke="#2563eb" strokeWidth="2" />}
        </g>
      );
    })}
  </svg>
);

const EventButtons = ({ id, st, block, onClaim }) => {
  if (block) return <span className="text-[11px] text-slate-500">{block}</span>;
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Respond to event slot">
      {st && <span className={`text-xs font-semibold ${st === 'yes' ? 'text-emerald-700' : 'text-slate-500'}`}>{st === 'yes' ? 'Accepted' : 'Declined'}</span>}
      <button type="button" aria-label="Accept slot" aria-pressed={st === 'yes'} onClick={() => onClaim(id, 'yes')}
        className={`grid h-10 w-12 place-items-center rounded-lg bg-emerald-600 text-white ${st === 'no' ? 'opacity-40' : ''}`}><CheckIcon className="h-5 w-5" /></button>
      <button type="button" aria-label="Decline slot" aria-pressed={st === 'no'} onClick={() => onClaim(id, 'no')}
        className={`grid h-10 w-12 place-items-center rounded-lg bg-red-600 text-white ${st === 'yes' ? 'opacity-40' : ''}`}><XIcon className="h-5 w-5" /></button>
    </div>
  );
};

const GoldBanner = ({ G }) => (
  <div className="mx-4 mt-3 space-y-1.5 rounded-xl border-[1.5px] border-amber-300 bg-amber-50 p-3">
    <div className="flex items-center justify-between gap-2 text-sm font-semibold text-amber-900">
      <span className="flex items-center gap-1.5"><StarIcon className="h-3.5 w-3.5 text-amber-500" />Gold event slots</span>
      <Chip tone={G.ok ? 'gold' : 'goldOutline'}>{G.ok ? 'Unlocked' : 'Locked'}</Chip>
    </div>
    <p className="text-xs text-slate-600">
      {G.ok ? 'You meet the standard. Tick a slot to accept it and earn a premium on top of your usual fares near live events.'
            : 'Reach the standard to claim premium slots near sports games, concerts, live events and college let-outs.'}
    </p>
    <details>
      <summary className="cursor-pointer list-none text-xs font-semibold text-amber-900 [&::-webkit-details-marker]:hidden">The standard, last 28 days ›</summary>
      <div className="mt-1.5"><KV rows={G.rows.map((x) => [`${x.k} (${x.need})`, x.you + (x.ok ? ' ✓' : ''), x.ok ? 'good' : 'bad'])} /></div>
    </details>
  </div>
);

const OptionsNearYou = ({ snap, dec, claims, onClaim }) => {
  const [dayIdx, setDayIdx] = useState(0);
  const O = useMemo(() => E.optionsForDay(snap, dec, dayIdx, claims), [snap, dec, dayIdx, claims]);
  const cur = O.cur;
  const fromCur = (z) => (z === cur ? 'Your current area' : `${E.travel(cur, z)} min · ${E.km(E.travel(cur, z))} km from ${E.Z[cur].name}`);
  return (
    <section>
      <SectionHead title="Options near you" note={`Best area within ${R.maxDrive} min · $/online hr, drive unpaid`} />
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-slate-100 px-1.5 pt-2" role="group" aria-label="Day">
          {O.days.map((d, i) => {
            const on = i === dayIdx, isT = i === 0;
            return (
              <button key={i} type="button" aria-pressed={on} onClick={() => setDayIdx(i)}
                className={`flex flex-col items-center gap-px border-b-[3px] pb-2 pt-1 ${on ? 'border-slate-900' : 'border-transparent'}`}>
                <span className={`text-[11px] ${on ? 'text-slate-900' : 'text-slate-500'}`}>{E.DOW[d.getDay()][0]}</span>
                <b className={`text-sm ${isT ? 'text-blue-700' : ''}`}>{d.getDate()}</b>
              </button>
            );
          })}
        </div>
        <div className="bg-slate-50 px-4 py-2 text-sm font-semibold">{E.DOW_FULL[O.day.getDay()]}, {E.MON[O.day.getMonth()]} {O.day.getDate()}</div>
        {O.cool && O.isToday ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-600"><LockIcon className="h-5 w-5" /></span>
            <p className="text-base font-semibold">You're not eligible to see options for today</p>
            <p className="text-xs text-slate-500">You're resting until <b className="text-slate-700">{O.until}</b>. Pick another day above to see its options.</p>
            <button type="button" onClick={() => setDayIdx(1)} className="mt-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">See tomorrow's options</button>
          </div>
        ) : (<>
        {O.cool && (
          <div className="mx-4 mt-3 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <LockIcon className="mt-px h-4 w-4 shrink-0" />
            <span>Your rest ends <b>{O.until}</b>. Options on this day are open as usual.</span>
          </div>
        )}
        <GoldBanner G={O.G} />

        {O.rightNow && (
          <div className="mt-3">
            <div className="bg-slate-50 px-4 py-1.5 text-xs text-slate-600">Right now · top 2 options, next {O.rightNow.H} hrs, drive included</div>
            <div className="space-y-1 p-2">
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-xl bg-blue-50 px-3 py-2.5 shadow-[inset_3px_0_0_#2563eb]">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-800">{E.Z[cur].name}<span className="rounded-full bg-blue-600 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">You're here</span></p>
                  <p className="text-xs text-blue-700/80">Stay put · about {E.money(O.rightNow.here, 0)}/hr right now</p>
                </div>
                <p className="text-right text-sm font-semibold tabular-nums">{E.money(O.rightNow.stay, 0)}<span className="block text-[11px] font-medium text-slate-500">next {O.rightNow.H} hrs</span></p>
              </div>
              {O.rightNow.list.map((o) => (
                <div key={o.zone} className="grid grid-cols-[1fr_auto] items-center gap-x-3 border-b border-slate-100 px-3 py-2.5 last:border-0">
                  <div>
                    <p className={`flex items-center gap-1.5 text-sm font-semibold ${o.dem ? 'text-slate-400' : ''}`}>{E.Z[o.zone].name}{o.best && <span className="rounded-full bg-emerald-600 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">Best next</span>}</p>
                    <p className="text-xs text-slate-500">{o.mins} min · {E.km(o.mins)} km away · {o.reason}</p>
                    {o.dem && o.good && <div className="mt-1"><Chip tone="warn">Late in a long shift</Chip></div>}
                  </div>
                  <p className={`text-right text-sm font-semibold tabular-nums ${o.good && !o.dem ? 'text-emerald-700' : o.dem ? 'text-slate-400' : ''}`}>
                    {o.gainPerHr > 0.005 ? '+' : o.gainPerHr < -0.005 ? '−' : '±'}{E.money(Math.abs(o.gainPerHr))}/hr<span className="block text-[11px] font-medium text-slate-500">after the drive</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pb-2">
          {!O.items.length && <p className="px-4 py-3 text-sm text-slate-500">No more time windows today</p>}
          {O.items.map((it) => it.kind === 'window' ? (
            <div key={`w${it.a}`} className={`flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ${it.now ? 'bg-blue-50' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-slate-600">{E.fmtHour(it.a)} – {E.fmtHour(it.b)}{it.now ? ' · now' : ''}</p>
                <p className="text-[15px] font-semibold">{E.Z[it.best.z].name}</p>
                <p className="text-xs text-slate-600">About {E.money(it.best.afterDrive, 0)}/hr{it.best.z !== cur ? `, after the ${it.best.mins} min drive` : ' typical'}</p>
                <p className="text-xs text-slate-600">{fromCur(it.best.z)}</p>
                {it.mine && <p className="text-xs text-slate-600">{E.Z[cur].name}: {E.money(it.mine.afterDrive, 0)}/hr</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {it.surge && <Chip tone="warn">Surge pricing likely, up to {it.surge.toFixed(1)}×</Chip>}
                  <Chip tone={it.busy === 'Busy' ? 'go' : 'neutral'}>{it.busy}</Chip>
                </div>
              </div>
              <MiniMap best={it.best.z} cur={cur} />
            </div>
          ) : (
            <div key={it.e.id} className={`mx-3 my-2 rounded-xl border-[1.5px] border-amber-300 bg-gradient-to-br from-amber-50 to-white p-3 ${it.st === 'no' ? 'opacity-50' : ''}`}>
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap gap-1.5"><Chip tone="gold"><StarIcon className="h-2.5 w-2.5" />Gold</Chip><Chip>{it.e.type}</Chip></div>
                  <p className="font-mono text-xs text-slate-600">{E.fmtHour(it.e.a)} – {E.fmtHour(it.e.b)} pickups</p>
                  <p className="text-[15px] font-semibold">{it.e.name}</p>
                  <p className="text-xs text-slate-600">{it.e.venue} · {E.Z[it.e.zone].name}</p>
                  <p className="text-xs text-slate-600">{fromCur(it.e.zone)}</p>
                  <p className="mt-1 text-sm font-semibold text-amber-800">+{Math.round(it.e.prem * 100)}% · about {E.money(it.gold, 0)}/hr vs {E.money(it.typ, 0)} typical · +{E.money(it.ge.gainPerHr)}/hr after the {it.ge.mins} min drive</p>
                </div>
                <MiniMap best={it.e.zone} cur={cur} gold />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">{it.leftN} of {it.e.of} slots left</span>
                <EventButtons id={it.e.id} st={it.st} block={it.block} onClaim={onClaim} />
              </div>
            </div>
          ))}
        </div>
        </>)}
      </Card>
    </section>
  );
};

const SurgeByDay = ({ snap, cur }) => {
  const todayDow = new Date(snap.now).getDay();
  const [dow, setDow] = useState(todayDow);
  const R = useMemo(() => E.surgeByDay(snap, dow), [snap, dow]);
  return (
    <section>
      <SectionHead title="Surge pricing by day" note="Last 8 weeks, city-wide" />
      <Card className="space-y-3">
        <div className="grid grid-cols-7 gap-1" role="group" aria-label="Day of week">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button key={d} type="button" aria-pressed={dow === d} onClick={() => setDow(d)}
              className={`relative min-h-[34px] rounded-lg border text-xs font-semibold ${dow === d ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
              {E.DOW[d]}{d === todayDow && <i className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-600" />}
            </button>
          ))}
        </div>
        <SubNote><b className="text-slate-900">{E.DOW_FULL[dow]}s</b>: areas with surge pricing on at least half of the last 8 {E.DOW_FULL[dow]}s.</SubNote>
        {R.withS.length ? R.withS.map((r) => (
          <div key={r.zone} className="space-y-1.5 border-t border-slate-100 pt-2">
            <p className="text-sm font-semibold">{E.Z[r.zone].name}{r.zone === cur && <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">You're here</span>}</p>
            <div className="flex flex-wrap gap-1.5">
              {r.wins.map((w) => (
                <span key={w.a} className="inline-flex items-baseline gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600">
                  <b className="text-slate-900">{E.fmtHour(w.a)}–{E.fmtHour(w.b)}</b>{w.mult.toFixed(1)}× · {w.days} of 8 weeks
                </span>
              ))}
            </div>
          </div>
        )) : <SubNote>No area had regular surge pricing on this day.</SubNote>}
        {R.none.length > 0 && R.withS.length > 0 && <SubNote>No regular surge: {R.none.join(', ')}</SubNote>}
        <SubNote>1.5× means fares were one and a half times the normal price during that window.</SubNote>
      </Card>
    </section>
  );
};

const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const WhereWhenHeat = ({ snap }) => {
  const [mode, setMode] = useState('wk');
  const [tip, setTip] = useState(null);
  const Hd = useMemo(() => E.heatData(snap, mode), [snap, mode]);
  const W = 364, L = 76, T = 4, cw = (W - L - 2) / Hd.blocks.length, ch = 24, H = T + Hd.rows.length * ch + 20;
  const lo = 12, hi = 42, step = (v) => Math.round(E.clamp((v - lo) / (hi - lo), 0, 1) * 6);
  return (
    <section>
      <SectionHead title="Where and when it pays" note="Typical $/online hr" />
      <Card className="space-y-3">
        <Segmented options={[['wk', 'Weekdays'], ['we', 'Weekends']]} value={mode} onChange={(m) => { setMode(m); setTip(null); }} label="Day type" />
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" onMouseLeave={() => setTip(null)}
             aria-label={`Typical earnings per online hour by zone and two-hour block, ${mode === 'wk' ? 'weekdays' : 'weekends'}`}>
          {Hd.rows.map((row, ri) => {
            const y = T + ri * ch;
            return (
              <g key={row.z.id}>
                <text x={L - 8} y={y + ch / 2 + 3.5} textAnchor="end" fontSize="11" fill="#475569">{row.z.name}</text>
                {row.cells.map((c, ci) => {
                  const x = L + ci * cw;
                  const tipRow = [`${row.z.name}, ${E.fmtHour(c.b)}–${E.fmtHour(c.b + 2)}`, `${E.money(c.epoh)}/hr typical`, `On a trip ${E.pct(c.util)} of the time${c.mine ? ' · you often drive here' : ''}`];
                  return (
                    <g key={c.b}>
                      <rect x={x + 1} y={y + 1} width={cw - 2} height={ch - 2} rx="3" fill={SEQ[step(c.epoh)]} />
                      {c.mine && <circle cx={x + cw / 2} cy={y + ch / 2} r="3.5" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />}
                      <rect x={x} y={y} width={cw} height={ch} fill="transparent" {...hitProps(tipRow, setTip)} />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {[6, 12, 18, 24].map((h) => <text key={h} x={L + ((h - 6) / 2) * cw} y={H - 4} fontSize="10" fill="#64748b">{E.fmtHour(h)}</text>)}
        </svg>
        <Readout item={tip} hint="Tap a cell for the typical rate and time on a trip." />
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <svg width="140" height="8" aria-hidden="true">{SEQ.map((c, i) => <rect key={c} x={i * 20} y="0" width="20" height="8" fill={c} />)}</svg>
          <span>{E.money(lo, 0)} → {E.money(hi, 0)}+ /hr</span>
          <span className="flex items-center gap-1"><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="3.5" fill="#fff" stroke="#0f172a" strokeWidth="1.5" /></svg>Where you usually drive</span>
        </div>
      </Card>
    </section>
  );
};

const OpportunitiesView = ({ snap, dec, claims, onClaim }) => (
  <div className="space-y-6">
    <TabTitle>Opportunities</TabTitle>
    <SurgingNow snap={snap} cur={dec.op.cur} />
    <OptionsNearYou snap={snap} dec={dec} claims={claims} onClaim={onClaim} />
    <SurgeByDay snap={snap} cur={dec.op.cur} />
    <WhereWhenHeat snap={snap} />
  </div>
);

/* ================================================================== */
/* MENU TAB                                                            */
/* ================================================================== */
const ShiftLimits = ({ snap, dec }) => {
  const du = dec.wb.duty, G = E.goldElig(snap);
  return (
    <section>
      <SectionHead title="Shift limits and rest" />
      <Card className="space-y-3">
        <KV rows={[
          ['Maximum online time per shift', `${R.maxShift}h`],
          ['Rest required after that', `${R.restHrs}h offline`],
          ['Logged now (since last rest)', E.fmtH(Math.min(du.hours, R.maxShift))],
          ['Early flag: long shift', `${R.longDay}+ hours`],
          ['Early flag: late night', `after ${E.fmtHour(R.lateStart)}, ${R.lateMinHours}+ hours in`],
          ['Early flag: last 24 hours', `${R.last24}+ hours`],
          ['Early flag: no rest day', `${R.noRestDays}+ days in a row`],
        ]} />
        <SubNote>At {R.maxShift} hours the app takes you offline and locks going online until the rest is done.</SubNote>
        <KV rows={[['Gold event slots', G.ok ? 'Gold driver' : 'Locked'], ...G.rows.map((x) => [`${x.k} (${x.need})`, x.you, x.ok ? 'good' : 'bad'])]} />
      </Card>
    </section>
  );
};

const YourWeek = ({ snap, dec }) => {
  const Wk = useMemo(() => E.weekData(snap, dec), [snap, dec]);
  const [tip, setTip] = useState(null);
  const W = 364, H = 120, L = 24, T = 12, B = 22, iw = W - L - 4, ih = H - T - B, mx = 8, band = iw / 7, bw = 22;
  const mW = 320, mx2 = Math.max(30, Math.ceil((Wk.uHi * 1.4) / 5) * 5), xs = (v) => (mW * v) / mx2;
  return (
    <section>
      <SectionHead title="Your week" note="Hours online, by day" />
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-4 text-[11px] text-slate-600">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-blue-600" />Before 10 PM</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-orange-500" />After 10 PM</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Hours online each day this week" onMouseLeave={() => setTip(null)}>
          {[0, 4, 8].map((v) => { const y = T + ih - (ih * v) / mx; return <g key={v}><line x1={L} x2={W - 4} y1={y} y2={y} stroke="#e2e8f0" /><text x={L - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="#64748b">{v}h</text></g>; })}
          {Wk.days.map((x, i) => {
            const cx = L + band * i + band / 2, bx = cx - bw / 2;
            const hD = (ih * Math.min(x.day, mx)) / mx, hL = (ih * Math.min(x.late, mx)) / mx;
            const topD = T + ih - hD, yL = topD - (hL > 0 && hD > 0 ? 2 : 0);
            const tipRow = [E.dayLabel(x.d), x.future ? 'Not yet' : x.tot ? `${E.hrsWord(x.tot)} online` : 'Rest day', x.late ? `${E.hrsWord(x.late)} after 10 PM` : ''];
            return (
              <g key={i}>
                {hD > 0 && <rect x={bx} y={topD} width={bw} height={hD} rx={hL > 0 ? 0 : 3} fill="#2563eb" />}
                {hL > 0 && <path d={`M${bx},${yL} V${yL - hL + 3} Q${bx},${yL - hL} ${bx + 3},${yL - hL} H${bx + bw - 3} Q${bx + bw},${yL - hL} ${bx + bw},${yL - hL + 3} V${yL} Z`} fill="#f97316" />}
                {!x.tot && !x.future && <text x={cx} y={T + ih - 6} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#047857">rest</text>}
                {x.future && <line x1={bx} x2={bx + bw} y1={T + ih - 0.5} y2={T + ih - 0.5} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />}
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill={x.today ? '#0f172a' : '#64748b'} fontWeight={x.today ? 600 : 400}>{E.DOW[x.d.getDay()]}</text>
                <rect x={L + band * i} y={T} width={band} height={ih + B} fill="transparent" {...hitProps(tipRow, setTip)} />
              </g>
            );
          })}
        </svg>
        <Readout item={tip} hint="Tap a day for hours online." />
        <div className="flex justify-between text-xs text-slate-600">
          <span>This week</span><span><b className="tabular-nums text-slate-900">{E.hrsWord(Wk.tot)}</b> · your usual is {Wk.uLo}–{Wk.uHi} hrs</span>
        </div>
        <svg viewBox={`0 0 ${mW} 18`} className="block h-auto w-full" role="img" aria-label={`${E.hrsWord(Wk.tot)} this week against your usual ${Wk.uLo} to ${Wk.uHi} hours`}>
          <rect x="0" y="5" width={mW} height="8" rx="4" fill="#e2e8f0" />
          <rect x={xs(Wk.uLo)} y="3" width={Math.max(2, xs(Wk.uHi) - xs(Wk.uLo))} height="12" rx="3" fill="#ecfdf5" stroke="#10b981" />
          <rect x="0" y="5" width={Math.max(6, xs(Math.min(Wk.tot, mx2)))} height="8" rx="4" fill={Wk.over ? '#ea580c' : '#2563eb'} />
        </svg>
        <SubNote>Usual = the middle half of your last 8 weeks.{Wk.over ? ' You are well past it this week.' : ''}</SubNote>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-[11px] text-slate-500">Days in a row</p><p className="text-base font-bold">{Wk.cons}</p></div>
          <div><p className="text-[11px] text-slate-500">After 10 PM this week</p><p className="text-base font-bold">{Wk.lateTot ? E.fmtH(Wk.lateTot) : 'None'}</p></div>
        </div>
      </Card>
    </section>
  );
};

const Spark = ({ label, val, series, lo, hi, thr, bad, fmt, thrLbl }) => {
  const W = 320, H = 40, x = (i) => 6 + ((W - 12) * i) / (series.length - 1), y = (v) => 12 + (H - 15) * (1 - E.clamp((v - lo) / (hi - lo), 0, 1));
  const pts = series.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
  const last = series[series.length - 1], isBad = last != null && bad(last), lp = pts[pts.length - 1];
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs text-slate-600"><span>{label}</span><b className={`tabular-nums ${isBad ? 'text-orange-700' : 'text-slate-900'}`}>{fmt(val)}</b></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${label}: now ${fmt(val)}; ${thrLbl}`}>
        <line x1="0" x2={W} y1={y(thr)} y2={y(thr)} stroke="#94a3b8" strokeDasharray="3 3" />
        <text x="2" y={y(thr) - 3} fontSize="9" fill="#64748b">{thrLbl}</text>
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {lp && <circle cx={lp[0]} cy={lp[1]} r="4" fill={isBad ? '#ea580c' : '#2563eb'} stroke="#fff" strokeWidth="2" />}
      </svg>
    </div>
  );
};

const TripOffers = ({ snap }) => {
  const O = useMemo(() => E.offersData(snap), [snap]);
  const n = O.now;
  return (
    <section>
      <SectionHead title="Your trip offers" note="4-week rolling, last 12 weeks" />
      <Card className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2"><span className="text-2xl font-bold tabular-nums">{n.offph.toFixed(1)} offers/hr</span><Chip tone={O.chip.tone}>{O.chip.t}</Chip></div>
        <p className="text-xs leading-relaxed text-slate-600">
          {!E.meets('tripOffers', n.offIdx) ? (
            <>You are getting fewer trip offers than drivers in the same zones and hours{O.reasons.length ? ` since ${O.reasons.join(' and ')}.` : '.'} That is roughly <b className="text-slate-900">{E.money(O.lostPerWk, 0)} a week</b> in trips you were never offered. Cancelling fewer accepted trips is the fastest lever.</>
          ) : `You get about as many offers as other drivers in the same zones and hours. Keep cancellations at ${E.THRESHOLDS.cancellation.label} and your rating at ${E.THRESHOLDS.rating.label} to keep it that way.`}
        </p>
        <div className="space-y-3">
          <Spark label="Offers vs typical, same zones and hours" val={n.offIdx} series={O.roll.map((a) => (a.online ? a.offIdx : null))} lo={0.7} hi={1.15} thr={1} bad={(v) => !E.meets('tripOffers', v)} fmt={E.pct} thrLbl="typical" />
          <Spark label="Cancellation rate (trips you accepted, then cancelled)" val={n.cancelRate} series={O.roll.map((a) => (a.accepted ? a.cancelRate : null))} lo={0} hi={0.12} thr={E.THRESHOLDS.cancellation.goal} bad={(v) => !E.meets('cancellation', v)} fmt={E.pct} thrLbl={E.pct(E.THRESHOLDS.cancellation.goal)} />
          <Spark label="Rating" val={n.rating} series={O.roll.map((a) => (a.rc ? a.rating : null))} lo={4.72} hi={5} thr={E.THRESHOLDS.rating.goal} bad={(v) => !E.meets('rating', v)} fmt={(v) => v.toFixed(2)} thrLbl={E.THRESHOLDS.rating.goal.toFixed(2)} />
        </div>
      </Card>
    </section>
  );
};

const MenuView = ({ snap, dec }) => {
  const cool = dec.state === 'cool';
  return (
    <div className="space-y-6">
      <TabTitle>Menu</TabTitle>
      <ShiftLimits snap={snap} dec={dec} />
      {!cool && <YourWeek snap={snap} dec={dec} />}
      {!cool && <TripOffers snap={snap} />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Prototype panel: scenarios, decision trace, about the data          */
/* ------------------------------------------------------------------ */
const STATE_CHIP = { go: 'go', warn: 'warn', calm: 'neutral', cool: 'neutral', start: 'blue', gold: 'gold' };
const momentLabel = (d) => `${E.DOW_FULL[d.getDay()]}, ${E.MON[d.getMonth()]} ${d.getDate()} · ${E.fmtClock(d)}`;

const TraceRow = ({ mark, label, val }) => (
  <div className="grid grid-cols-[16px_1fr_auto] items-baseline gap-2 py-0.5 text-xs text-slate-600">
    <span className={mark === '●' ? 'text-orange-600' : 'text-slate-400'}>{mark}</span><span>{label}</span>
    <span className="whitespace-nowrap font-mono text-[11px] text-slate-900">{val}</span>
  </div>
);
const TraceStep = ({ title, chip, tone, children }) => (
  <div className="border-b border-slate-100 py-2.5 last:border-0">
    <h3 className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold"><span>{title}</span><Chip tone={tone}>{chip}</Chip></h3>
    {children}
  </div>
);

const Trace = ({ snap, dec }) => {
  const { wb, op, state } = dec;
  if (state === 'cool') {
    const du = wb.duty;
    return (<>
      <TraceStep title="1 · Hard limit" chip="Reached" tone="warn">
        <TraceRow mark="●" label="Hours online since last rest" val={`${E.fmtH(Math.min(du.hours, R.maxShift))} of ${R.maxShift}h`} />
        <TraceRow label="Rest required" val={`${R.restHrs}h offline`} />
        <TraceRow label="Can go online again" val={E.whenLabel(snap, du.until)} />
      </TraceStep>
      <TraceStep title="2 · Shown" chip="Cool-down" tone="neutral"><TraceRow label="The app takes the driver offline and locks going online until the rest is done. Today's opportunities are hidden; the following days are open as usual." /></TraceStep>
    </>);
  }
  if (state === 'start') {
    const rows = E.liveDemand(snap, op.cur).sort((a, b) => b.gap - a.gap || b.lv - a.lv);
    return (<>
      <TraceStep title="1 · Offline" chip="Not driving" tone="neutral"><TraceRow label="No shift in progress, so the safety and opportunity checks do not apply" /></TraceStep>
      <TraceStep title="2 · Live demand vs normal" chip="Demand above normal" tone="blue">
        {rows.map((x) => <TraceRow key={x.z} mark={x.above ? '●' : '○'} label={`${E.Z[x.z].name}${x.near ? '' : ' (far)'}${x.surgeOn ? ` · surge pricing ${x.surge.toFixed(1)}×` : ''}`} val={`${E.pct(x.d0)} → ${E.pct(x.lv)}`} />)}
        <TraceRow label={`Normal demand for this hour, then live demand. ● means at least ${Math.round(E.SIGNALS.demandAboveGap * 100)} points above normal. Surge pricing (a fare multiplier above 1.0×) is a separate signal and is off in every area.`} />
      </TraceStep>
      <TraceStep title="3 · Shown" chip="Demand building" tone="blue"><TraceRow label="The top card names the nearby area with demand above normal and its $/hr after the unpaid drive, and offers Go online." /></TraceStep>
    </>);
  }
  if (state === 'gold') {
    const G = E.goldElig(snap), e = dec.gt;
    return (<>
      <TraceStep title="1 · Safety check" chip="Clear" tone="neutral"><TraceRow mark="○" label="Hours online this shift" val={`${E.fmtH(wb.duty.hours)} of ${R.maxShift}h`} /></TraceStep>
      <TraceStep title="2 · Gold standard" chip="Met" tone="gold">{G.rows.map((x) => <TraceRow key={x.k} mark={x.ok ? '✓' : '✗'} label={`${x.k}, ${x.need}`} val={x.you} />)}</TraceStep>
      <TraceStep title="3 · Event slot" chip="Fits" tone="gold"><TraceRow label={`${e.name}, ${E.fmtHour(e.a)} to ${E.fmtHour(e.b)}: projected hours stay under the ${R.maxShift}h limit`} val={`+${Math.round(e.prem * 100)}%`} /></TraceStep>
      <TraceStep title="4 · Shown" chip="Gold offer" tone="gold"><TraceRow label="A Gold driver with a slot that fits gets the event offer in the top card, with tick to accept and X to decline." /></TraceStep>
    </>);
  }
  const b = op.best, sign = b ? `${b.gain >= 0 ? '+' : '−'}${E.money(Math.abs(b.gain), 0)} (${b.move / op.stay >= 1 ? '+' : ''}${Math.round((b.move / op.stay - 1) * 100)}%)` : '–';
  const res = { warn: 'Safety wins the slot. Any opportunity drops to the list below, marked.', go: 'No safety flag, and a real gain nearby: the opportunity takes the slot.', calm: 'No safety flag, no gain worth the drive: a quiet confirmation.' }[state];
  return (<>
    <TraceStep title="1 · Safety check" chip={wb.tripped ? 'Tripped' : 'Clear'} tone={wb.tripped ? 'warn' : 'neutral'}>
      {wb.checks.map((c) => <TraceRow key={c.label} mark={c.hit ? '●' : '○'} label={c.label} val={c.val} />)}
    </TraceStep>
    <TraceStep title="2 · Opportunity check" chip={op.qualifies ? 'Found' : 'None'} tone={op.qualifies ? 'go' : 'neutral'}>
      <TraceRow label={`Stay in ${E.Z[op.cur].name}, next ${op.H} hrs`} val={E.money(op.stay, 0)} />
      <TraceRow label={`Best within ${R.maxDrive} min: ${b ? `${E.Z[b.zone].name}, after a ${b.mins} min unpaid drive` : 'none'}`} val={b ? E.money(b.move, 0) : '–'} />
      <TraceRow mark={op.qualifies ? '●' : '○'} label={`At least ${Math.round((R.oppRatio - 1) * 100)}% and ${E.money(R.oppMinGain, 0)} better over ${op.H} hrs`} val={sign} />
    </TraceStep>
    <TraceStep title="3 · Shown" chip={E.STATE_LABEL[state]} tone={STATE_CHIP[state]}><TraceRow label={res} /></TraceStep>
  </>);
};

const PrototypePanel = ({ momentId, onPick, claims, snap, dec }) => (
  <aside className="space-y-6 pt-2" aria-label="Prototype controls">
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">Assignment 5 · Uber Driver Dashboard</p>
      <h1 className="mb-2 mt-1.5 text-3xl font-bold tracking-tight">Driver Home</h1>
      <p className="max-w-[58ch] text-[15px] text-slate-600">A working prototype of the one-screen driver dashboard. Pick one of three scenarios; the top card and everything beneath it recompute from the mock data.</p>
    </div>
    <div>
      <h2 id="moments-h" className="mb-2.5 text-sm font-semibold">Pick a scenario from Alex's week, Sep 21–27, 2026</h2>
      <div className="grid gap-2" role="group" aria-labelledby="moments-h">
        {E.MOMENTS.map((m) => {
          const st = E.decide(E.snapshot(m), claims).state, on = m.id === momentId;
          return (
            <button key={m.id} type="button" aria-pressed={on} onClick={() => onPick(m.id)}
              className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-xl border bg-white px-3.5 py-3 text-left transition ${on ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'}`}>
              <span className="text-sm font-semibold">{momentLabel(m.now)}</span>
              <span className="row-span-2"><Chip tone={STATE_CHIP[st]}>{E.STATE_LABEL[st]}</Chip></span>
              <span className="text-xs text-slate-600">{m.blurb}</span>
            </button>
          );
        })}
      </div>
    </div>
    <div>
      <h2 className="mb-2.5 text-sm font-semibold">Why the top card shows this</h2>
      <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-1"><Trace snap={snap} dec={dec} /></div>
    </div>
    <p className="max-w-[60ch] text-xs text-slate-600"><b className="text-slate-900">About the data.</b> Alex is a part-time driver who works 20–25 hours a week around a day job. Everything here comes from a seeded generator: 52 weeks of Alex's shifts across six zones, a zone-by-hour demand model, city-wide surge history, and 80 simulated part-time drivers over the same 52 weeks, so every comparison uses the same dates. No real Uber data is used.</p>
    <p className="max-w-[60ch] text-xs text-slate-600"><b className="text-slate-900">Modelled assumptions.</b> Trip offers usually fall when a driver's cancellation rate passes {E.pct(E.THRESHOLDS.cancellation.goal)} or their rating drops below {E.THRESHOLDS.rating.goal.toFixed(2)}. Declining offers lifts the average fare but costs waiting time, more so in quiet hours. Every "move" estimate counts the drive as unpaid time, using fixed drive times between zones.</p>
  </aside>
);

/* ------------------------------------------------------------------ */
/* Layout chrome                                                       */
/* ------------------------------------------------------------------ */
const TABS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'earnings', label: 'Earnings', Icon: EarningsIcon },
  { id: 'opportunities', label: 'Opportunities', Icon: OpportunitiesIcon },
  { id: 'menu', label: 'Menu', Icon: MenuIcon },
];

/* On phones the nav is fixed to the screen; on desktop it sits at the bottom of the phone frame. */
const BottomNav = ({ active, onChange, locked }) => (
  <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:static"
       style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Primary">
    <ul className="mx-auto grid max-w-md grid-cols-4">
      {TABS.map(({ id, label, Icon: TabIcon }) => {
        const isActive = active === id, off = locked.includes(id);
        return (
          <li key={id}>
            <button type="button" onClick={() => onChange(id)} disabled={off} aria-current={isActive ? 'page' : undefined}
              title={off ? 'Locked during cool-down' : undefined}
              className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
              <TabIcon className="h-6 w-6" />
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

const DrivingToggleFab = ({ isDriving, onToggle }) => (
  <div className="pointer-events-none fixed inset-x-0 z-40 mx-auto flex max-w-md justify-end px-4 lg:absolute lg:bottom-[4.75rem]"
       style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}>
    <button type="button" onClick={onToggle} aria-pressed={isDriving}
      className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg active:scale-95 ${isDriving ? 'bg-white text-slate-900 ring-1 ring-slate-200' : 'bg-slate-900 text-white'}`}>
      {isDriving ? <StopIcon className="h-5 w-5" /> : <SteeringIcon className="h-5 w-5" />}
      {isDriving ? 'Stop (0 km/h)' : 'Simulate driving (>15 km/h)'}
    </button>
  </div>
);

/* ------------------------------------------------------------------ */
/* Master layout                                                       */
/* ------------------------------------------------------------------ */
const AppShell = () => {
  const [momentId, setMomentId] = useState(E.MOMENTS[0].id);
  const [isDriving, setIsDriving] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [claims, setClaims] = useState({});
  const [ui, setUi] = useState({ online: {}, resp: {}, deadline: {} });
  const scrollRef = useRef(null);
  const moment = E.MOMENTS.find((m) => m.id === momentId);
  const snap = useMemo(() => E.snapshot(moment), [moment]);
  const dec = useMemo(() => E.decide(snap, claims), [snap, claims]);
  const cool = dec.state === 'cool';
  const tab = activeTab;
  const onClaim = (id, act) => setClaims((c) => ({ ...c, [id]: c[id] === act ? undefined : act }));

  const toTop = () => { window.scrollTo(0, 0); if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  const changeTab = (id) => { setActiveTab(id); toTop(); };
  const pick = (id) => {
    setMomentId(id); setIsDriving(false); toTop();
    setUi((u) => (u.resp[id] === 'yes' || u.resp[id] === 'no' ? u : { ...u, resp: { ...u.resp, [id]: undefined }, deadline: { ...u.deadline, [id]: undefined } }));
  };

  const renderScreen = () => {
    if (isDriving && !cool) return <TrafficView snap={snap} dec={dec} />;
    const k = `${momentId}-${tab}`;
    if (tab === 'earnings') return <EarningsView key={k} snap={snap} dec={dec} />;
    if (tab === 'opportunities') return <OpportunitiesView key={k} snap={snap} dec={dec} claims={claims} onClaim={onClaim} />;
    if (tab === 'menu') return <MenuView key={k} snap={snap} dec={dec} />;
    return <PitStopView key={k} snap={snap} dec={dec} claims={claims} onClaim={onClaim} ui={ui} setUi={setUi} />;
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:bg-white lg:px-4 lg:py-7">
      <div className="mx-auto max-w-[1060px] lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-11">
        <div className="px-4 pb-6 pt-6 lg:px-0 lg:pt-0"><PrototypePanel momentId={momentId} onPick={pick} claims={claims} snap={snap} dec={dec} /></div>
        {/* Phone: full screen on mobile, a framed device with its own scroll on desktop. */}
        <div className="relative border-t border-slate-200 bg-slate-50 lg:sticky lg:top-5 lg:flex lg:h-[min(860px,calc(100dvh-40px))] lg:flex-col lg:overflow-hidden lg:rounded-[34px] lg:border lg:shadow-2xl">
          <div ref={scrollRef} className="lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
            <main className={isDriving
                ? 'relative mx-auto h-[100dvh] max-w-md overflow-hidden px-4 pt-6 pb-[calc(8.75rem+env(safe-area-inset-bottom))] lg:h-full lg:pb-24'
                : 'mx-auto max-w-md px-4 pb-40 pt-6 lg:pb-24'}>
              {renderScreen()}
              {!isDriving && <p className="mt-8 text-center text-[11px] text-slate-400">Prototype · mock data only</p>}
            </main>
          </div>
          {!cool && <DrivingToggleFab isDriving={isDriving} onToggle={() => setIsDriving((d) => !d)} />}
          <BottomNav active={isDriving ? '' : tab} onChange={(id) => { setIsDriving(false); changeTab(id); }} locked={[]} />
        </div>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<AppShell />);
