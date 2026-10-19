/** Diseases — diagnosis reference list used by visits and prescriptions. */
import { $, html, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { addDays, todayKey } from '../core/format.js';
import { createDataTable, rowActionButtons } from '../components/data-table.js';
import { confirmDialog, field, liveValidation, onHashAction, openModal, pageHeader, statusBadge, toast, urlQuery, validateForm, withBusy } from '../components/ui.js';

const categories = () => [...new Set(store.list('diseases').map((d) => d.category))].sort();
const specialties = () => [...new Set(store.list('doctors').map((d) => d.specialty))].sort();

export default function diseasesPage(main) {
  const header = document.createElement('div');
  const tableEl = document.createElement('div');
  main.append(header, tableEl);

  // Recent cases per diagnosis, from the visit history.
  const since = addDays(todayKey(), -90);
  const casesFor = (id) => store.list('visits').filter((v) => v.diagnosisId === id && v.date >= since && v.status === 'Completed').length;

  const renderHeader = () => {
    const all = store.list('diseases');
    render(header, html`
      ${pageHeader({
        title: 'Diseases',
        subtitle: `${all.filter((d) => d.status === 'Active').length} active diagnoses across ${categories().length} categories`,
        actions: html`<button type="button" class="btn btn-primary" data-new>${icon('plus', 'icon-sm')}Add disease</button>`,
      })}
      <p class="flex gap-2 items-start text-[13px] text-ink-3 -mt-3 mb-5">${icon('info', 'icon-sm mt-0.5')}
        Sample reference list for demonstration. It is not a complete or clinically authoritative catalogue.</p>`);
    $('[data-new]', header).addEventListener('click', () => openForm());
  };

  const table = createDataTable(tableEl, {
    rows: () => store.list('diseases'),
    initialSearch: urlQuery(),
    search: { placeholder: 'Search by name or code', text: (d) => `${d.name} ${d.code}` },
    filters: [
      { key: 'category', label: 'Category', options: categories().map((c) => [c, c]), match: (d, v) => d.category === v },
      { key: 'status', label: 'Status', options: [['Active', 'Active'], ['Archived', 'Archived']], match: (d, v) => d.status === v },
    ],
    sort: { key: 'name', dir: 'asc' },
    columns: [
      { key: 'code', label: 'Code', sortable: true, render: (d) => html`<span class="inline-block rounded-md bg-surface-2 border border-line px-1.5 py-0.5 text-[12.5px] font-semibold tabular-nums">${d.code}</span>` },
      { key: 'name', label: 'Disease', sortable: true, full: true, render: (d) => html`<button type="button" class="font-semibold hover:text-brand text-left" data-action="view" data-id="${d.id}">${d.name}</button><span class="block text-[12.5px] text-ink-3">${d.specialty}</span>` },
      { key: 'category', label: 'Category', sortable: true, render: (d) => d.category },
      { key: 'description', label: 'Description', wideOnly: true, render: (d) => html`<span class="block max-w-[360px] text-ink-2 text-[13.5px] line-clamp-2">${d.description}</span>` },
      { key: 'cases', label: 'Cases (90 days)', sortable: true, align: 'right', sortValue: (d) => casesFor(d.id), render: (d) => casesFor(d.id) },
      { key: 'status', label: 'Status', sortable: true, render: (d) => statusBadge(d.status) },
    ],
    actions: (d) => rowActionButtons(d.id, { label: d.name }),
    empty: { title: 'No diseases yet', text: 'Add the diagnoses your clinic records most often.' },
    onAction: (action, id) => {
      const disease = store.diseaseById(id);
      if (action === 'view') openDetails(disease);
      if (action === 'edit') openForm(disease);
      if (action === 'delete') removeDisease(disease);
    },
  });

  function openForm(disease = null) {
    const dialog = openModal({
      title: disease ? 'Edit disease' : 'Add disease',
      description: disease ? `${disease.code} · ${disease.name}` : 'Fields marked * are required.',
      body: html`
        <form id="disease-form" class="grid gap-4 sm:grid-cols-2" novalidate>
          ${field({ name: 'name', label: 'Disease name', required: true, value: disease?.name, className: 'sm:col-span-2', attrs: 'maxlength="80"' })}
          ${field({ name: 'code', label: 'Code', required: true, value: disease?.code, placeholder: 'e.g. J45.9', help: 'Letter, two digits, optional decimal part.', attrs: 'pattern="[A-Za-z][0-9]{2}(\\.[0-9A-Za-z]{1,4})?" maxlength="8"' })}
          ${field({ name: 'category', label: 'Category', type: 'select', required: true, value: disease?.category, placeholder: 'Select…', options: categories() })}
          ${field({ name: 'specialty', label: 'Usual specialty', type: 'select', required: true, value: disease?.specialty, placeholder: 'Select…', options: specialties() })}
          ${field({ name: 'status', label: 'Status', type: 'select', value: disease?.status ?? 'Active', options: ['Active', 'Archived'] })}
          ${field({ name: 'description', label: 'Description', type: 'textarea', value: disease?.description, className: 'sm:col-span-2', attrs: 'maxlength="240" rows="3"', help: 'A short summary shown in lists. Up to 240 characters.' })}
        </form>`,
      footer: html`
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button type="submit" form="disease-form" class="btn btn-primary">${icon('save', 'icon-sm')}${disease ? 'Save changes' : 'Add disease'}</button>`,
    });
    const form = $('form', dialog);
    const rules = (f) => {
      const code = f.code.value.trim().toUpperCase();
      const clash = store.list('diseases').find((d) => d.code.toUpperCase() === code && d.id !== disease?.id);
      return { code: clash ? `Code ${code} is already used by ${clash.name}.` : undefined };
    };
    liveValidation(form, rules);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = validateForm(form, rules);
      if (!values) return;
      values.code = values.code.toUpperCase();
      await withBusy($('button[type="submit"]', dialog), () => {
        if (disease) store.update('diseases', disease.id, values);
        else store.create('diseases', values);
      });
      toast(`${values.name} was ${disease ? 'updated' : 'added'}.`, { title: disease ? 'Disease updated' : 'Disease added' });
      dialog.close();
      renderHeader();
      table.refresh();
    });
    $('input', form).focus();
  }

  function openDetails(d) {
    const doctors = store.list('doctors').filter((doc) => doc.specialty === d.specialty);
    const dialog = openModal({
      title: d.name,
      description: `${d.code} · ${d.category}`,
      body: html`
        <div class="flex gap-2 mb-4">${statusBadge(d.status)}<span class="badge badge-plain">${d.specialty}</span></div>
        <p class="text-ink-2 mb-6">${d.description || 'No description added.'}</p>
        <dl class="grid grid-cols-2 gap-4">
          <div class="rounded-lg bg-surface-2 p-4"><dt class="text-[12.5px] text-ink-3">Cases in the last 90 days</dt><dd class="text-2xl font-[650] mt-1">${casesFor(d.id)}</dd></div>
          <div class="rounded-lg bg-surface-2 p-4"><dt class="text-[12.5px] text-ink-3">Prescriptions linked</dt><dd class="text-2xl font-[650] mt-1">${store.list('prescriptions').filter((p) => p.diagnosisId === d.id).length}</dd></div>
        </dl>
        <p class="text-[13px] text-ink-3 mt-4">Usually seen by ${doctors.length ? doctors.map((doc) => doc.name).join(', ') : 'no doctor on the current roster'}.</p>`,
      footer: html`
        <button type="button" class="btn btn-secondary" data-close>Close</button>
        <button type="button" class="btn btn-primary" data-edit>${icon('pencil', 'icon-sm')}Edit</button>`,
    });
    $('[data-edit]', dialog).addEventListener('click', () => {
      dialog.close();
      openForm(d);
    });
  }

  async function removeDisease(d) {
    const linked = store.list('prescriptions').filter((p) => p.diagnosisId === d.id).length;
    const ok = await confirmDialog({
      title: `Delete ${d.name}?`,
      message: linked
        ? `${linked} prescriptions reference this diagnosis and will show it as “Not recorded”. To keep history intact, consider setting its status to Archived instead.`
        : 'This removes the diagnosis from the reference list.',
      confirmLabel: 'Delete disease',
    });
    if (!ok) return;
    store.remove('diseases', d.id);
    toast(`${d.name} was deleted.`, { title: 'Disease deleted' });
    renderHeader();
    table.refresh();
  }

  renderHeader();
  onHashAction('new', () => openForm());
}
