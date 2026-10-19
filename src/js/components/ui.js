/**
 * Reusable UI building blocks. Each returns an html`` template or wires up
 * behaviour on existing markup.
 */
import { $, $$, html, on, raw, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { initials } from '../core/format.js';

/* ---------------------------------------------------------------- Badges */

// One map for every status label used in the app → badge tone.
const STATUS_TONES = {
  Active: 'success', Available: 'success', Completed: 'success', Issued: 'info',
  'Follow-up': 'warning', Waiting: 'warning', Draft: 'warning', 'On leave': 'warning',
  'In consultation': 'info', Scheduled: 'brand',
  Inactive: 'neutral', Archived: 'neutral', 'Off duty': 'neutral',
  Cancelled: 'danger', 'No-show': 'danger',
};

export const statusBadge = (status) => html`<span class="badge badge-${STATUS_TONES[status] ?? 'neutral'}">${status}</span>`;

/* --------------------------------------------------------------- Avatars */

const toneFor = (seed) => [...seed].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 4;

export const avatar = (name, size = '') =>
  html`<span class="avatar ${size}" data-tone="${toneFor(name)}" aria-hidden="true">${initials(name)}</span>`;

/* ----------------------------------------------------------- Empty state */

export const emptyState = ({ iconName = 'search-empty', title, text, action = '' }) => html`
  <div class="empty" role="status">
    <div class="empty-icon">${icon(iconName, 'icon')}</div>
    <p class="empty-title">${title}</p>
    <p class="empty-text">${text}</p>
    ${action ? html`<div class="mt-4">${action}</div>` : ''}
  </div>`;

/* ---------------------------------------------------------------- Toasts */

let toastRegion;

export function toast(message, { tone = 'success', title = '' } = {}) {
  if (!toastRegion) {
    toastRegion = document.createElement('div');
    toastRegion.className = 'toast-region';
    toastRegion.setAttribute('aria-live', 'polite');
    document.body.append(toastRegion);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.tone = tone;
  render(el, html`
    ${icon(tone === 'danger' ? 'alert' : tone === 'info' ? 'info' : 'success', 'icon')}
    <div class="flex-1 min-w-0">
      ${title ? html`<p class="font-semibold">${title}</p>` : ''}
      <p class="${title ? 'opacity-80' : ''}">${message}</p>
    </div>
    <button type="button" class="opacity-70 hover:opacity-100 rounded p-0.5" aria-label="Dismiss notification">${icon('close', 'icon-sm')}</button>`);
  const dismiss = () => el.remove();
  el.querySelector('button').addEventListener('click', dismiss);
  toastRegion.append(el);
  setTimeout(dismiss, 4500);
}

/* --------------------------------------------------------------- Dialogs */

/**
 * Open a modal built on the native <dialog> element (focus trapping, Escape
 * and top-layer stacking come from the browser).
 * Returns the dialog element; `close()` it or click a [data-close] button.
 */
export function openModal({ title, description = '', body, footer = '', size = '', onClose, labelledBy = 'Dialog' }) {
  const dialog = document.createElement('dialog');
  dialog.className = `dialog ${size}`;
  dialog.setAttribute('aria-label', typeof title === 'string' ? title : labelledBy);
  render(dialog, html`
    <div class="dialog-header">
      <div>
        <h2 class="dialog-title">${title}</h2>
        ${description ? html`<p class="text-[13.5px] text-ink-3 mt-1">${description}</p>` : ''}
      </div>
      <button type="button" class="btn btn-ghost btn-icon btn-sm -mr-2 -mt-1" data-close aria-label="Close dialog">${icon('close', 'icon')}</button>
    </div>
    <div class="dialog-body">${body}</div>
    ${footer ? html`<div class="dialog-footer">${footer}</div>` : ''}`);

  document.body.append(dialog);
  on(dialog, 'click', '[data-close]', () => dialog.close());
  // Click on the backdrop (the dialog box itself, outside its content) closes.
  dialog.addEventListener('mousedown', (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    onClose?.();
    dialog.remove();
  });
  dialog.showModal();
  return dialog;
}

/** Promise-based confirmation for destructive actions. */
export function confirmDialog({ title, message, confirmLabel = 'Delete', tone = 'danger' }) {
  return new Promise((resolve) => {
    let confirmed = false;
    const dialog = openModal({
      title,
      size: 'dialog-sm',
      body: html`
        <div class="flex gap-4">
          <div class="grid place-items-center size-10 shrink-0 rounded-full ${tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand'}">${icon(tone === 'danger' ? 'warning' : 'info', 'icon')}</div>
          <p class="text-ink-2 pt-2">${message}</p>
        </div>`,
      footer: html`
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button type="button" class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" data-confirm>${confirmLabel}</button>`,
      onClose: () => resolve(confirmed),
    });
    $('[data-confirm]', dialog).addEventListener('click', () => {
      confirmed = true;
      dialog.close();
    });
    $('[data-close].btn-secondary', dialog).focus();
  });
}

/* ----------------------------------------------------------------- Forms */

let fieldSeq = 0;

/**
 * Render a labelled form field.
 * type: text | email | tel | date | number | select | textarea
 */
export function field({ name, label, type = 'text', value = '', required = false, options = [], placeholder = '', help = '', attrs = '', className = '' }) {
  const id = `f-${name}-${++fieldSeq}`;
  const common = html`id="${id}" name="${name}" ${required ? raw('required') : ''} aria-describedby="${id}-msg"`;
  let control;
  if (type === 'select') {
    control = html`<select class="select" ${common} ${raw(attrs)}>
      ${placeholder ? html`<option value="">${placeholder}</option>` : ''}
      ${options.map((o) => {
        const [val, text] = Array.isArray(o) ? o : [o, o];
        return html`<option value="${val}" ${String(val) === String(value) ? raw('selected') : ''}>${text}</option>`;
      })}
    </select>`;
  } else if (type === 'textarea') {
    control = html`<textarea class="textarea" ${common} placeholder="${placeholder}" ${raw(attrs)}>${value}</textarea>`;
  } else {
    control = html`<input class="input" type="${type}" ${common} value="${value}" placeholder="${placeholder}" ${raw(attrs)}>`;
  }
  return html`
    <div class="${className}">
      <label class="label" for="${id}">${label}${required ? html`<span class="req" aria-hidden="true">*</span>` : ''}</label>
      ${control}
      <p class="help" id="${id}-msg">${help}</p>
    </div>`;
}

/**
 * Validate a form with the browser's constraint API and show messages
 * inline. Optional `extra(form)` returns { fieldName: message } for custom
 * rules. Returns the trimmed form values, or null when invalid.
 */
export function validateForm(form, extra = () => ({})) {
  const custom = extra(form);
  let firstInvalid = null;
  for (const el of form.elements) {
    if (!el.name || el.type === 'button') continue;
    el.setCustomValidity(custom[el.name] ?? '');
    const msg = $(`#${CSS.escape(el.getAttribute('aria-describedby') ?? '')}`, form);
    if (!el.checkValidity()) {
      firstInvalid ??= el;
      el.setAttribute('aria-invalid', 'true');
      if (msg) {
        msg.dataset.help ??= msg.textContent;
        msg.className = 'field-error';
        render(msg, html`${icon('alert', 'icon-xs')}<span>${el.validationMessage}</span>`);
      }
    } else {
      el.removeAttribute('aria-invalid');
      if (msg && msg.dataset.help !== undefined) {
        msg.className = 'help';
        msg.textContent = msg.dataset.help;
      }
    }
  }
  if (firstInvalid) {
    firstInvalid.focus();
    return null;
  }
  return Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
}

/** Re-validate a field as soon as the user fixes it. */
export function liveValidation(form, extra) {
  form.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') validateFieldOnly(form, e.target, extra);
  });
  form.addEventListener('change', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') validateFieldOnly(form, e.target, extra);
  });
}

