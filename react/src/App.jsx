
    import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

    /* ------------------------------------------------------------------ */
    /* Mock data                                                           */
    /* ------------------------------------------------------------------ */
    const DRIVER = { name: 'Alex', status: 'Offline', date: 'Wed Sep 23', time: '3:45 PM' };

    const OPPORTUNITY = {
      tag: 'DEMAND BUILDING',
      title: 'Demand is building nearby',
      body: 'Downtown and 1 other nearby area is starting to surge. Downtown is 20 min away, at 71% demand against 47% normal.',
    };

    const ZONES = [
      { name: 'Downtown', eta: '20 min', distance: '9 km away', demandFrom: 47, demandTo: 71, rateFrom: 25, rateTo: 31 },
    ];

    const HOURS = { logged: 0, cap: 10, rest: 7 };

    const STANDING = [
      { label: 'Acceptance rate', value: '73%', pill: 'BELOW TYPICAL', sub: 'Typical 80%' },
      { label: 'Star rating', value: '4.89', pill: 'BELOW 4.90', sub: 'Offers drop below 4.90' },
      { label: 'Cancellation rate', value: '7%', pill: 'ABOVE 4%', sub: 'Offers drop above 4%' },
      { label: 'Algorithm impact', value: '86%', unit: 'Offers vs typical', pill: 'FEWER OFFERS', sub: 'Same zones and hours' },
    ];

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

    /* ------------------------------------------------------------------ */
    /* Pit Stop mode (isDriving === false)                                 */
    /* ------------------------------------------------------------------ */
    const DriverGreeting = () => (
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Hi, {DRIVER.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
          {DRIVER.status} • {DRIVER.date} • {DRIVER.time}
        </p>
      </header>
    );

    const OpportunityCard = ({ onGoOnline }) => (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <Eyebrow>Right now</Eyebrow>
          <Pill tone="blue">{OPPORTUNITY.tag}</Pill>
        </div>
        <h2 className="mt-2 text-lg font-bold leading-snug">{OPPORTUNITY.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{OPPORTUNITY.body}</p>
        <button type="button" onClick={onGoOnline}
          className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-slate-800">
          Go online
        </button>
      </Card>
    );

    const DemandMapWidget = () => (
      <Card>
        <Eyebrow>Demand near you</Eyebrow>
        <div className="mt-3 flex h-40 items-center justify-center rounded-xl bg-slate-200 text-xs font-medium text-slate-500" role="img" aria-label="Map placeholder">
          Map
        </div>
        <ul className="mt-3 divide-y divide-slate-100">
          {ZONES.map((z) => (
            <li key={z.name} className="py-3 first:pt-1 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{z.name}</p>
                <p className="text-xs text-slate-500">{z.eta} • {z.distance}</p>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2 text-sm text-slate-600">
                <span>{z.demandFrom}% → {z.demandTo}% demand</span>
                <span>${z.rateFrom} → <strong className="font-bold text-slate-900">${z.rateTo}/hr</strong></span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    );

    const ExhaustionGuardrail = () => {
      const pct = Math.min(100, (HOURS.logged / HOURS.cap) * 100);
      const remaining = HOURS.cap - HOURS.logged;
      return (
        <Card>
          <Eyebrow>Hours logged today</Eyebrow>
          <p className="mt-2 text-2xl font-bold">
            {HOURS.logged}h <span className="text-base font-medium text-slate-500">of {HOURS.cap}h</span>
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200"
               role="progressbar" aria-valuenow={HOURS.logged} aria-valuemin={0} aria-valuemax={HOURS.cap}>
            <div className="h-full rounded-full bg-slate-400" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>{remaining === HOURS.cap ? `Full ${HOURS.cap}h available` : `${remaining}h available`}</span>
            <span>{HOURS.rest}h rest after {HOURS.cap}h</span>
          </div>
        </Card>
      );
    };

    const StandingTile = ({ label, value, unit, pill, sub }) => (
      <Card className="flex flex-col">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold leading-tight">
          {value}{unit && <span className="block text-xs font-medium text-slate-500">{unit}</span>}
        </p>
        <div className="mt-2"><Pill>{pill}</Pill></div>
        <p className="mt-2 text-xs text-slate-500">{sub}</p>
      </Card>
    );

    const AccountStandingGrid = () => (
      <div>
        <div className="mb-2 px-1"><Eyebrow>Account standing</Eyebrow></div>
        <div className="grid grid-cols-2 gap-3">
          {STANDING.map((s) => <StandingTile key={s.label} {...s} />)}
        </div>
      </div>
    );

    const PitStopView = ({ onGoOnline }) => (
      <div className="space-y-4">
        <DriverGreeting />
        <OpportunityCard onGoOnline={onGoOnline} />
        <DemandMapWidget />
        <ExhaustionGuardrail />
        <AccountStandingGrid />
      </div>
    );

    /* ------------------------------------------------------------------ */
    /* Traffic mode (isDriving === true): glanceable HUD, no scrolling     */
    /* ------------------------------------------------------------------ */
    const TRAFFIC = { currentRate: 25, action: { zone: 'Downtown', uplift: 6 } };

    const ArrowUpRightIcon = (p) => <Icon {...p}><path d="M7 17 17 7" /><path d="M8 7h9v9" /></Icon>;

    const GuardrailBar = () => {
      const pct = Math.min(100, (HOURS.logged / HOURS.cap) * 100);
      return (
        <div className="fixed inset-x-0 top-0 z-50 h-1 bg-slate-200"
             role="progressbar" aria-label={`${HOURS.logged} of ${HOURS.cap} hours`}
             aria-valuenow={HOURS.logged} aria-valuemin={0} aria-valuemax={HOURS.cap}>
          <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
        </div>
      );
    };

    const TrafficView = () => (
      <div className="flex h-full flex-col">
        <GuardrailBar />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-6xl font-bold tracking-tight tabular-nums">${TRAFFIC.currentRate}/hr</p>
          <p className="mt-2 text-base font-medium text-slate-500">Current Average</p>
        </div>
        <section className="flex h-[33dvh] min-h-[220px] flex-col justify-between rounded-2xl bg-blue-600 p-5 text-white shadow-sm">
          <div className="flex items-center gap-4">
            <ArrowUpRightIcon className="h-16 w-16 shrink-0" />
            <p className="text-2xl font-bold leading-tight">
              Head {TRAFFIC.action.zone} for +${TRAFFIC.action.uplift}/hr
            </p>
          </div>
          <button type="button"
            className="h-14 w-full rounded-xl bg-white text-lg font-bold text-blue-700 active:scale-[0.98]">
            Navigate
          </button>
        </section>
      </div>
    );

    const TabPlaceholder = ({ label }) => (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">{label} coming soon</div>
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

    const BottomNav = ({ active, onChange }) => (
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Primary">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map(({ id, label, Icon: TabIcon }) => {
            const isActive = active === id;
            return (
              <li key={id}>
                <button type="button" onClick={() => onChange(id)} aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
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
      <div className="pointer-events-none fixed inset-x-0 z-40 mx-auto flex max-w-md justify-end px-4"
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
      const [isDriving, setIsDriving] = useState(false);
      const [activeTab, setActiveTab] = useState('home');

      const renderScreen = () => {
        if (isDriving) return <TrafficView />;
        if (activeTab === 'home') return <PitStopView onGoOnline={() => {}} />;
        const tab = TABS.find((t) => t.id === activeTab);
        return <TabPlaceholder label={tab.label} />;
      };

      return (
        <div className="min-h-screen bg-slate-50">
          {/* Driving: fixed viewport height, no scroll; bottom padding clears the FAB and nav. */}
          <main className={isDriving
              ? 'mx-auto h-[100dvh] max-w-md overflow-hidden px-4 pt-6 pb-[calc(8.75rem+env(safe-area-inset-bottom))]'
              : 'mx-auto max-w-md px-4 pb-40 pt-6'}>
            {renderScreen()}
          </main>
          <DrivingToggleFab isDriving={isDriving} onToggle={() => setIsDriving((d) => !d)} />
          <BottomNav active={activeTab} onChange={setActiveTab} />
        </div>
      );
    };

    ReactDOM.createRoot(document.getElementById('root')).render(<AppShell />);
  