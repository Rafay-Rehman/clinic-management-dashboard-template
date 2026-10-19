/**
 * Reusable data table: search, filters, sorting, pagination, row actions,
 * loading + empty states, and a stacked-card layout on phones.
 *
 * createDataTable(container, {
 *   columns:  [{ key, label, render(row), sortValue?(row), align?, full?, wideOnly? }],
 *             wideOnly: column only shown from 1280px up (details stay in the view dialog)
 *   rows:     () => Array          // called on every refresh
 *   search:   { placeholder, text(row) => string }
 *   filters:  [{ key, label, options: [[value, label]], match(row, value) }]
 *   sort:     { key, dir: 'asc' | 'desc' }
 *   pageSize: 10, pageSizes: [10, 25, 50]
 *   actions:  (row) => html``      // trailing action buttons
 *   empty:    { title, text, action? }
 *   body?:    (rows) => html``     // custom layout instead of a <table>
 *   onAction: (action, id) => void // buttons with data-action + data-id
 * })
 */
import { $, html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { formatNumber } from '../core/format.js';
import { emptyState } from './ui.js';

export function createDataTable(container, options) {
  const { columns = [], search, filters = [], pageSize: initialPageSize = 10, pageSizes = [10, 25, 50], actions, empty, onAction } = options;
  const query = {
    text: options.initialSearch ?? '',
    // Filters can be preset from the URL, e.g. prescriptions.html?status=Draft
    filters: Object.fromEntries(filters.map((f) => {
      const preset = new URLSearchParams(location.search).get(f.key) ?? '';
      return [f.key, f.options.some(([value]) => value === preset) ? preset : ''];
    })),
    sort: options.sort ?? null,
    page: 1,
    pageSize: initialPageSize,
  };

  render(container, html`
    <div class="card overflow-hidden">
      <div class="flex flex-col gap-3 p-4 border-b border-line lg:flex-row lg:items-center">
        ${search ? html`
          <div class="input-icon w-full lg:max-w-xs">
            ${icon('search', 'icon-sm')}
            <input type="search" class="input" data-role="search" placeholder="${search.placeholder}" aria-label="${search.placeholder}" value="${query.text}">
          </div>` : ''}
        <div class="flex flex-wrap items-center gap-2 lg:ml-auto">
          ${filters.map((f) => html`
            <label class="sr-only" for="filter-${f.key}">${f.label}</label>
            <select id="filter-${f.key}" class="select w-auto min-w-[140px] flex-1 sm:flex-none" data-filter="${f.key}">
              <option value="">${f.label}: All</option>
              ${f.options.map(([value, label]) => html`<option value="${value}" ${query.filters[f.key] === value ? html`selected` : ''}>${label}</option>`)}
            </select>`)}
          <button type="button" class="btn btn-ghost btn-sm" data-role="clear" hidden>${icon('close', 'icon-sm')}Clear</button>
        </div>
      </div>
      <div data-role="body" aria-live="polite"></div>
      <div class="flex flex-col-reverse gap-3 items-center justify-between px-4 py-3 border-t border-line sm:flex-row" data-role="footer"></div>
    </div>`);

  const bodyEl = $('[data-role="body"]', container);
  const footerEl = $('[data-role="footer"]', container);
  const clearBtn = $('[data-role="clear"]', container);

  function currentRows() {
    let rows = options.rows();
    const text = query.text.toLowerCase();
    if (text) rows = rows.filter((r) => search.text(r).toLowerCase().includes(text));
    for (const f of filters) {
      const value = query.filters[f.key];
      if (value) rows = rows.filter((r) => f.match(r, value));
    }
    if (query.sort) {
      const col = columns.find((c) => c.key === query.sort.key);
      const get = col.sortValue ?? ((r) => r[col.key]);
      const dir = query.sort.dir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const x = get(a);
        const y = get(b);
        return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
      });
    }
    return rows;
  }

  function renderBody(rows) {
    if (!rows.length) {
      const filtered = query.text || Object.values(query.filters).some(Boolean);
      return filtered
        ? emptyState({
            title: 'No matching records',
            text: 'Try a different search term or clear the filters to see everything.',
            action: html`<button type="button" class="btn btn-secondary btn-sm" data-role="clear-inline">Clear search and filters</button>`,
          })
        : emptyState({ iconName: 'file', ...empty });
    }
    if (options.body) return options.body(rows);
    return html`
      <div class="table-wrap">
        <table class="table table-stack">
          <thead>
            <tr>
              ${columns.map((c) => {
                const active = query.sort?.key === c.key;
                const ariaSort = active ? (query.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                return html`<th scope="col" class="${c.align === 'right' ? 'num' : ''} ${c.wideOnly ? 'max-xl:hidden' : ''}" ${c.sortable ? html`aria-sort="${ariaSort}"` : ''}>
                  ${c.sortable
                    ? html`<button type="button" class="sort-btn" data-sort="${c.key}" ${active ? html`data-active` : ''}>
                        ${c.label}${icon(active ? (query.sort.dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort', 'icon-xs')}
                      </button>`
                    : c.label}
                </th>`;
              })}
              ${actions ? html`<th scope="col" class="num"><span class="sr-only">Actions</span></th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => html`
              <tr>
                ${columns.map((c) => html`<td class="${c.align === 'right' ? 'num' : ''} ${c.full ? 'cell-full' : ''} ${c.wideOnly ? 'max-xl:hidden' : ''}" data-label="${c.label}">${c.render(row)}</td>`)}
                ${actions ? html`<td class="cell-full"><div class="row-actions">${actions(row)}</div></td>` : ''}
              </tr>`)}
          </tbody>
        </table>
      </div>`;
  }

  function pageButtons(page, pages) {
    const list = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p);
      else if (list.at(-1) !== '…') list.push('…');
    }
    return list;
  }

  function refresh() {
    const rows = currentRows();
    const pages = Math.max(1, Math.ceil(rows.length / query.pageSize));
    query.page = Math.min(query.page, pages);
    const start = (query.page - 1) * query.pageSize;
    const visible = rows.slice(start, start + query.pageSize);

    render(bodyEl, renderBody(visible));
    clearBtn.hidden = !(query.text || Object.values(query.filters).some(Boolean));

    render(footerEl, html`
      <p class="text-[13px] text-ink-3">
        ${rows.length ? html`Showing <span class="font-semibold text-ink-2">${formatNumber(start + 1)}–${formatNumber(start + visible.length)}</span> of <span class="font-semibold text-ink-2">${formatNumber(rows.length)}</span>` : 'No results'}
      </p>
      <div class="flex items-center gap-3">
        <label class="hidden md:flex items-center gap-2 text-[13px] text-ink-3">Rows
          <select class="select h-8 w-[72px] text-[13px]" data-role="page-size">
            ${pageSizes.map((n) => html`<option ${n === query.pageSize ? html`selected` : ''}>${n}</option>`)}
          </select>
        </label>
        <nav class="flex items-center gap-1" aria-label="Pagination">
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-page="${query.page - 1}" ${query.page === 1 ? html`disabled` : ''} aria-label="Previous page">${icon('chevron-left', 'icon-sm')}</button>
          ${pageButtons(query.page, pages).map((p) =>
            p === '…'
              ? html`<span class="w-6 text-center text-ink-3" aria-hidden="true">…</span>`
              : html`<button type="button" class="btn btn-sm min-w-8 px-2 ${p === query.page ? 'btn-secondary' : 'btn-ghost'}" data-page="${p}" ${p === query.page ? html`aria-current="page"` : ''} aria-label="Page ${p}">${p}</button>`,
          )}
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-page="${query.page + 1}" ${query.page === pages ? html`disabled` : ''} aria-label="Next page">${icon('chevron-right', 'icon-sm')}</button>
        </nav>
      </div>`);
  }

  const clear = () => {
    query.text = '';
    Object.keys(query.filters).forEach((k) => (query.filters[k] = ''));
    const input = $('[data-role="search"]', container);
    if (input) input.value = '';
    container.querySelectorAll('[data-filter]').forEach((s) => (s.value = ''));
    query.page = 1;
    refresh();
  };

  on(container, 'input', '[data-role="search"]', (e) => {
    query.text = e.target.value.trim();
    query.page = 1;
    refresh();
  });
  on(container, 'change', '[data-filter]', (e, el) => {
    query.filters[el.dataset.filter] = el.value;
    query.page = 1;
    refresh();
  });
  on(container, 'change', '[data-role="page-size"]', (e) => {
    query.pageSize = Number(e.target.value);
    query.page = 1;
    refresh();
  });
  on(container, 'click', '[data-role="clear"], [data-role="clear-inline"]', clear);
  on(container, 'click', '[data-page]', (e, el) => {
    query.page = Number(el.dataset.page);
    refresh();
    container.scrollIntoView({ block: 'nearest' });
  });
  on(container, 'click', '[data-sort]', (e, el) => {
    const key = el.dataset.sort;
    query.sort = { key, dir: query.sort?.key === key && query.sort.dir === 'asc' ? 'desc' : 'asc' };
    refresh();
    $(`[data-sort="${key}"]`, container)?.focus();
  });
  on(container, 'click', '[data-action]', (e, el) => onAction?.(el.dataset.action, el.dataset.id, el));

  // Brief skeleton on first paint — mirrors what a real fetch would show.
  render(bodyEl, html`<div class="p-4 space-y-3" aria-label="Loading">${Array.from({ length: 6 }, () => html`<div class="skeleton h-9"></div>`)}</div>`);
  setTimeout(refresh, 250);

  return { refresh };
}

/** Standard view / edit / delete buttons for a row. */
export const rowActionButtons = (id, { view = true, edit = true, remove = true, label = 'record' } = {}) => html`
  ${view ? html`<button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="view" data-id="${id}" aria-label="View ${label}" data-tooltip="View">${icon('eye', 'icon-sm')}</button>` : ''}
  ${edit ? html`<button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${id}" aria-label="Edit ${label}" data-tooltip="Edit">${icon('pencil', 'icon-sm')}</button>` : ''}
  ${remove ? html`<button type="button" class="btn btn-ghost btn-icon btn-sm hover:!text-danger" data-action="delete" data-id="${id}" aria-label="Delete ${label}" data-tooltip="Delete">${icon('trash', 'icon-sm')}</button>` : ''}`;
