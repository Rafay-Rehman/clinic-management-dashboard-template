/** Patients — directory with search, filters, sorting and CRUD. */
import { $, html, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { ageFrom, formatDate, formatTime, todayKey } from '../core/format.js';
import { createDataTable, rowActionButtons } from '../components/data-table.js';
import { avatar, confirmDialog, field, liveValidation, onHashAction, openModal, pageHeader, statusBadge, toast, urlQuery, validateForm, withBusy } from '../components/ui.js';

const AGE_GROUPS = [
  ['child', 'Children (0–12)', 0, 12],
  ['teen', 'Teens (13–17)', 13, 17],
  ['adult', 'Adults (18–64)', 18, 64],
  ['senior', 'Seniors (65+)', 65, 200],
];

export default function patientsPage(main) {
  const header = document.createElement('div');
  const tableEl = document.createElement('div');
  main.append(header, tableEl);

  const renderHeader = () => {
    const all = store.list('patients');
    render(header, pageHeader({
      title: 'Patients',
      subtitle: `${all.length.toLocaleString('en-US')} registered patients · ${all.filter((p) => p.status === 'Follow-up').length} need follow-up`,
      actions: html`<button type="button" class="btn btn-primary" data-new>${icon('user-plus', 'icon-sm')}Add patient</button>`,
    }));
    $('[data-new]', header).addEventListener('click', () => openForm());
  };

  const table = createDataTable(tableEl, {
    rows: () => store.list('patients'),
    initialSearch: urlQuery(),
    search: { placeholder: 'Search by name or patient ID', text: (p) => `${store.patientName(p)} ${p.id}` },
    filters: [
      { key: 'status', label: 'Status', options: ['Active', 'Follow-up', 'Inactive'].map((s) => [s, s]), match: (p, v) => p.status === v },
      { key: 'gender', label: 'Gender', options: ['Female', 'Male', 'Other'].map((s) => [s, s]), match: (p, v) => p.gender === v },
      {
        key: 'age', label: 'Age', options: AGE_GROUPS.map(([k, l]) => [k, l]),
        match: (p, v) => {
          const [, , min, max] = AGE_GROUPS.find(([k]) => k === v);
          const age = ageFrom(p.dob);
          return age >= min && age <= max;
        },
      },
    ],
    sort: { key: 'registeredOn', dir: 'desc' },
    columns: [
      {
        key: 'name', label: 'Patient', sortable: true, full: true, sortValue: (p) => store.patientName(p),
        render: (p) => html`<div class="flex items-center gap-3 min-w-0">${avatar(store.patientName(p))}<div class="min-w-0">
          <button type="button" class="font-semibold hover:text-brand text-left truncate block max-w-full" data-action="view" data-id="${p.id}">${store.patientName(p)}</button>
          <p class="text-[12.5px] text-ink-3">${p.id}</p></div></div>`,
      },
      { key: 'age', label: 'Age', sortable: true, sortValue: (p) => ageFrom(p.dob), render: (p) => html`<span class="font-medium">${ageFrom(p.dob)} yrs</span><span class="block text-[12.5px] text-ink-3">${formatDate(p.dob)}</span>` },
      { key: 'gender', label: 'Gender', render: (p) => p.gender },
      { key: 'contact', label: 'Contact', render: (p) => html`<span class="block whitespace-nowrap">${p.phone}</span><span class="block text-[12.5px] text-ink-3 truncate max-w-[220px]">${p.email || '—'}</span>` },
      { key: 'registeredOn', label: 'Registered', sortable: true, render: (p) => html`<span class="whitespace-nowrap">${formatDate(p.registeredOn)}</span>` },
      { key: 'status', label: 'Status', sortable: true, render: (p) => statusBadge(p.status) },
    ],
    actions: (p) => rowActionButtons(p.id, { label: store.patientName(p) }),
    empty: { title: 'No patients yet', text: 'Registered patients will be listed here.', action: html`<button type="button" class="btn btn-primary btn-sm" data-new>Add patient</button>` },
    onAction: (action, id) => {
      const patient = store.patientById(id);
      if (action === 'view') openDetails(patient);
      if (action === 'edit') openForm(patient);
      if (action === 'delete') deletePatient(patient);
    },
  });
  tableEl.addEventListener('click', (e) => e.target.closest('[data-new]') && openForm());

  /* ------------------------------------------------------------ Form */
  function openForm(patient = null) {
    const dialog = openModal({
      title: patient ? 'Edit patient' : 'Add patient',
      description: patient ? `${store.patientName(patient)} · ${patient.id}` : 'Fields marked * are required.',
      body: html`
        <form id="patient-form" class="grid gap-4 sm:grid-cols-2" novalidate>
          ${field({ name: 'firstName', label: 'First name', required: true, value: patient?.firstName, attrs: 'maxlength="60" autocomplete="off"' })}
          ${field({ name: 'lastName', label: 'Last name', required: true, value: patient?.lastName, attrs: 'maxlength="60" autocomplete="off"' })}
          ${field({ name: 'dob', label: 'Date of birth', type: 'date', required: true, value: patient?.dob, attrs: `min="1900-01-01" max="${todayKey()}"` })}
          ${field({ name: 'gender', label: 'Gender', type: 'select', required: true, value: patient?.gender, placeholder: 'Select…', options: ['Female', 'Male', 'Other', 'Prefer not to say'] })}
          ${field({ name: 'phone', label: 'Phone', type: 'tel', required: true, value: patient?.phone, placeholder: '+1 555-0100', attrs: 'pattern="[+0-9()\\s-]{7,20}" autocomplete="off"', help: 'Digits, spaces, +, ( ) and - only.' })}
          ${field({ name: 'email', label: 'Email', type: 'email', value: patient?.email, placeholder: 'name@example.com', attrs: 'maxlength="120" autocomplete="off"' })}
          ${field({ name: 'status', label: 'Status', type: 'select', value: patient?.status ?? 'Active', options: ['Active', 'Follow-up', 'Inactive'], className: 'sm:col-span-2' })}
        </form>`,
      footer: html`
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button type="submit" form="patient-form" class="btn btn-primary">${icon('save', 'icon-sm')}${patient ? 'Save changes' : 'Add patient'}</button>`,
    });
    const form = $('form', dialog);
    const rules = (f) => ({ dob: f.dob.value && f.dob.value > todayKey() ? 'Date of birth can’t be in the future.' : undefined });
    liveValidation(form, rules);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = validateForm(form, rules);
      if (!values) return;
      await withBusy($('button[type="submit"]', dialog), () => {
        if (patient) {
          store.update('patients', patient.id, values);
          toast(`${values.firstName} ${values.lastName}’s details were updated.`, { title: 'Patient updated' });
        } else {
          const created = store.create('patients', { ...values, registeredOn: todayKey() });
          toast(`${store.patientName(created)} was registered as ${created.id}.`, { title: 'Patient added' });
        }
      });
      dialog.close();
      renderHeader();
      table.refresh();
    });
    $('input', form).focus();
  }

  /* --------------------------------------------------------- Details */
  function openDetails(patient) {
    const visits = store.list('visits').filter((v) => v.patientId === patient.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const completed = visits.filter((v) => v.status === 'Completed');
    const prescriptions = store.list('prescriptions').filter((p) => p.patientId === patient.id);
    const doctorCounts = completed.reduce((m, v) => m.set(v.doctorId, (m.get(v.doctorId) ?? 0) + 1), new Map());
    const primary = [...doctorCounts].sort((a, b) => b[1] - a[1])[0];

    const item = (label, value) => html`<div><dt class="text-[12.5px] text-ink-3">${label}</dt><dd class="font-medium mt-0.5 break-words">${value}</dd></div>`;
    const dialog = openModal({
      title: store.patientName(patient),
      description: `${patient.id} · Registered ${formatDate(patient.registeredOn)}`,
      size: 'dialog-lg',
      body: html`
        <div class="flex items-center gap-4 mb-6">
          ${avatar(store.patientName(patient), 'avatar-lg')}
          <div class="flex flex-wrap gap-2">${statusBadge(patient.status)}<span class="badge badge-plain">${ageFrom(patient.dob)} years</span><span class="badge badge-plain">${patient.gender}</span></div>
        </div>
        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mb-6">
          ${item('Date of birth', formatDate(patient.dob))}
          ${item('Phone', patient.phone)}
          ${item('Email', patient.email || '—')}
          ${item('Visits (6 months)', completed.length)}
          ${item('Last visit', completed[0] ? formatDate(completed[0].date) : 'No visits yet')}
          ${item('Usual doctor', primary ? store.doctorById(primary[0])?.name : '—')}
        </dl>
        <h3 class="font-semibold mb-2">Recent visits</h3>
        ${visits.length
          ? html`<ul class="rounded-lg border border-line divide-y divide-line">${visits.slice(0, 5).map((v) => html`
              <li class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[13.5px]">
                <span class="w-28 shrink-0 font-medium">${formatDate(v.date)}</span>
                <span class="flex-1 min-w-[140px] text-ink-2">${v.reason}<span class="text-ink-3"> · ${store.doctorById(v.doctorId)?.name} · ${formatTime(v.time)}</span></span>
                ${statusBadge(v.status)}
              </li>`)}</ul>`
          : html`<p class="text-ink-3 text-[13.5px] rounded-lg border border-dashed border-line-strong px-4 py-6 text-center">No visits recorded for this patient yet.</p>`}
        <p class="mt-4 text-[13.5px] text-ink-3">${prescriptions.length} prescription${prescriptions.length === 1 ? '' : 's'} on file.
          ${prescriptions.length ? html`<a class="text-brand font-semibold hover:underline" href="prescriptions.html?q=${encodeURIComponent(store.patientName(patient))}">View prescriptions</a>` : ''}</p>`,
      footer: html`
        <button type="button" class="btn btn-ghost text-danger mr-auto max-sm:order-last" data-delete>${icon('trash', 'icon-sm')}Delete</button>
        <a class="btn btn-secondary" href="prescriptions.html?patient=${patient.id}#new">${icon('pill', 'icon-sm')}New prescription</a>
        <button type="button" class="btn btn-primary" data-edit>${icon('pencil', 'icon-sm')}Edit details</button>`,
    });
    $('[data-edit]', dialog).addEventListener('click', () => {
      dialog.close();
      openForm(patient);
    });
    $('[data-delete]', dialog).addEventListener('click', () => {
      dialog.close();
      deletePatient(patient);
    });
  }

  async function deletePatient(patient) {
    const rx = store.list('prescriptions').filter((p) => p.patientId === patient.id).length;
    const visits = store.list('visits').filter((v) => v.patientId === patient.id).length;
    const ok = await confirmDialog({
      title: `Delete ${store.patientName(patient)}?`,
      message: `This permanently removes ${patient.id}${visits || rx ? `, along with ${visits} visit${visits === 1 ? '' : 's'} and ${rx} prescription${rx === 1 ? '' : 's'},` : ''} from the demo data.`,
      confirmLabel: 'Delete patient',
    });
    if (!ok) return;
    store.remove('patients', patient.id);
    toast(`${store.patientName(patient)} was deleted.`, { title: 'Patient deleted' });
    renderHeader();
    table.refresh();
  }

  renderHeader();
  onHashAction('new', () => openForm());
  const exact = store.patientById(urlQuery());
  if (exact) openDetails(exact);
}
