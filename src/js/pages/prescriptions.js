/**
 * Prescriptions — list, create/edit (draft → issued → completed), detail
 * sheet and print layout.
 *
 * UI demonstration only: this is not a validated prescribing or clinical
 * decision-support system. Medication names are fictional.
 */
import { $, $$, appendHtml, html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { addDays, formatDate, formatLongDate, todayKey } from '../core/format.js';
import { app } from '../config/navigation.js';
import { DURATIONS, FREQUENCIES, MEDICATIONS } from '../data/mock-data.js';
import { createDataTable } from '../components/data-table.js';
import { avatar, confirmDialog, field, liveValidation, onHashAction, openModal, pageHeader, statusBadge, toast, urlQuery, validateForm, withBusy } from '../components/ui.js';

const DATE_RANGES = [
  ['today', 'Today', 0],
  ['7', 'Last 7 days', 7],
  ['30', 'Last 30 days', 30],
  ['90', 'Last 90 days', 90],
];

const patientLabel = (p) => `${store.patientName(p)} (${p.id})`;

export default function prescriptionsPage(main) {
  const header = document.createElement('div');
  const tableEl = document.createElement('div');
  main.append(header, tableEl);

  const renderHeader = () => {
    const all = store.list('prescriptions');
    render(header, html`
      ${pageHeader({
        title: 'Prescriptions',
        subtitle: `${all.filter((p) => p.status === 'Draft').length} drafts · ${all.filter((p) => p.status === 'Issued').length} issued and awaiting completion`,
        actions: html`<button type="button" class="btn btn-primary" data-new>${icon('plus', 'icon-sm')}New prescription</button>`,
      })}
      <div class="flex gap-3 items-start rounded-lg border border-line bg-info-soft/60 px-4 py-3 mb-5 text-[13.5px]">
        <span class="text-info mt-0.5">${icon('info', 'icon-sm')}</span>
        <p class="text-ink-2">These screens are a UI demonstration with fictional medications. They are not a validated prescribing or clinical decision-support system.</p>
      </div>`);
    $('[data-new]', header).addEventListener('click', () => openForm());
  };

  const table = createDataTable(tableEl, {
    rows: () => store.list('prescriptions'),
    initialSearch: urlQuery(),
    search: { placeholder: 'Search by prescription ID or patient', text: (p) => `${p.id} ${store.patientName(store.patientById(p.patientId))} ${p.patientId}` },
    filters: [
      { key: 'status', label: 'Status', options: ['Draft', 'Issued', 'Completed', 'Cancelled'].map((s) => [s, s]), match: (p, v) => p.status === v },
      { key: 'date', label: 'Date', options: DATE_RANGES.map(([k, l]) => [k, l]), match: (p, v) => p.date >= addDays(todayKey(), -DATE_RANGES.find(([k]) => k === v)[2]) },
      { key: 'doctor', label: 'Doctor', options: store.list('doctors').map((d) => [d.id, d.name]), match: (p, v) => p.doctorId === v },
    ],
    sort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'id', label: 'Prescription', sortable: true, render: (p) => html`<button type="button" class="font-semibold hover:text-brand tabular-nums" data-action="view" data-id="${p.id}">${p.id}</button>` },
      {
        key: 'patient', label: 'Patient', sortable: true, full: true, sortValue: (p) => store.patientName(store.patientById(p.patientId)),
        render: (p) => {
          const patient = store.patientById(p.patientId);
          return html`<div class="flex items-center gap-3 min-w-0">${avatar(store.patientName(patient), 'avatar-sm')}<div class="min-w-0"><p class="font-medium truncate">${store.patientName(patient)}</p><p class="text-[12.5px] text-ink-3">${p.patientId}</p></div></div>`;
        },
      },
      { key: 'doctor', label: 'Prescribed by', sortable: true, sortValue: (p) => store.doctorById(p.doctorId)?.name ?? '', render: (p) => html`<span class="whitespace-nowrap">${store.doctorById(p.doctorId)?.name ?? 'Removed doctor'}</span>` },
      { key: 'date', label: 'Date', sortable: true, render: (p) => html`<span class="whitespace-nowrap">${formatDate(p.date)}</span>` },
      { key: 'items', label: 'Items', sortable: true, align: 'right', sortValue: (p) => p.items.length, render: (p) => p.items.length },
      { key: 'status', label: 'Status', sortable: true, render: (p) => statusBadge(p.status) },
    ],
    actions: (p) => html`
      <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="view" data-id="${p.id}" aria-label="View ${p.id}" data-tooltip="View">${icon('eye', 'icon-sm')}</button>
      <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="print" data-id="${p.id}" aria-label="Print ${p.id}" data-tooltip="Print">${icon('printer', 'icon-sm')}</button>
      ${p.status === 'Draft'
        ? html`<button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${p.id}" aria-label="Edit ${p.id}" data-tooltip="Edit draft">${icon('pencil', 'icon-sm')}</button>
               <button type="button" class="btn btn-ghost btn-icon btn-sm hover:!text-danger" data-action="delete" data-id="${p.id}" aria-label="Delete ${p.id}" data-tooltip="Delete draft">${icon('trash', 'icon-sm')}</button>`
        : ''}`,
    empty: { title: 'No prescriptions yet', text: 'Prescriptions written after a visit appear here.' },
    onAction: (action, id) => {
      const rx = store.get('prescriptions', id);
      if (action === 'view') openDetails(rx);
      if (action === 'edit') openForm(rx);
      if (action === 'print') printPrescription(rx);
      if (action === 'delete') removeDraft(rx);
    },
  });

  const refresh = () => {
    renderHeader();
    table.refresh();
  };

  /* ------------------------------------------------------------ Form */
  const itemRow = (item = {}) => html`
    <fieldset class="rounded-lg border border-line p-4 grid gap-3 sm:grid-cols-6 relative" data-item>
      <legend class="sr-only">Medication</legend>
      ${field({ name: 'medication', label: 'Medication', required: true, value: item.medication, className: 'sm:col-span-4', attrs: 'list="medication-list" maxlength="80" autocomplete="off"' })}
      ${field({ name: 'dosage', label: 'Dosage', required: true, value: item.dosage, placeholder: '1 tablet', className: 'sm:col-span-2', attrs: 'maxlength="30"' })}
      ${field({ name: 'frequency', label: 'Frequency', type: 'select', required: true, value: item.frequency, placeholder: 'Select…', options: FREQUENCIES, className: 'sm:col-span-2' })}
      ${field({ name: 'duration', label: 'Duration', type: 'select', required: true, value: item.duration, placeholder: 'Select…', options: DURATIONS, className: 'sm:col-span-2' })}
      ${field({ name: 'instructions', label: 'Instructions', value: item.instructions, placeholder: 'Take after meals', className: 'sm:col-span-2', attrs: 'maxlength="80"' })}
      <button type="button" class="btn btn-ghost btn-sm justify-self-start sm:col-span-6 text-ink-3 hover:!text-danger -ml-2" data-remove-item>${icon('trash', 'icon-sm')}Remove medication</button>
    </fieldset>`;

  function openForm(rx = null, preset = {}) {
    const patient = store.patientById(rx?.patientId ?? preset.patientId);
    const doctors = store.list('doctors').filter((d) => d.availability === 'Available' || d.id === rx?.doctorId);
    const dialog = openModal({
      title: rx ? `Edit draft ${rx.id}` : 'New prescription',
      description: 'Fields marked * are required. Save as a draft to finish later.',
      size: 'dialog-lg',
      body: html`
        <form id="rx-form" class="grid gap-5" novalidate>
          <div class="grid gap-4 sm:grid-cols-2">
            ${field({ name: 'patient', label: 'Patient', required: true, value: patient ? patientLabel(patient) : '', placeholder: 'Start typing a name or ID', attrs: 'list="patient-list" autocomplete="off"' })}
            ${field({ name: 'doctorId', label: 'Prescribing doctor', type: 'select', required: true, value: rx?.doctorId, placeholder: 'Select…', options: doctors.map((d) => [d.id, `${d.name} (${d.specialty})`]) })}
            ${field({ name: 'diagnosisId', label: 'Diagnosis', type: 'select', value: rx?.diagnosisId ?? '', placeholder: 'Not recorded', options: store.list('diseases').filter((d) => d.status === 'Active').map((d) => [d.id, `${d.name} (${d.code})`]) })}
            ${field({ name: 'date', label: 'Date', type: 'date', required: true, value: rx?.date ?? todayKey(), attrs: `max="${todayKey()}"` })}
          </div>
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold">Medications</h3>
              <button type="button" class="btn btn-secondary btn-sm" data-add-item>${icon('plus', 'icon-sm')}Add medication</button>
            </div>
            <div class="grid gap-3" data-items>${(rx?.items ?? [{}]).map(itemRow)}</div>
          </div>
          ${field({ name: 'notes', label: 'Notes for the patient', type: 'textarea', value: rx?.notes, attrs: 'maxlength="300" rows="2"' })}
          <datalist id="patient-list">${store.list('patients').map((p) => html`<option value="${patientLabel(p)}"></option>`)}</datalist>
          <datalist id="medication-list">${MEDICATIONS.map((m) => html`<option value="${m}"></option>`)}</datalist>
        </form>`,
      footer: html`
        <button type="button" class="btn btn-ghost max-sm:hidden mr-auto" data-close>Cancel</button>
        <button type="button" class="btn btn-secondary" data-save="Draft">${icon('save', 'icon-sm')}Save draft</button>
        <button type="button" class="btn btn-primary" data-save="Issued">${icon('check', 'icon-sm')}Issue prescription</button>`,
    });

    const form = $('form', dialog);
    const items = $('[data-items]', form);
    const syncRemoveButtons = () => $$('[data-remove-item]', items).forEach((b) => (b.hidden = items.children.length === 1));
    syncRemoveButtons();

    on(form, 'click', '[data-add-item]', () => {
      appendHtml(items, itemRow());
      syncRemoveButtons();
      $('[data-item]:last-child input', items).focus();
    });
    on(form, 'click', '[data-remove-item]', (e, btn) => {
      btn.closest('[data-item]').remove();
      syncRemoveButtons();
      $('[data-add-item]', form).focus();
    });

    const findPatient = (value) => store.list('patients').find((p) => patientLabel(p) === value || p.id === value.toUpperCase());
    const rules = (f) => ({ patient: f.patient.value && !findPatient(f.patient.value.trim()) ? 'Choose a patient from the list.' : undefined });
    liveValidation(form, rules);

    on(dialog, 'click', '[data-save]', async (e, btn) => {
      const values = validateForm(form, rules);
      if (!values) return;
      const record = {
        patientId: findPatient(values.patient).id,
        doctorId: values.doctorId,
        diagnosisId: values.diagnosisId || null,
        date: values.date,
        notes: values.notes,
        status: btn.dataset.save,
        items: $$('[data-item]', items).map((row) => Object.fromEntries(
          ['medication', 'dosage', 'frequency', 'duration', 'instructions'].map((k) => [k, row.querySelector(`[name="${k}"]`).value.trim()]),
        )),
      };
      const saved = await withBusy(btn, () => (rx ? store.update('prescriptions', rx.id, record) : store.create('prescriptions', record)));
      toast(record.status === 'Draft' ? `${saved.id} was saved as a draft.` : `${saved.id} was issued to ${store.patientName(store.patientById(saved.patientId))}.`, {
        title: record.status === 'Draft' ? 'Draft saved' : 'Prescription issued',
      });
      dialog.close();
      refresh();
    });
    $(patient ? 'select' : 'input', form).focus();
  }

  /* --------------------------------------------------------- Details */
  const sheet = (rx, { forPrint = false } = {}) => {
    const patient = store.patientById(rx.patientId);
    const doctor = store.doctorById(rx.doctorId);
    const diagnosis = store.diseaseById(rx.diagnosisId);
    return html`
      <div class="${forPrint ? 'text-black' : ''}">
        <div class="flex items-start justify-between gap-4 pb-4 border-b ${forPrint ? 'border-black' : 'border-line'}">
          <div>
            <p class="text-lg font-[680]">${app.name} Clinic</p>
            <p class="text-[13px] ${forPrint ? '' : 'text-ink-3'}">${doctor?.specialty ?? ''} · ${doctor?.room ?? ''}</p>
          </div>
          <div class="text-right">
            <p class="font-semibold tabular-nums">${rx.id}</p>
            <p class="text-[13px] ${forPrint ? '' : 'text-ink-3'}">${formatLongDate(rx.date)}</p>
          </div>
        </div>
        <dl class="grid grid-cols-2 gap-4 py-4 text-[13.5px]">
          <div><dt class="${forPrint ? 'font-semibold' : 'text-ink-3'} text-[12.5px]">Patient</dt><dd class="font-medium">${store.patientName(patient)}</dd><dd>${rx.patientId}${patient ? html`, born ${formatDate(patient.dob)}` : ''}</dd></div>
          <div><dt class="${forPrint ? 'font-semibold' : 'text-ink-3'} text-[12.5px]">Prescribed by</dt><dd class="font-medium">${doctor?.name ?? 'Removed doctor'}</dd><dd>${doctor?.phone ?? ''}</dd></div>
          <div class="col-span-2"><dt class="${forPrint ? 'font-semibold' : 'text-ink-3'} text-[12.5px]">Diagnosis</dt><dd class="font-medium">${diagnosis ? `${diagnosis.name} (${diagnosis.code})` : 'Not recorded'}</dd></div>
        </dl>
        <div class="${forPrint ? '' : 'rounded-lg border border-line overflow-x-auto'}">
          <table class="table text-[13.5px]">
            <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
            <tbody>${rx.items.map((i) => html`<tr><td class="font-medium">${i.medication}</td><td>${i.dosage}</td><td>${i.frequency}</td><td>${i.duration}</td><td>${i.instructions || '—'}</td></tr>`)}</tbody>
          </table>
        </div>
        ${rx.notes ? html`<p class="mt-4 text-[13.5px]"><span class="font-semibold">Notes:</span> ${rx.notes}</p>` : ''}
        ${forPrint ? html`
          <div class="mt-16 flex justify-end"><div class="w-60 border-t border-black pt-2 text-center text-[12px]">${doctor?.name ?? ''}</div></div>
          <p class="mt-10 text-[11px] border border-black p-2">Template demonstration with fictional data. Not a valid prescription and not for clinical use.</p>` : ''}
      </div>`;
  };

  function openDetails(rx) {
    const next = { Draft: ['Issued', 'Issue prescription', 'check'], Issued: ['Completed', 'Mark as completed', 'success'] }[rx.status];
    const dialog = openModal({
      title: `Prescription ${rx.id}`,
      description: `${rx.items.length} item${rx.items.length === 1 ? '' : 's'}`,
      size: 'dialog-lg',
      body: html`<div class="mb-4">${statusBadge(rx.status)}</div>${sheet(rx)}`,
      footer: html`
        ${['Draft', 'Issued'].includes(rx.status) ? html`<button type="button" class="btn btn-ghost text-danger mr-auto max-sm:order-last" data-cancel-rx>Cancel prescription</button>` : ''}
        <button type="button" class="btn btn-secondary" data-print>${icon('printer', 'icon-sm')}Print</button>
        ${rx.status === 'Draft' ? html`<button type="button" class="btn btn-secondary" data-edit>${icon('pencil', 'icon-sm')}Edit</button>` : ''}
        ${next ? html`<button type="button" class="btn btn-primary" data-next>${icon(next[2], 'icon-sm')}${next[1]}</button>` : ''}`,
    });
    $('[data-print]', dialog).addEventListener('click', () => printPrescription(rx));
    $('[data-edit]', dialog)?.addEventListener('click', () => {
      dialog.close();
      openForm(rx);
    });
    $('[data-next]', dialog)?.addEventListener('click', () => {
      store.update('prescriptions', rx.id, { status: next[0] });
      toast(`${rx.id} is now ${next[0].toLowerCase()}.`, { title: next[0] === 'Issued' ? 'Prescription issued' : 'Prescription completed' });
      dialog.close();
      refresh();
    });
    $('[data-cancel-rx]', dialog)?.addEventListener('click', async () => {
      dialog.close();
      const ok = await confirmDialog({ title: `Cancel ${rx.id}?`, message: 'The prescription stays on record with the status Cancelled and can no longer be issued or completed.', confirmLabel: 'Cancel prescription' });
      if (!ok) return;
      store.update('prescriptions', rx.id, { status: 'Cancelled' });
      toast(`${rx.id} was cancelled.`, { title: 'Prescription cancelled' });
      refresh();
    });
  }

  function printPrescription(rx) {
    let el = $('.print-sheet');
    if (!el) {
      el = document.createElement('div');
      el.className = 'print-sheet';
      document.body.append(el);
    }
    render(el, sheet(rx, { forPrint: true }));
    document.body.classList.add('printing');
    window.addEventListener('afterprint', () => document.body.classList.remove('printing'), { once: true });
    window.print();
  }

  async function removeDraft(rx) {
    const ok = await confirmDialog({ title: `Delete draft ${rx.id}?`, message: 'The draft and its medications will be removed. This cannot be undone.', confirmLabel: 'Delete draft' });
    if (!ok) return;
    store.remove('prescriptions', rx.id);
    toast(`Draft ${rx.id} was deleted.`, { title: 'Draft deleted' });
    refresh();
  }

  renderHeader();
  const params = new URLSearchParams(location.search);
  onHashAction('new', () => openForm(null, { patientId: params.get('patient') }));
  const exact = store.get('prescriptions', urlQuery().toUpperCase());
  if (exact) openDetails(exact);
}
