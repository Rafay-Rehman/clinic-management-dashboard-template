/**
 * Patient Desk — the clinic's live workspace: today's queue, key figures,
 * patient lookup, doctors on duty and recent activity.
 */
import { $, html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { clinicClock } from '../data/mock-data.js';
import { addDays, formatLongDate, formatNumber, formatShortDate, formatTime, pad, percent, todayKey } from '../core/format.js';
import { currentUser } from '../config/navigation.js';
import { avatar, emptyState, statusBadge, toast } from '../components/ui.js';
import { lineChart } from '../components/charts.js';

const QUEUE_FILTERS = [
  ['all', 'All', () => true],
  ['waiting', 'Waiting', (v) => v.status === 'Waiting'],
  ['with-doctor', 'With doctor', (v) => v.status === 'In consultation'],
  ['upcoming', 'Upcoming', (v) => v.status === 'Scheduled'],
  ['done', 'Done', (v) => ['Completed', 'No-show', 'Cancelled'].includes(v.status)],
];

// The next step for a visit in each status.
const NEXT_STEP = {
  Scheduled: { label: 'Check in', status: 'Waiting', icon: 'user-check', toast: 'checked in' },
  Waiting: { label: 'Call in', status: 'In consultation', icon: 'door', toast: 'called in' },
  'In consultation': { label: 'Complete', status: 'Completed', icon: 'check', toast: 'marked as completed' },
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function patientDesk(main) {
  let queueFilter = 'all';
  const today = todayKey();
  const clock = clinicClock();

  render(main, html`
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
      <div>
        <p class="text-ink-3 text-[13.5px]">${formatLongDate(today)}</p>
        <h1 class="text-[22px] sm:text-[26px] font-[660] leading-tight mt-0.5">${greeting()}, ${currentUser.name.split(' ')[0]}</h1>
      </div>
      <div class="grid grid-cols-3 gap-2 sm:flex">
        <a href="patients.html#new" class="btn btn-primary max-sm:px-2">${icon('user-plus', 'icon-sm')}<span>Add patient</span></a>
        <a href="prescriptions.html#new" class="btn btn-secondary max-sm:px-2">${icon('pill', 'icon-sm')}<span class="sm:hidden">Prescribe</span><span class="max-sm:hidden">New prescription</span></a>
        <a href="reports.html" class="btn btn-secondary max-sm:px-2">${icon('chart', 'icon-sm')}<span class="sm:hidden">Reports</span><span class="max-sm:hidden">View reports</span></a>
      </div>
    </div>

    <section aria-label="Key figures" class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6" data-kpis></section>

    <div class="grid gap-4 sm:gap-6 xl:grid-cols-3 mb-4 sm:mb-6">
      <section class="card xl:col-span-2 min-w-0" aria-labelledby="queue-title">
        <div class="card-header flex-wrap">
          <div>
            <h2 class="card-title" id="queue-title">Today’s queue</h2>
            <p class="card-subtitle" data-queue-summary></p>
          </div>
          <div class="segmented max-w-full overflow-x-auto" role="group" aria-label="Filter queue" data-queue-filters></div>
        </div>
        <div class="queue" data-queue></div>
      </section>

      <div class="grid grid-cols-1 gap-4 sm:gap-6 content-start min-w-0">
        <section class="card" aria-labelledby="lookup-title">
          <div class="card-header"><h2 class="card-title" id="lookup-title">Find a patient</h2></div>
          <div class="card-body">
            <div class="input-icon">
              ${icon('search', 'icon-sm')}
              <input type="search" class="input" placeholder="Name or patient ID" aria-label="Find a patient by name or ID" data-lookup>
            </div>
            <ul class="mt-3 -mx-2" data-lookup-results aria-live="polite"></ul>
          </div>
        </section>

        <section class="card" aria-labelledby="duty-title">
          <div class="card-header">
            <h2 class="card-title" id="duty-title">Doctors on duty</h2>
            <a href="doctors.html" class="text-[13px] font-semibold text-brand hover:underline">All doctors</a>
          </div>
          <ul class="divide-y divide-line" data-doctors></ul>
        </section>
      </div>
    </div>

    <div class="grid gap-4 sm:gap-6 xl:grid-cols-3">
      <section class="card xl:col-span-2 min-w-0" aria-labelledby="visits-title">
        <div class="card-header flex-wrap">
          <div>
            <h2 class="card-title" id="visits-title">Patient visits</h2>
            <p class="card-subtitle">Last 30 days compared with the 30 days before</p>
          </div>
          <div class="legend" aria-hidden="true">
            <span><span class="legend-swatch" style="background:var(--chart-1)"></span>Last 30 days</span>
            <span><span class="legend-swatch" style="background:repeating-linear-gradient(90deg,var(--chart-2) 0 4px,transparent 4px 7px)"></span>Previous 30 days</span>
          </div>
        </div>
        <div class="card-body pt-4">
          <div class="flex flex-wrap gap-x-8 gap-y-2 mb-4" data-visit-stats></div>
          <div data-visits-chart></div>
        </div>
      </section>

      <section class="card min-w-0" aria-labelledby="activity-title">
        <div class="card-header"><h2 class="card-title" id="activity-title">Recent activity</h2></div>
        <ol class="px-5 py-2" data-activity></ol>
      </section>
    </div>`);

  /* ---------------------------------------------------------- KPIs */
  function renderKpis() {
    const patients = store.list('patients');
    const visits = store.todaysVisits();
    const lastWeek = store.list('visits').filter((v) => v.date === addDays(today, -7) && v.status !== 'Cancelled').length;
    const todayCount = visits.filter((v) => v.status !== 'Cancelled').length;
    const delta = percent(todayCount - lastWeek, lastWeek);
    const newThisMonth = patients.filter((p) => p.registeredOn > addDays(today, -30)).length;
    const drafts = store.list('prescriptions').filter((p) => p.status === 'Draft').length;
    const doctors = store.list('doctors');
    const onDuty = doctors.filter((d) => d.availability === 'Available').length;

    const tile = (label, value, ic, foot, href) => html`
      <a href="${href}" class="card p-4 sm:p-5 flex flex-col gap-3 hover:border-line-strong transition-colors">
        <div class="flex items-center justify-between gap-2">
          <span class="kpi-label">${label}</span>
          <span class="grid place-items-center size-8 rounded-lg bg-brand-soft text-brand">${icon(ic, 'icon-sm')}</span>
        </div>
        <span class="kpi-value">${value}</span>
        <span class="text-[12.5px] text-ink-3">${foot}</span>
      </a>`;

    render($('[data-kpis]', main), html`
      ${tile('Total patients', formatNumber(patients.length), 'users', html`<span class="delta delta-up">${icon('arrow-up', 'icon-xs')}${newThisMonth}</span> new in 30 days`, 'patients.html')}
      ${tile('Today’s visits', todayCount, 'calendar', html`<span class="delta ${delta >= 0 ? 'delta-up' : 'delta-down'}">${icon(delta >= 0 ? 'arrow-up' : 'arrow-down', 'icon-xs')}${Math.abs(delta)}%</span> vs. last ${new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date())}`, '#queue-title')}
      ${tile('Pending prescriptions', drafts, 'pill', 'Drafts waiting to be issued', 'prescriptions.html?status=Draft')}
      ${tile('Doctors on duty', html`${onDuty}<span class="text-ink-3 text-lg font-medium"> / ${doctors.length}</span>`, 'stethoscope', `${doctors.length - onDuty} on leave or off duty`, 'doctors.html')}`);
  }

  /* --------------------------------------------------------- Queue */
  function renderQueue() {
    const visits = store.todaysVisits();
    const match = QUEUE_FILTERS.find(([key]) => key === queueFilter)[2];
    const shown = visits.filter(match);
    const done = visits.filter((v) => v.status === 'Completed').length;
    const waiting = visits.filter((v) => v.status === 'Waiting').length;

    render($('[data-queue-summary]', main), html`${done} of ${visits.length} seen · ${waiting} waiting${clock.simulated ? html` · <span title="Outside clinic hours the demo runs on a fixed clock">demo clock</span>` : ''}`);
    render($('[data-queue-filters]', main), html`${QUEUE_FILTERS.map(([key, label, fn]) => html`
      <button type="button" aria-pressed="${key === queueFilter}" data-queue-filter="${key}">${label} <span class="text-ink-3 font-normal">${visits.filter(fn).length}</span></button>`)}`);

    if (!shown.length) {
      render($('[data-queue]', main), emptyState({ iconName: 'calendar', title: 'Nothing here right now', text: 'No visits in today’s queue match this filter.' }));
      return;
    }

    const nowLabel = `${formatTime(`${pad(Math.floor(clock.minutes / 60))}:${pad(clock.minutes % 60)}`)}`;
    const nowIndex = shown.findIndex((v) => {
      const [h, m] = v.time.split(':').map(Number);
      return h * 60 + m > clock.minutes;
    });

    const row = (v) => {
      const patient = store.patientById(v.patientId);
      const doctor = store.doctorById(v.doctorId);
      const next = NEXT_STEP[v.status];
      return html`
        <div class="queue-row" data-status="${v.status}">
          <span class="queue-time">${formatTime(v.time)}</span>
          <span class="queue-rail" aria-hidden="true"><span class="queue-dot"></span></span>
          <div class="min-w-0">
            <p class="queue-name font-semibold truncate">${store.patientName(patient)}
              <span class="ml-1 font-normal text-[12.5px] text-ink-3">${v.patientId}</span></p>
            <p class="text-[13px] text-ink-3 truncate">${v.reason} · ${doctor?.name ?? 'Unassigned'}</p>
          </div>
          <div class="queue-actions flex items-center gap-2">
            ${statusBadge(v.status)}
            ${next
              ? html`<button type="button" class="btn btn-secondary btn-sm" data-advance="${v.id}" aria-label="${next.label}: ${store.patientName(patient)}">${icon(next.icon, 'icon-sm')}${next.label}</button>`
              : v.status === 'Completed'
                ? html`<a class="btn btn-ghost btn-sm" href="prescriptions.html?patient=${v.patientId}#new" aria-label="Write prescription for ${store.patientName(patient)}">${icon('pill', 'icon-sm')}Prescribe</a>`
                : ''}
          </div>
        </div>`;
    };

    const nowLine = html`<div class="queue-now" role="separator" aria-label="Current time ${nowLabel}"><span>${nowLabel}</span><i></i></div>`;
    render($('[data-queue]', main), html`
      <div class="max-h-[560px] overflow-y-auto overscroll-contain" data-queue-scroll>
        ${shown.map((v, i) => html`${i === nowIndex && queueFilter === 'all' && i > 0 ? nowLine : ''}${row(v)}`)}
      </div>`);
    // Open the queue at the current time, keeping the last two visits in view.
    const scroller = $('[data-queue-scroll]', main);
    const anchor = $('.queue-now', scroller)?.previousElementSibling?.previousElementSibling;
    if (anchor) scroller.scrollTop = anchor.offsetTop - scroller.offsetTop;
  }

  on(main, 'click', '[data-queue-filter]', (e, btn) => {
    queueFilter = btn.dataset.queueFilter;
    renderQueue();
    $(`[data-queue-filter="${queueFilter}"]`, main).focus();
  });

  on(main, 'click', '[data-advance]', (e, btn) => {
    const visit = store.get('visits', btn.dataset.advance);
    const next = NEXT_STEP[visit.status];
    // One patient per doctor at a time: calling someone in finishes nobody else's visit implicitly.
    if (next.status === 'In consultation') {
      const busy = store.todaysVisits().find((v) => v.doctorId === visit.doctorId && v.status === 'In consultation');
      if (busy) {
        toast(`${store.doctorById(visit.doctorId).name} is still with ${store.patientName(store.patientById(busy.patientId))}. Complete that visit first.`, { tone: 'danger', title: 'Doctor is busy' });
        return;
      }
    }
    store.update('visits', visit.id, { status: next.status });
    toast(`${store.patientName(store.patientById(visit.patientId))} ${next.toast}.`);
    refreshAll();
  });

  /* ------------------------------------------------------ Lookup */
  const lookup = $('[data-lookup]', main);
  const renderLookup = () => {
    const term = lookup.value.trim().toLowerCase();
    const list = $('[data-lookup-results]', main);
    if (!term) {
      render(list, html`<li class="px-2 text-[13px] text-ink-3">Search by name or ID, for example “${store.list('patients')[0].id}”.</li>`);
      return;
    }
    const matches = store.list('patients').filter((p) => `${store.patientName(p)} ${p.id}`.toLowerCase().includes(term)).slice(0, 5);
    render(list, matches.length
      ? html`${matches.map((p) => html`
          <li><a href="patients.html?q=${p.id}" class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
            ${avatar(store.patientName(p), 'avatar-sm')}
            <span class="min-w-0 flex-1"><span class="block font-medium truncate">${store.patientName(p)}</span><span class="block text-[12.5px] text-ink-3">${p.id} · ${p.phone}</span></span>
            ${statusBadge(p.status)}
          </a></li>`)}`
      : html`<li class="px-2 text-[13px] text-ink-3">No patient matches “${lookup.value.trim()}”. <a class="text-brand font-semibold hover:underline" href="patients.html#new">Register a new patient</a></li>`);
  };
  lookup.addEventListener('input', renderLookup);

  /* ----------------------------------------------------- Doctors */
  function renderDoctors() {
    const visits = store.todaysVisits();
    const rows = store.list('doctors')
      .map((d) => ({ d, status: store.doctorStatus(d), total: visits.filter((v) => v.doctorId === d.id).length, seen: visits.filter((v) => v.doctorId === d.id && v.status === 'Completed').length }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    render($('[data-doctors]', main), rows.length
      ? html`${rows.map(({ d, status, total, seen }) => html`
          <li class="flex items-center gap-3 px-5 py-3">
            ${avatar(d.name, 'avatar-sm')}
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">${d.name}</p>
              <p class="text-[12.5px] text-ink-3 truncate">${d.specialty} · ${seen}/${total} seen</p>
            </div>
            ${statusBadge(status)}
          </li>`)}`
      : html`<li>${emptyState({ iconName: 'stethoscope', title: 'No doctors scheduled', text: 'No appointments are booked with any doctor today.' })}</li>`);
  }

  /* ---------------------------------------------------- Activity */
  function renderActivity() {
    const events = [];
    for (const v of store.todaysVisits()) {
      if (v.status === 'Completed') events.push({ key: `${today} ${v.time}`, icon: 'check', text: html`<b class="font-semibold">${store.patientName(store.patientById(v.patientId))}</b> finished a visit with ${store.doctorById(v.doctorId)?.name}`, when: `Today, ${formatTime(v.time)}` });
    }
    for (const p of store.list('prescriptions').filter((p) => p.date >= addDays(today, -1)).slice(0, 6)) {
      events.push({ key: `${p.date} 23:${p.status === 'Draft' ? 59 : 58}`, icon: 'pill', text: html`Prescription <b class="font-semibold">${p.id}</b> ${p.status === 'Draft' ? 'saved as draft' : 'issued'} for ${store.patientName(store.patientById(p.patientId))}`, when: p.date === today ? 'Today' : 'Yesterday' });
    }
    for (const p of store.list('patients').filter((p) => p.registeredOn >= addDays(today, -2)).slice(0, 4)) {
      events.push({ key: `${p.registeredOn} 00:00`, icon: 'user-plus', text: html`<b class="font-semibold">${store.patientName(p)}</b> registered as a new patient`, when: p.registeredOn === today ? 'Today' : formatShortDate(p.registeredOn) });
    }
    const latest = events.sort((a, b) => b.key.localeCompare(a.key)).slice(0, 6);
    render($('[data-activity]', main), latest.length
      ? html`${latest.map((e) => html`
          <li class="flex gap-3 py-3 [&+li]:border-t [&+li]:border-line">
            <span class="grid place-items-center size-8 rounded-full bg-surface-2 text-ink-2 shrink-0">${icon(e.icon, 'icon-sm')}</span>
            <div class="min-w-0 text-[13.5px]"><p class="text-ink-2">${e.text}</p><p class="text-[12.5px] text-ink-3 mt-0.5">${e.when}</p></div>
          </li>`)}`
      : html`<li>${emptyState({ iconName: 'activity', title: 'No activity yet', text: 'Completed visits, prescriptions and registrations will appear here.' })}</li>`);
  }

  /* ------------------------------------------------------- Chart */
  function renderChart() {
    const counts = new Map();
    for (const v of store.list('visits')) if (v.status !== 'Cancelled') counts.set(v.date, (counts.get(v.date) ?? 0) + 1);
    const labels = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
    const current = labels.map((d) => counts.get(d) ?? 0);
    const previous = labels.map((d) => counts.get(addDays(d, -30)) ?? 0);
    const sum = (a) => a.reduce((s, x) => s + x, 0);
    const change = percent(sum(current) - sum(previous), sum(previous));

    render($('[data-visit-stats]', main), html`
      <div><p class="kpi-label">Visits, last 30 days</p><p class="text-xl font-[650] tabular-nums">${formatNumber(sum(current))}
        <span class="delta ${change >= 0 ? 'delta-up' : 'delta-down'} ml-1">${icon(change >= 0 ? 'arrow-up' : 'arrow-down', 'icon-xs')}${Math.abs(change)}%</span></p></div>
      <div><p class="kpi-label">Daily average</p><p class="text-xl font-[650] tabular-nums">${(sum(current) / 30).toFixed(1)}</p></div>
      <div><p class="kpi-label">Busiest day</p><p class="text-xl font-[650] tabular-nums">${formatShortDate(labels[current.indexOf(Math.max(...current))])}</p></div>`);

    lineChart($('[data-visits-chart]', main), {
      height: innerWidth < 640 ? 200 : 300,
      labels,
      series: [
        { name: 'Last 30 days', values: current, color: 'var(--chart-1)', fill: true },
        { name: 'Previous 30 days', values: previous, color: 'var(--chart-2)', dashed: true },
      ],
      formatLabel: formatShortDate,
      formatTooltipLabel: (d) => new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00`)),
      ariaLabel: `Patient visits per day for the last 30 days: ${sum(current)} in total, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% on the previous 30 days. Use the left and right arrow keys to read daily values.`,
    });
  }

  function refreshAll() {
    renderKpis();
    renderQueue();
    renderDoctors();
    renderActivity();
  }

  refreshAll();
  renderLookup();
  renderChart();
}