function validateFieldOnly(form, el, extra = () => ({})) {
  el.setCustomValidity(extra(form)[el.name] ?? '');
  if (el.checkValidity()) {
    el.removeAttribute('aria-invalid');
    const msg = $(`#${CSS.escape(el.getAttribute('aria-describedby'))}`, form);
    if (msg && msg.dataset.help !== undefined) {
      msg.className = 'help';
      msg.textContent = msg.dataset.help;
    }
  }
}

/** Show a spinner on a submit button while `task` runs (simulated latency). */
export async function withBusy(button, task, delay = 350) {
  button.setAttribute('aria-busy', 'true');
  await new Promise((r) => setTimeout(r, delay));
  try {
    return await task();
  } finally {
    button.removeAttribute('aria-busy');
  }
}

/* ------------------------------------------------------------ Dropdowns */

/**
 * Wire every [data-dropdown] trigger inside `root`. The trigger's
 * aria-controls names the menu element. Handles click-outside, Escape and
 * arrow-key navigation.
 */
export function initDropdowns(root = document) {
  const closeAll = (except) => {
    $$('[data-dropdown][aria-expanded="true"]').forEach((t) => {
      if (t !== except) setOpen(t, false);
    });
  };
  const setOpen = (trigger, open) => {
    const menu = document.getElementById(trigger.getAttribute('aria-controls'));
    trigger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    if (open) menu.dispatchEvent(new CustomEvent('menu:open'));
  };

  on(root, 'click', '[data-dropdown]', (e, trigger) => {
    const open = trigger.getAttribute('aria-expanded') !== 'true';
    closeAll(trigger);
    setOpen(trigger, open);
    if (open) $('[role="menuitem"], [role="menuitemradio"]', document.getElementById(trigger.getAttribute('aria-controls')))?.focus();
  });

  // Click outside any menu closes it. Triggers are handled above (both
  // listeners live on document, so stopPropagation can't separate them).
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu, [data-dropdown]')) closeAll();
  });
  document.addEventListener('keydown', (e) => {
    const menu = e.target.closest?.('.menu');
    if (e.key === 'Escape') {
      const trigger = menu && $(`[aria-controls="${menu.id}"]`);
      closeAll();
      trigger?.focus();
    }
    if (menu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const items = $$('[role="menuitem"], [role="menuitemradio"]', menu);
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  });
  return { closeAll };
}

