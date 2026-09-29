
## Prototype v2 (audit fixes, 2026-09-28)

An audit of v1 against the case study's data points and the real-time decision found six issues. All six are fixed in v2 (same artifact link, same project file).

- Opportunity gain counts the drive. v1 compared the destination's rate after arrival against the current rate, and ignored that the drive earns nothing, which overstated the Tuesday gain (+$12/hr shown, about +$1 real in the first hour). v2 compares expected dollars over a fixed 2-hour horizon: staying earns across the full window; moving earns nothing during the drive, then the destination's rate. Qualifies at 15% and $8 better over 2 hours. Tuesday now reads "+$23 over the next 2 hrs, 20 min drive".
- Cancellations and ratings added. Each record now carries offers, accepted, driver cancellations and rated trips. Modelled assumption: offer flow falls when the cancellation rate passes 4% or the rating drops below 4.90. Alex's cancellations rise from 3% to about 9% and his rating slides from 4.94 to 4.82 from mid-August, which gives about 15% fewer offers than typical.
- Offers per online hour added to the metric tree under utilization, with cancellation rate and rating as its drivers. It is also expressed as an offer index: offers against a typical driver in the same zones and hours. It appears in a new "Your trip offers" section (12-week rolling trends plus a weekly dollar estimate), in the peer comparison, and as a "Fewer trip offers" cause in the shift diagnosis.
- Acceptance reframed as a trade-off. Declining lifts the average fare. A decline is refilled quickly in busy hours and slowly in quiet ones. The diagnosis now says which applied, replacing "every decline adds waiting time".
- Peer benchmarks use the same window. Peers are simulated over the same 52 weeks as Alex, and every percentile is computed over the same dates on both sides.
- Surge made visible. Surge is now a market-level signal (every driver in a zone-hour sees the same multiplier), about 5% of earnings. The earnings split shows base fare, surge and tips. A new "When surge usually hits" section shows the last 8 same weekdays per zone, with a leave-by time for the next reachable window; under the fatigue gate it says the surge is a regular pattern, so stopping now costs little.
- Weekly target removed. The self-declared 20 to 25 hour range is replaced by "your usual": the middle half of Alex's own last 8 weeks of online hours, derived from in-scope data.

Story the numbers now tell: Alex's pay per trip hour held steady (about $50), but offers fell as cancellations rose, so utilization and EPOH dropped to about the 4th percentile over the last 4 weeks (54th over the year).

## Prototype v3: earnings per online hour block (2026-09-28)

- The earnings per online hour figure is the second-largest number on screen, directly below total earnings, with its calculation (earned ÷ hours online), best hour, and a benchmark line.
- Driver input metrics for the selected period: hours online, rides accepted (of offers), acceptance rate, and km driven. Km is modelled as trip distance plus pickup distance plus light repositioning while waiting; it is treated as available trip data.
- "Maximize earnings" lists up to four levers from the last 4 weeks, each with an estimated $/hr gain: zone and time choice, cancellations and rating (offer flow), acceptance in quiet hours, and surge positioning. It also shows an estimated reachable $/hr.
- "How you've performed" compares the selected period against the top 20% of earners in the same zones. On the Today tab this means the same weekday and hours over the last 8 weeks; on other tabs, the same dates. Acceptance rate and km are shown as context, not scored, which keeps acceptance consistent with its treatment as a trade-off.
- The separate "How you compare" section was removed because the new comparison covers it.

## Slow-shift breakdown (2026-09-28)

The gap between a shift's earnings per online hour and the driver's usual is split into three parts that add up exactly:

- Zone & time: what the driver's zones usually pay at those hours, minus the driver's usual rate.
- Market today: how drivers in the same zones and hours today compare with what those zones and hours usually pay (the bad-luck component).
- Your driving: the driver against drivers in the same zones and hours today (offers, cancellations, time on a trip).

Shown in two places. During a live shift, a "Why is this shift slow?" toggle appears on the earnings per online hour card after 45 minutes online, when the rate is more than 5% below the driver's usual. For past shifts, it appears in "Why a shift landed where it did". Each row shows only a bar and a $/hr value, and a tap opens the underlying comparisons. The Maximize earnings levers were also collapsed into tap-to-expand rows.

Assumption: anonymised peer benchmarks are refreshed during the day, so a same-day market comparison is available.

## Shift limit and cool-down mode (2026-09-28)

Guardrail: a driver may be online at most 10 hours in a work period; after that the app forces them offline and they must rest 7 hours before going online again. A work period is online time since the last rest of 7 or more hours, which closes the loophole of splitting a long day into short sessions with brief breaks.

- Hours logged today: a small strip directly under the top card. Bar and figure show hours against the 10-hour cap; it turns orange from 8 hours and red at the cap, and shows time left, or the time the driver can go online again.
- The earlier soft flags stay as early warnings (5+ hours in a shift, after 10 PM, 9+ hours in 24, 6+ days without rest). The 10-hour cap is the hard limit on top of them.
- Cool-down mode: the top card becomes a locked "Cool-down mode" card with a live countdown to the moment the driver can go online, a rest progress bar and a disabled "Go online" button. The header pill reads "Offline · Cool-down". Options near you, surge by day, trip offers, the weekly view, the zone-by-hour map and the period tabs are hidden. What remains is that day's earnings, earnings per online hour, its metric tiles, the comparison with top earners, and the shift breakdown.
- Two demo moments were added: Sun Sep 27 8:45 PM (8h 45m in, 1h 15m from the limit) and Sun Sep 27 10:00 PM (limit reached, cool-down).

