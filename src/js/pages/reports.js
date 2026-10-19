/**
 * Reports — every figure on this page is computed from the same demo
 * records for the selected date range, and compared with the period of
 * equal length immediately before it.
 */
import { $, html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { addDays, ageFrom, daysBetween, formatDate, formatNumber, formatShortDate, percent, todayKey } from '../core/format.js';
import { barList, lineChart, stackedBar } from '../components/charts.js';
import { emptyState, pageHeader, toast } from '../components/ui.js';

const PRESETS = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['180', '6 months']];
const HISTORY_START = () => addDays(todayKey(), -180);
const AGE_GROUPS = [['0–12', 0, 12], ['13–17', 13, 17], ['18–34', 18, 34], ['35–49', 35, 49], ['50–64', 50, 64], ['65+', 65, 200]];

function computeReport(from, to) {
  const inRange = (d) => d >= from && d <= to;
  const visits = store.list('visits').filter((v) => inRange(v.date));
  const attended = visits.filter((v) => v.status === 'Completed');
  const prescriptions = store.list('prescriptions').filter((p) => inRange(p.date));
  const patients = store.list('patients');

  // Daily series, bucketed by week for long ranges so the chart stays readable.
  const days = daysBetween(from, to) + 1;
  const bucket = days > 60 ? 7 : 1;
  const labels = [];
  const values = [];
  for (let start = from; start <= to; start = addDays(start, bucket)) {
    const end = addDays(start, bucket - 1);
    labels.push(start);
    values.push(visits.filter((v) => v.status !== 'Cancelled' && v.date >= start && v.date <= end).length);
  }

  const seenPatients = new Set(attended.map((v) => v.patientId));
  const byAge = AGE_GROUPS.map(([label, min, max]) => ({
    label,
    value: [...seenPatients].filter((id) => {
      const p = store.patientById(id);
      const age = p ? ageFrom(p.dob, to) : -1;
      return age >= min && age <= max;
    }).length,
  }));

  const specialtyCounts = attended.reduce((m, v) => {
    const s = store.doctorById(v.doctorId)?.specialty ?? 'Unassigned';
    return m.set(s, (m.get(s) ?? 0) + 1);
  }, new Map());

  const doctors = store.list('doctors').map((d) => {
    const own = visits.filter((v) => v.doctorId === d.id);
    const noShows = own.filter((v) => v.status === 'No-show').length;
    return {
      name: d.name,
      specialty: d.specialty,
      visits: own.filter((v) => v.status === 'Completed').length,
      patients: new Set(own.filter((v) => v.status === 'Completed').map((v) => v.patientId)).size,
      prescriptions: prescriptions.filter((p) => p.doctorId === d.id).length,
      noShowRate: percent(noShows, own.length),
    };
  }).sort((a, b) => b.visits - a.visits);

  return {
    days,
    bucket,
    labels,
    values,
    totalPatients: patients.filter((p) => p.registeredOn <= to).length,
    visits: visits.filter((v) => v.status !== 'Cancelled').length,
    attended: attended.length,
    noShows: visits.filter((v) => v.status === 'No-show').length,
    newPatients: patients.filter((p) => inRange(p.registeredOn)).length,
    prescriptions: prescriptions.length,
    itemsPerRx: prescriptions.length ? (prescriptions.reduce((n, p) => n + p.items.length, 0) / prescriptions.length).toFixed(1) : '0',
    topMedication: Object.entries(prescriptions.flatMap((p) => p.items).reduce((m, i) => ({ ...m, [i.medication]: (m[i.medication] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0],
    rxStatus: ['Completed', 'Issued', 'Draft', 'Cancelled'].map((s) => ({ label: s, value: prescriptions.filter((p) => p.status === s).length })),
    byAge,
    bySpecialty: [...specialtyCounts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7),
    doctors,
  };
}

// Neutralise spreadsheet formulas (=, +, -, @) and quote every cell.
const csvCell = (value) => {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function reportsPage(main) {
  const state = { preset: '30', from: addDays(todayKey(), -29), to: todayKey() };

  render(main, html`
    ${pageHeader({
      title: 'Reports',
      subtitle: 'Clinic activity for the selected period, compared with the period before it.',
      actions: html`<button type="button" class="btn btn-secondary" data-export>${icon('download', 'icon-sm')}Export CSV</button>`,
    })}
    <div class="card p-4 mb-6 flex flex-col gap-4 xl:flex-row xl:items-end">
      <div>
        <p class="label">Period</p>
        <div class="segmented max-w-full overflow-x-auto" role="group" aria-label="Report period" data-presets>
          ${PRESETS.map(([value, label]) => html`<button type="button" data-preset="${value}" aria-pressed="${value === state.preset}">${label}</button>`)}
        </div>
      </div>
      <form class="flex flex-wrap items-end gap-3" data-range novalidate>
        <div><label class="label" for="range-from">From</label><input id="range-from" name="from" type="date" class="input w-[160px]" value="${state.from}" min="${HISTORY_START()}" max="${todayKey()}" aria-describedby="range-msg"></div>
        <div><label class="label" for="range-to">To</label><input id="range-to" name="to" type="date" class="input w-[160px]" value="${state.to}" min="${HISTORY_START()}" max="${todayKey()}" aria-describedby="range-msg"></div>
        <button type="submit" class="btn btn-primary">Apply</button>
      </form>
      <p id="range-msg" class="help xl:ml-auto xl:mb-2.5" data-range-msg>Demo history covers the last 180 days.</p>
    </div>
    <div data-report></div>`);

  const reportEl = $('[data-report]', main);
  const msg = $('[data-range-msg]', main);
  let current;

  function kpi(label, value, previous, ic) {
    const change = percent(value - previous, previous);
    return html`
      <div class="card p-5">
        <div class="flex items-center justify-between"><span class="kpi-label">${label}</span><span class="text-ink-3">${icon(ic, 'icon-sm')}</span></div>
        <p class="kpi-value mt-3">${formatNumber(value)}</p>
        <p class="text-[12.5px] text-ink-3 mt-2">
          ${previous ? html`<span class="delta ${change >= 0 ? 'delta-up' : 'delta-down'}">${icon(change >= 0 ? 'arrow-up' : 'arrow-down', 'icon-xs')}${Math.abs(change)}%</span> vs. previous period` : 'No data for the previous period'}
        </p>
      </div>`;
  }

  function update() {
    current = computeReport(state.from, state.to);
    const prevTo = addDays(state.from, -1);
    const previous = computeReport(addDays(prevTo, -(current.days - 1)), prevTo);
    const r = current;

    syncRangeControls();
    if (!r.visits && !r.newPatients && !r.prescriptions) {
      render(reportEl, html`<div class="card">${emptyState({ iconName: 'chart', title: 'No activity in this period', text: 'Choose a range within the last 180 days to see the demo data.' })}</div>`);
      return;
    }

    render(reportEl, html`
      <section aria-label="Summary" class="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        ${kpi('Patient visits', r.visits, previous.visits, 'calendar')}
        ${kpi('New registrations', r.newPatients, previous.newPatients, 'user-plus')}
        ${kpi('Prescriptions written', r.prescriptions, previous.prescriptions, 'pill')}
        ${kpi('Total patients', r.totalPatients, previous.totalPatients, 'users')}
      </section>

      <div class="grid gap-6 xl:grid-cols-3 mb-6">
        <section class="card xl:col-span-2 min-w-0" aria-labelledby="trend-title">
          <div class="card-header flex-wrap">
            <div>
              <h2 class="card-title" id="trend-title">Patient visits over time</h2>
              <p class="card-subtitle">${r.bucket === 7 ? 'Weekly totals' : 'Daily totals'}, ${formatDate(state.from)} to ${formatDate(state.to)}</p>
            </div>
            <p class="text-[13px] text-ink-3"><span class="font-semibold text-ink">${percent(r.attended, r.visits)}%</span> attended · <span class="font-semibold text-ink">${r.noShows}</span> no-shows</p>
          </div>
          <div class="card-body"><div data-trend></div></div>
        </section>
        <section class="card min-w-0" aria-labelledby="rx-title">
          <div class="card-header"><div><h2 class="card-title" id="rx-title">Prescriptions by status</h2><p class="card-subtitle">${formatNumber(r.prescriptions)} written in this period</p></div></div>
          <div class="card-body">
            ${stackedBar(r.rxStatus.map((s) => ({ ...s, color: { Completed: 'var(--success)', Issued: 'var(--info)', Draft: 'var(--warning)', Cancelled: 'var(--danger)' }[s.label] })))}
            <dl class="grid gap-3 mt-6 pt-5 border-t border-line text-[13.5px]">
              <div class="flex justify-between gap-4"><dt class="text-ink-3">Average items per prescription</dt><dd class="font-semibold tabular-nums">${r.itemsPerRx}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-ink-3">Most prescribed</dt><dd class="font-semibold text-right">${r.topMedication ? `${r.topMedication[0]} (${r.topMedication[1]})` : '—'}</dd></div>
            </dl>
          </div>
        </section>
      </div>

      <div class="grid gap-6 lg:grid-cols-2 mb-6">
        <section class="card" aria-labelledby="age-title">
          <div class="card-header"><div><h2 class="card-title" id="age-title">Patients seen by age group</h2><p class="card-subtitle">Unique patients with a completed visit</p></div></div>
          <div class="card-body">${barList(r.byAge.map((a) => ({ ...a, label: `${a.label} years` })))}</div>
        </section>
        <section class="card" aria-labelledby="spec-title">
          <div class="card-header"><div><h2 class="card-title" id="spec-title">Visits by specialty</h2><p class="card-subtitle">Completed visits, top ${r.bySpecialty.length}</p></div></div>
          <div class="card-body">${barList(r.bySpecialty)}</div>
        </section>
      </div>

      <section class="card overflow-hidden" aria-labelledby="doctor-title">
        <div class="card-header">
          <div><h2 class="card-title" id="doctor-title">Doctor activity</h2><p class="card-subtitle">Included in the CSV export</p></div>
        </div>
        <div class="table-wrap">
          <table class="table table-stack">
            <thead><tr><th scope="col">Doctor</th><th scope="col">Specialty</th><th scope="col" class="num">Visits</th><th scope="col" class="num">Patients</th><th scope="col" class="num">Prescriptions</th><th scope="col" class="num">No-show rate</th></tr></thead>
            <tbody>
              ${r.doctors.map((d) => html`<tr>
                <td class="cell-full font-semibold">${d.name}</td>
                <td data-label="Specialty">${d.specialty}</td>
                <td data-label="Visits" class="num">${formatNumber(d.visits)}</td>
                <td data-label="Patients" class="num">${formatNumber(d.patients)}</td>
                <td data-label="Prescriptions" class="num">${formatNumber(d.prescriptions)}</td>
                <td data-label="No-show rate" class="num">${d.noShowRate}%</td>
              </tr>`)}
            </tbody>
          </table>
        </div>
      </section>`);

    const fmtLabel = (d) => formatShortDate(d);
    lineChart($('[data-trend]', reportEl), {
      labels: r.labels,
      series: [{ name: 'Visits', values: r.values, color: 'var(--chart-1)', fill: true }],
      formatLabel: fmtLabel,
      formatTooltipLabel: (d) => (r.bucket === 7 ? `Week of ${formatShortDate(d)}` : formatDate(d)),
      ariaLabel: `Patient visits from ${formatDate(state.from)} to ${formatDate(state.to)}: ${r.visits} in total. Use the left and right arrow keys to read each ${r.bucket === 7 ? 'week' : 'day'}.`,
    });
  }

  function syncRangeControls() {
    main.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)));
    $('#range-from', main).value = state.from;
    $('#range-to', main).value = state.to;
  }

  on(main, 'click', '[data-preset]', (e, btn) => {
    state.preset = btn.dataset.preset;
    state.to = todayKey();
    state.from = addDays(state.to, -(Number(state.preset) - 1));
    setRangeError('');
    update();
  });

  function setRangeError(text) {
    ['#range-from', '#range-to'].forEach((s) => (text ? $(s, main).setAttribute('aria-invalid', 'true') : $(s, main).removeAttribute('aria-invalid')));
    msg.className = text ? 'field-error xl:ml-auto xl:mb-2.5' : 'help xl:ml-auto xl:mb-2.5';
    render(msg, text ? html`${icon('alert', 'icon-xs')}<span>${text}</span>` : html`Demo history covers the last 180 days.`);
  }

  $('[data-range]', main).addEventListener('submit', (e) => {
    e.preventDefault();
    const from = $('#range-from', main).value;
    const to = $('#range-to', main).value;
    if (!from || !to) return setRangeError('Choose both a start and an end date.');
    if (from > to) return setRangeError('The start date must be on or before the end date.');
    if (from < HISTORY_START() || to > todayKey()) return setRangeError(`Choose dates between ${formatDate(HISTORY_START())} and today.`);
    setRangeError('');
    Object.assign(state, { from, to, preset: '' });
    update();
  });

  $('[data-export]', main).addEventListener('click', () => {
    const r = current;
    const rows = [
      ['Report period', `${state.from} to ${state.to}`],
      ['Patient visits', r.visits],
      ['New registrations', r.newPatients],
      ['Prescriptions written', r.prescriptions],
      ['Total patients', r.totalPatients],
      [],
      ['Doctor', 'Specialty', 'Visits', 'Patients', 'Prescriptions', 'No-show rate (%)'],
      ...r.doctors.map((d) => [d.name, d.specialty, d.visits, d.patients, d.prescriptions, d.noShowRate]),
      [],
      ['Fictional demo data generated by the clinic template.'],
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `clinic-report_${state.from}_to_${state.to}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`The report for ${formatDate(state.from)} to ${formatDate(state.to)} was downloaded.`, { title: 'CSV exported' });
  });

  update();
}