/* -------------------------------------------------------------- Tooltips */

/** Tooltips for any element with [data-tooltip]; shown on hover and focus. */
export function initTooltips() {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);

  const show = (el) => {
    const text = el.dataset.tooltip;
    if (!text || (el.dataset.tooltipWhen === 'collapsed' && document.documentElement.dataset.sidebar !== 'collapsed')) return;
    tip.textContent = text;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const side = el.dataset.tooltipSide ?? 'top';
    if (side === 'right') {
      tip.style.left = `${r.right + 10}px`;
      tip.style.top = `${r.top + r.height / 2 - tip.offsetHeight / 2}px`;
    } else {
      tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
      tip.style.top = `${r.top - tip.offsetHeight - 8}px`;
    }
  };
  const hide = () => (tip.hidden = true);

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tooltip]');
    el ? show(el) : hide();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tooltip]');
    el ? show(el) : hide();
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('scroll', hide, true);
}

/* ----------------------------------------------------------- Page header */

export const pageHeader = ({ title, subtitle = '', actions = '' }) => html`
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
    <div class="min-w-0">
      <h1 class="text-[22px] sm:text-2xl font-[660] leading-tight">${title}</h1>
      ${subtitle ? html`<p class="text-ink-3 mt-1">${subtitle}</p>` : ''}
    </div>
    ${actions ? html`<div class="flex flex-wrap gap-2">${actions}</div>` : ''}
  </div>`;

/** Read `?q=` and `#new` style deep links used by global search + quick actions. */
export const urlQuery = () => new URLSearchParams(location.search).get('q') ?? '';

export function onHashAction(action, handler) {
  const check = () => {
    if (location.hash === `#${action}`) {
      history.replaceState(null, '', location.pathname + location.search);
      handler();
    }
  };
  window.addEventListener('hashchange', check);
  check();
}
