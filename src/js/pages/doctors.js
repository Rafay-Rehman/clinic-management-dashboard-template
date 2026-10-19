/** Doctors — staff directory shown as cards, with roster status and workload. */
import { $, html, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { addDays, formatDate, formatTime, todayKey } from '../core/format.js';
import { createDataTable } from '../components/data-table.js';
import { avatar, confirmDialog, emptyState, field, liveValidation, onHashAction, openModal, pageHeader, statusBadge, toast, urlQuery, validateForm, withBusy } from '../components/ui.js';

const STATUSES = ['Available', 'In consultation', 'On leave', 'Off duty'];
const specialties = () => [...new Set(store.list('doctors').map((d) => d.specialty))].sort();

function workload(doctor) {
  const since = addDays(todayKey(), -90);
  const visits = store.list('visits').filter((v) => v.doctorId === doctor.id);
  return {
    patients: new Set(visits.filter((v) => v.date >= since && v.status === 'Completed').map((v) => v.patientId)).size,
    today: visits.filter((v) => v.date === todayKey()),
    prescriptions: store.list('prescriptions').filter((p) => p.doctorId === doctor.id).length,
    visits: visits.length,
  };
}

export default function doctorsPage(main) {
  const header = document.createElement('div');
  const listEl = document.createElement('div');
  main.append(header, listEl);

  const renderHeader = () => {
    const all = store.list('doctors');
    render(header, pageHeader({
      title: 'Doctors',
      subtitle: `${all.length} doctors · ${all.filter((d) => d.availability === 'Available').length} on duty today`,
      actions: html`<button type="button" class="btn btn-primary" data-new>${icon('plus', 'icon-sm')}Add doctor</button>`,
    }));
    $('[data-new]', header).addEventListener('click', () => openForm());
  };

  const card = (d) => {
    const status = store.doctorStatus(d);
    const load = workload(d);
    return html`
      <article class="card p-5 flex flex-col">
        <div class="flex items-start gap-3.5">
          ${avatar(d.name, 'avatar-lg')}
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold text-[15px] truncate"><button type="button" class="hover:text-brand text-left" data-action="view" data-id="${d.id}">${d.name}</button></h2>
            <p class="text-[13px] text-ink-3">${d.specialty}</p>
            <div class="mt-2">${statusBadge(status)}</div>
          </div>
        </div>
        <dl class="grid grid-cols-3 gap-2 mt-5 rounded-lg bg-surface-2 p-3 text-center">
          <div><dt class="text-[12px] text-ink-3">Patients</dt><dd class="font-semibold tabular-nums">${load.patients}</dd></div>
          <div><dt class="text-[12px] text-ink-3">Today</dt><dd class="font-semibold tabular-nums">${load.today.length}</dd></div>
          <div><dt class="text-[12px] text-ink-3">Room</dt><dd class="font-semibold">${d.room.replace('Room ', '') || '—'}</dd></div>
        </dl>
        <ul class="mt-4 space-y-1.5 text-[13.5px] text-ink-2">
          <li class="flex items-center gap-2 min-w-0">${icon('phone', 'icon-sm text-ink-3')}<span>${d.phone}</span></li>
          <li class="flex items-center gap-2 min-w-0">${icon('mail', 'icon-sm text-ink-3')}<span class="truncate">${d.email}</span></li>
        </ul>
        <div class="flex items-center gap-1 mt-5 pt-4 border-t border-line">
          <button type="button" class="btn btn-secondary btn-sm mr-auto" data-action="view" data-id="${d.id}">View profile</button>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${d.id}" aria-label="Edit ${d.name}" data-tooltip="Edit">${icon('pencil', 'icon-sm')}</button>
          <button type="button" class="btn btn-ghost btn-icon btn-sm hover:!text-danger" data-action="delete" data-id="${d.id}" aria-label="Delete ${d.name}" data-tooltip="Delete">${icon('trash', 'icon-sm')}</button>
        </div>
      </article>`;
  };

  const list = createDataTable(listEl, {
    rows: () => [...store.list('doctors')].sort((a, b) => a.name.localeCompare(b.name)),
    initialSearch: urlQuery(),
    search: { placeholder: 'Search by doctor name', text: (d) => d.name },
    filters: [
      { key: 'specialty', label: 'Specialty', options: specialties().map((s) => [s, s]), match: (d, v) => d.specialty === v },
      { key: 'status', label: 'Status', options: STATUSES.map((s) => [s, s]), match: (d, v) => store.doctorStatus(d) === v },
    ],
    pageSize: 9,
    pageSizes: [9, 18, 36],
    body: (rows) => html`<div class="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 bg-canvas/40">${rows.map(card)}</div>`,
    empty: { title: 'No doctors yet', text: 'Add your medical staff to start assigning visits.' },
    onAction: (action, id) => {
      const doctor = store.doctorById(id);
      if (action === 'view') openDetails(doctor);
      if (action === 'edit') openForm(doctor);
      if (action === 'delete') removeDoctor(doctor);
    },
  });

  function openForm(doctor = null) {
    const dialog = openModal({
      title: doctor ? 'Edit doctor' : 'Add doctor',
      description: doctor ? `${doctor.name} · ${doctor.id}` : 'Fields marked * are required.',
      body: html`
        <form id="doctor-form" class="grid gap-4 sm:grid-cols-2" novalidate>
          ${field({ name: 'name', label: 'Full name', required: true, value: doctor?.name.replace(/^Dr\.\s*/, ''), help: '“Dr.” is added automatically.', attrs: 'maxlength="60" autocomplete="off"' })}
          ${field({ name: 'specialty', label: 'Specialty', required: true, value: doctor?.specialty, attrs: 'list="specialty-list" maxlength="40" autocomplete="off"', help: 'Pick from the list or type a new one.' })}
          ${field({ name: 'phone', label: 'Phone', type: 'tel', required: true, value: doctor?.phone, placeholder: '+1 555-0100', attrs: 'pattern="[+0-9()\\s-]{7,20}"' })}
          ${field({ name: 'email', label: 'Work email', type: 'email', required: true, value: doctor?.email, placeholder: 'name@clinic.example.com', attrs: 'maxlength="120"' })}
          ${field({ name: 'room', label: 'Room', value: doctor?.room, placeholder: 'Room 101', attrs: 'maxlength="20"' })}
          ${field({ name: 'availability', label: 'Roster status', type: 'select', value: doctor?.availability ?? 'Available', options: ['Available', 'On leave', 'Off duty'] })}
          <datalist id="specialty-list">${specialties().map((s) => html`<option value="${s}"></option>`)}</datalist>
        </form>`,
      footer: html`
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button type="submit" form="doctor-form" class="btn btn-primary">${icon('save', 'icon-sm')}${doctor ? 'Save changes' : 'Add doctor'}</button>`,
    });
    const form = $('form', dialog);
    liveValidation(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = validateForm(form);
      if (!values) return;
      values.name = `Dr. ${values.name.replace(/^Dr\.?\s*/i, '')}`;
      await withBusy($('button[type="submit"]', dialog), () => {
        if (doctor) store.update('doctors', doctor.id, values);
        else store.create('doctors', { ...values, joinedOn: todayKey() });
      });
      toast(`${values.name} was ${doctor ? 'updated' : 'added to the directory'}.`, { title: doctor ? 'Doctor updated' : 'Doctor added' });
      dialog.close();
      renderHeader();
      list.refresh();
    });
    $('input', form).focus();
  }

  function openDetails(d) {
    const load = workload(d);
    const dialog = openModal({
      title: d.name,
      description: `${d.specialty} · ${d.id}`,
      size: 'dialog-lg',
      body: html`
        <div class="flex flex-wrap items-center gap-4 mb-6">
          ${avatar(d.name, 'avatar-lg')}
          <div class="flex flex-wrap gap-2">${statusBadge(store.doctorStatus(d))}<span class="badge badge-plain">${d.room || 'No room'}</span><span class="badge badge-plain">Joined ${formatDate(d.joinedOn)}</span></div>
        </div>
        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          ${[['Patients (90 days)', load.patients], ['Visits on record', load.visits], ['Prescriptions', load.prescriptions], ['Today', load.today.length]].map(([l, v]) => html`
            <div class="rounded-lg bg-surface-2 p-3"><dt class="text-[12.5px] text-ink-3">${l}</dt><dd class="text-xl font-[650] tabular-nums mt-0.5">${v}</dd></div>`)}
        </dl>
        <div class="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-6 text-[13.5px]">
          <p class="flex items-center gap-2">${icon('phone', 'icon-sm text-ink-3')}${d.phone}</p>
          <p class="flex items-center gap-2 min-w-0">${icon('mail', 'icon-sm text-ink-3')}<span class="truncate">${d.email}</span></p>
        </div>
        <h3 class="font-semibold mb-2">Today’s schedule</h3>
        ${load.today.length
          ? html`<ul class="rounded-lg border border-line divide-y divide-line">${load.today.map((v) => html`
              <li class="flex items-center gap-4 px-4 py-2.5 text-[13.5px]">
                <span class="w-[72px] shrink-0 font-medium tabular-nums">${formatTime(v.time)}</span>
                <span class="flex-1 min-w-0 truncate">${store.patientName(store.patientById(v.patientId))}<span class="text-ink-3"> · ${v.reason}</span></span>
                ${statusBadge(v.status)}
              </li>`)}</ul>`
          : html`<div class="rounded-lg border border-dashed border-line-strong">${emptyState({ iconName: 'calendar', title: 'No appointments today', text: d.availability === 'Available' ? 'This doctor has an open schedule today.' : `This doctor is ${d.availability.toLowerCase()}.` })}</div>`}`,
      footer: html`
        <button type="button" class="btn btn-secondary" data-close>Close</button>
        <button type="button" class="btn btn-primary" data-edit>${icon('pencil', 'icon-sm')}Edit</button>`,
    });
    $('[data-edit]', dialog).addEventListener('click', () => {
      dialog.close();
      openForm(d);
    });
  }

  async function removeDoctor(d) {
    const load = workload(d);
    // Doctors with history can't be deleted — show an explanatory error state.
    if (load.visits || load.prescriptions) {
      const dialog = openModal({
        title: `${d.name} can’t be deleted`,
        size: 'dialog-sm',
        body: html`
          <div class="flex gap-4">
            <div class="grid place-items-center size-10 shrink-0 rounded-full bg-warning-soft text-warning">${icon('alert', 'icon')}</div>
            <p class="text-ink-2">They are linked to ${load.visits} visits and ${load.prescriptions} prescriptions. Mark them as off duty to keep their history while hiding them from today’s roster.</p>
          </div>`,
        footer: html`
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button type="button" class="btn btn-primary" data-off ${d.availability === 'Off duty' ? html`disabled` : ''}>Mark as off duty</button>`,
      });
      $('[data-off]', dialog).addEventListener('click', () => {
        store.update('doctors', d.id, { availability: 'Off duty' });
        toast(`${d.name} is now marked as off duty.`);
        dialog.close();
        renderHeader();
        list.refresh();
      });
      return;
    }
    const ok = await confirmDialog({ title: `Delete ${d.name}?`, message: 'They have no visits or prescriptions on record, so they will be removed from the directory.', confirmLabel: 'Delete doctor' });
    if (!ok) return;
    store.remove('doctors', d.id);
    toast(`${d.name} was deleted.`, { title: 'Doctor deleted' });
    renderHeader();
    list.refresh();
  }

  renderHeader();
  onHashAction('new', () => openForm());
}