## v4: "Your standing" scorecard on the hero page
- Added a 2x2 tile grid below the earnings and EPOH block, styled after the Uber driver profile screen: big number, label, status badge, reference line.
- Tiles (rolling 28 days): acceptance rate (typical 80%), star rating (offers drop below 4.90), cancellation rate (offers drop above 4%), offers vs typical (same zones and hours).
- Badges are green when on track and orange when the gap needs closing. The grid stays visible in cool-down mode.

## v5: "Options near you" by day and time
- Layout follows the Uber Opportunities screen: a Mon–Sun day strip with dates, a grey date heading, then time-window cards.
- Windows: 6–10 AM, 10 AM–2 PM, 2–6 PM, 6–10 PM, 10 PM–2 AM. Each card shows the best area within 20 minutes of the driver's current area, typical $/hr, distance, a Surge or Busy/Steady/Quiet tag, and a mini map with the current area ringed.
- Today keeps the live "Right now" list on top (stay vs go, drive included), then the windows still ahead. Past days are disabled.

## v6: Gold event slots in "Options near you"
- Premium, claim-based slots near live events (sports, concerts, live events, college let-outs) sit inside the day view, sorted by time among the earnings-window cards, styled in gold.
- Each card: event, venue, area, distance, pickup window, premium (+15% to +40%), dollars per hour vs typical, and slots left. Access model: qualify, then claim (limited slots, no draw).
- The standard (last 28 days): rating at least 4.90, cancellation at most 4%, acceptance at least 70%. Below it, cards show and the button reads "Locked", with the standard and the driver's numbers behind a toggle. Alex misses it today (cancellations 9%).
- Wellbeing guardrails on today's slots: not offered when a safety flag is tripped, and disabled if the slot would pass the 10-hour limit.
- Prototype control: a "Gold event access, preview" switch in the left panel flips between Alex's actual standing and a driver who meets the standard.

## v7: Right-now list trimmed to the top 2
- Today's live list under "Options near you" shows the driver's current area plus only the two best moves (sorted by gain, closer area wins ties). The other areas are dropped.

## v8: Four-tab app shell (Home, Earnings, Opportunities, Menu)
- Bottom navigation in the phone, styled after the Uber driver app. Split by job:
  - Home: right-now card, hours logged, today's total earnings with fare/surge/tip/trip pills, a compact earnings-per-hour card linking to Earnings, and the standing scorecard.
  - Earnings: period tabs, chart and table, earnings per hour with Maximize and How you've performed, and the shift breakdown ("Why a shift landed where it did").
  - Opportunities: a "Surging now" map (live multipliers per area, extra dollars per trip, distance from the driver), options by day and time with gold event slots, surge pricing by day, and the where-and-when heatmap.
  - Menu: shift limits and rest rules with the gold standard, the weekly hours view, and trip offers.
- Cool-down mode: the Opportunities tab is locked; Earnings still shows that day's stats and performance; Menu shows the limits card.

## v9: Three scenarios, demand map on Home, tick and X on event slots
- Scenarios cut from five to three: (1) Demand: Wed Sep 23, 3:45 PM, Alex opens the app offline in Northside as the evening rush builds. (2) Gold: Fri Sep 25, 6:25 PM, Alex is a Gold driver with a homecoming concert slot. (3) Rest: Sun Sep 27, 10:00 PM, 10-hour limit reached and cool-down.
- Demand scenario: the first Home section is a demand map in the style of the Uber "Surging now" screen. It uses the city demand by area and time-of-day data: glow colour shows demand (amber, purple, red), pills show expected dollars per hour with an up arrow where demand is rising, and the driver's location is marked. A Now / In 1 hr / In 2 hrs switch shows how demand builds, and the top three areas list demand and dollars per hour now against the chosen time, with distance. Go online sits below.
- Gold scenario: the top Home card is the Gold event offer with a green tick (accept) and red X (decline). Options near you shows the same event cards with the same tick and X. Slots respond to hours already logged: an event is blocked if it would push the driver past 10 hours.
- Gold status now comes from the scenario (Alex's metrics are set to rating 4.94, cancellations 2%, acceptance 78% in that scenario), replacing the left-panel preview switch. In the other two scenarios Alex is below the standard and event slots are locked.
- The decision order is now: cool-down, offline (demand map), safety warning, gold offer, opportunity, steady.

## v10: Live demand map on Home in every scenario
- The Now / In 1 hr / In 2 hrs switch is gone. The map shows live demand only.
- Live demand = normal demand for the zone and hour (city demand by zone and time of day) plus the live gap above it. A surge in demand is live demand at least 12 points above normal. Expected dollars per hour rise at half the rate of demand (modelled assumption).
- A "Demand near you" section sits under the top card on Home in all scenarios; it states whether any area within 20 minutes of the driver is surging, and lists those areas with distance, demand vs normal, and dollars per hour.
- Demand scenario: Downtown and Midtown are above normal near Alex, who is offline; the top card names them and offers Go online.
- Gold scenario: no surge, demand is shown as it normally is for that time of day.
- Rest scenario: the driver is on the right side (Waterfront) with normal demand; University and Midtown on the left are starting to surge. Information only, since the driver is locked out.
- The driver's location when offline is the area of the last recorded trip if it ended within 2 hours, otherwise Northside.

## v11: Earnings summary removed from Home
- Today's total earnings, the fare, surge, tip and trip pills, and the earnings-per-hour card now live only on the Earnings tab. Home holds the top card, demand near you, hours logged, and the standing scorecard.
