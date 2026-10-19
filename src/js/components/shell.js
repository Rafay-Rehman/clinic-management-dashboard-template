/**
 * App shell: sidebar (collapsible on desktop, drawer on mobile), top bar
 * with breadcrumb, global search, quick actions, notifications and the
 * profile / theme menu. Pages render into <main id="page">.
 */
import { $, $$, html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { app, currentUser, findNavItem, navigation } from '../config/navigation.js';
import * as store from '../core/store.js';
import { addDays, todayKey } from '../core/format.js';
import { avatar, confirmDialog, initDropdowns, initTooltips, openModal, toast } from './ui.js';

const prefs = {
  get: (key, fallback) => {
    try {
      return localStorage.getItem(`pinewell-${key}`) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(`pinewell-${key}`, value);
    } catch {
      /* storage unavailable — preference lasts for this page only */
    }
  },
};

/* ------------------------------------------------------------------ Theme */

const media = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(choice) {
  const dark = choice === 'dark' || (choice === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/* -------------------------------------------------------------- Templates */

const sidebarTemplate = (pageId) => html`
  <aside id="sidebar" class="sidebar" aria-label="Main navigation">
    <div class="sidebar-brand">
      <span class="brand-mark">${icon('clinic', 'icon')}</span>
      <div class="collapsible-label min-w-0 leading-tight">
        <p class="text-white font-[650] text-[15px]">${app.name}</p>
        <p class="text-[12.5px] opacity-80">${app.tagline}</p>
      </div>
      <button type="button" class="drawer-close btn btn-icon btn-sm ml-auto text-white hover:bg-white/10" data-drawer-close aria-label="Close navigation">${icon('close', 'icon')}</button>
    </div>
    <nav class="sidebar-nav">
      ${navigation.map((group) => {
        const expanded = prefs.get(`nav-${group.id}`, 'open') === 'open';
        return html`
          <div class="mb-2">
            <button type="button" class="nav-group-toggle" aria-expanded="${expanded}" aria-controls="nav-${group.id}" data-nav-group="${group.id}">
              ${icon(group.icon, 'icon')}<span>${group.label}</span>${icon('chevron-down', 'icon-sm chev')}
            </button>
            <div class="nav-items" id="nav-${group.id}" ${expanded ? '' : html`data-collapsed`}>
              <ul>
                ${group.items.map((item) => html`
                  <li>
                    <a class="nav-link" href="${item.href}" ${item.id === pageId ? html`aria-current="page"` : ''}
                       data-tooltip="${item.label}" data-tooltip-side="right" data-tooltip-when="collapsed">
                      ${icon(item.icon, 'icon')}<span class="collapsible-label">${item.label}</span>
                    </a>
                  </li>`)}
              </ul>
            </div>
          </div>`;
      })}
    </nav>
    <div class="sidebar-foot space-y-2">
      <div class="demo-note">${icon('info', 'icon-sm')}<p>Demo template. Every record shown is fictional.</p></div>
      <button type="button" class="sidebar-collapse-btn nav-link w-full" data-sidebar-toggle aria-label="Collapse sidebar" data-tooltip="Expand sidebar" data-tooltip-side="right" data-tooltip-when="collapsed">
        ${icon('panel-close', 'icon')}<span class="collapsible-label">Collapse sidebar</span>
      </button>
    </div>
  </aside>
  <div class="drawer-backdrop" data-drawer-close hidden></div>`;

const topbarTemplate = (item) => html`
  <header class="topbar">
    <button type="button" class="btn btn-ghost btn-icon lg:hidden -ml-2" data-drawer-open aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu', 'icon')}</button>

    <nav aria-label="Breadcrumb" class="min-w-0">
      <ol class="flex items-center gap-1.5 text-[13.5px]">
        <li class="hidden sm:block text-ink-3">Clinic</li>
        <li class="hidden sm:block text-ink-3" aria-hidden="true">${icon('chevron-right', 'icon-xs')}</li>
        <li class="font-semibold truncate" aria-current="page">${item.label}</li>
      </ol>
    </nav>

    <div class="relative ml-auto md:ml-6 md:flex-1 md:max-w-md" data-search>
      <button type="button" class="btn btn-ghost btn-icon md:hidden" data-search-open aria-label="Search">${icon('search', 'icon')}</button>
      <div class="hidden md:block max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-50 max-md:p-3 max-md:bg-surface max-md:border-b max-md:border-line" data-search-panel>
        <div class="flex gap-2">
          <div class="input-icon flex-1">
            ${icon('search', 'icon-sm')}
            <input type="search" class="input bg-surface pr-10" placeholder="Search patients, doctors, prescriptions…" aria-label="Search the clinic"
                   autocomplete="off" role="combobox" aria-expanded="false" aria-controls="search-results" aria-autocomplete="list" data-search-input>
            <kbd class="hidden md:grid absolute right-2.5 top-1/2 -translate-y-1/2 place-items-center size-5 rounded border border-line text-[11px] text-ink-3 font-sans" aria-hidden="true">/</kbd>
          </div>
          <button type="button" class="btn btn-ghost md:hidden" data-search-close>Cancel</button>
        </div>
        <div id="search-results" class="menu left-0 right-0 md:mt-2 max-h-[70vh] overflow-y-auto max-md:inset-x-3 max-md:top-[60px] max-md:fixed" hidden></div>
      </div>
    </div>

    <div class="flex items-center gap-1 md:gap-2 md:ml-auto">
      <div class="relative">
        <button type="button" class="btn btn-primary max-sm:px-2.5" data-dropdown aria-controls="quick-menu" aria-expanded="false" aria-haspopup="menu">
          ${icon('plus', 'icon')}<span class="hidden sm:inline">New</span>
        </button>
        <div id="quick-menu" class="menu right-0 mt-2 w-56" role="menu" hidden>
          <a role="menuitem" class="menu-item" href="patients.html#new">${icon('user-plus', 'icon-sm')}New patient</a>
          <a role="menuitem" class="menu-item" href="prescriptions.html#new">${icon('pill', 'icon-sm')}New prescription</a>
          <a role="menuitem" class="menu-item" href="doctors.html#new">${icon('stethoscope', 'icon-sm')}Add doctor</a>
          <a role="menuitem" class="menu-item" href="diseases.html#new">${icon('microscope', 'icon-sm')}Add disease</a>
        </div>
      </div>

      <div class="relative">
        <button type="button" class="btn btn-ghost btn-icon relative" data-dropdown aria-controls="notif-menu" aria-expanded="false" aria-haspopup="true" aria-label="Notifications" data-notif-btn>
          ${icon('bell', 'icon')}<span class="absolute top-2 right-2 size-2 rounded-full bg-danger ring-2 ring-canvas" data-notif-dot hidden></span>
        </button>
        <div id="notif-menu" class="menu right-0 mt-2 w-[min(360px,calc(100vw-24px))] max-sm:fixed max-sm:right-3 max-sm:top-[60px] p-0" hidden></div>
      </div>

      <div class="relative">
        <button type="button" class="flex items-center gap-2.5 rounded-full md:rounded-lg md:pl-1 md:pr-2 py-1 hover:bg-surface-2" data-dropdown aria-controls="profile-menu" aria-expanded="false" aria-haspopup="menu" aria-label="Account menu">
          ${avatar(currentUser.name, 'avatar-sm')}
          <span class="hidden xl:block text-left leading-tight">
            <span class="block text-[13.5px] font-semibold">${currentUser.name}</span>
            <span class="block text-[12px] text-ink-3">${currentUser.role}</span>
          </span>
          ${icon('chevron-down', 'icon-sm hidden xl:block text-ink-3')}
        </button>
        <div id="profile-menu" class="menu right-0 mt-2 w-64" role="menu" hidden>
          <div class="px-2.5 py-2">
            <p class="font-semibold">${currentUser.name}</p>
            <p class="text-[13px] text-ink-3 truncate">${currentUser.email}</p>
          </div>
          <div class="menu-sep"></div>
          <p class="menu-label">Theme</p>
          ${[['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'Match system', 'monitor']].map(([value, label, ic]) => html`
            <button type="button" role="menuitemradio" class="menu-item" data-theme-choice="${value}" aria-checked="false">${icon(ic, 'icon-sm')}${label}</button>`)}
          <div class="menu-sep"></div>
          <button type="button" role="menuitem" class="menu-item" data-reset-demo>${icon('reset', 'icon-sm')}Reset demo data</button>
          <button type="button" role="menuitem" class="menu-item" data-about>${icon('info', 'icon-sm')}About this template</button>
        </div>
      </div>
    </div>
  </header>`;

/* ---------------------------------------------------------- Notifications */

function buildNotifications() {
  const today = todayKey();
  const visits = store.todaysVisits();
  const waiting = visits.filter((v) => v.status === 'Waiting').length;
  const drafts = store.list('prescriptions').filter((p) => p.status === 'Draft').length;
  const onLeave = store.list('doctors').filter((d) => d.availability === 'On leave');
  const newPatients = store.list('patients').filter((p) => p.registeredOn > addDays(today, -7)).length;
  return [
    waiting && { id: `waiting-${today}-${waiting}`, icon: 'waiting', title: `${waiting} ${waiting === 1 ? 'patient is' : 'patients are'} waiting`, text: 'Checked in and ready to be called.', href: 'patient-desk.html' },
    drafts && { id: `drafts-${today}-${drafts}`, icon: 'pill', title: `${drafts} prescription ${drafts === 1 ? 'draft needs' : 'drafts need'} review`, text: 'Issue or cancel them before end of day.', href: 'prescriptions.html?status=Draft' },
    ...onLeave.map((d) => ({ id: `leave-${today}-${d.id}`, icon: 'stethoscope', title: `${d.name} is on leave`, text: 'Appointments are hidden from today’s queue.', href: `doctors.html?q=${encodeURIComponent(d.name)}` })),
    newPatients && { id: `new-${today}-${newPatients}`, icon: 'user-plus', title: `${newPatients} new patients this week`, text: 'Registered in the last 7 days.', href: 'reports.html' },
  ].filter(Boolean);
}

function renderNotifications(menu, dot) {
  let read;
  try {
    read = new Set(JSON.parse(localStorage.getItem('pinewell-read-notifications') ?? '[]'));
  } catch {
    read = new Set();
  }
  const items = buildNotifications();
  const unread = items.filter((n) => !read.has(n.id));
  dot.hidden = unread.length === 0;
  $('[data-notif-btn]').setAttribute('aria-label', unread.length ? `Notifications, ${unread.length} unread` : 'Notifications');

  render(menu, html`
    <div class="flex items-center justify-between px-4 py-3 border-b border-line">
      <p class="font-semibold">Notifications</p>
      ${unread.length ? html`<button type="button" class="text-[13px] font-semibold text-brand hover:underline" data-mark-read>Mark all as read</button>` : ''}
    </div>
    ${items.length
      ? html`<ul class="p-1.5">${items.map((n) => html`
          <li>
            <a href="${n.href}" role="menuitem" class="menu-item items-start gap-3 py-2.5">
              <span class="grid place-items-center size-8 rounded-lg ${read.has(n.id) ? 'bg-surface-2 text-ink-3' : 'bg-brand-soft text-brand'} shrink-0">${icon(n.icon, 'icon-sm')}</span>
              <span class="min-w-0 flex-1">
                <span class="block ${read.has(n.id) ? '' : 'font-semibold'}">${n.title}</span>
                <span class="block text-[13px] text-ink-3">${n.text}</span>
              </span>
              ${read.has(n.id) ? '' : html`<span class="mt-2 size-2 rounded-full bg-brand shrink-0" aria-label="Unread"></span>`}
            </a>
          </li>`)}</ul>`
      : html`<p class="px-4 py-8 text-center text-ink-3">You’re all caught up.</p>`}`);

  $('[data-mark-read]', menu)?.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      localStorage.setItem('pinewell-read-notifications', JSON.stringify(items.map((n) => n.id)));
    } catch {
      items.forEach((n) => read.add(n.id));
    }
    renderNotifications(menu, dot);
    $('[data-notif-btn]').focus();
  });
}

/* ---------------------------------------------------------------- Search */

function searchResults(term) {
  const t = term.toLowerCase();
  const take = (arr) => arr.slice(0, 4);
  return [
    { label: 'Patients', items: take(store.list('patients').filter((p) => `${store.patientName(p)} ${p.id}`.toLowerCase().includes(t))).map((p) => ({ title: store.patientName(p), meta: p.id, href: `patients.html?q=${encodeURIComponent(p.id)}`, icon: 'users' })) },
    { label: 'Doctors', items: take(store.list('doctors').filter((d) => `${d.name} ${d.specialty}`.toLowerCase().includes(t))).map((d) => ({ title: d.name, meta: d.specialty, href: `doctors.html?q=${encodeURIComponent(d.name)}`, icon: 'stethoscope' })) },
    { label: 'Prescriptions', items: take(store.list('prescriptions').filter((p) => p.id.toLowerCase().includes(t))).map((p) => ({ title: p.id, meta: store.patientName(store.patientById(p.patientId)), href: `prescriptions.html?q=${encodeURIComponent(p.id)}`, icon: 'pill' })) },
    { label: 'Diseases', items: take(store.list('diseases').filter((d) => `${d.name} ${d.code}`.toLowerCase().includes(t))).map((d) => ({ title: d.name, meta: d.code, href: `diseases.html?q=${encodeURIComponent(d.name)}`, icon: 'microscope' })) },
  ].filter((g) => g.items.length);
}

function initSearch() {
  const input = $('[data-search-input]');
  const results = $('#search-results');
  const panel = $('[data-search-panel]');
  const show = (open) => {
    results.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
  };

  input.addEventListener('input', () => {
    const term = input.value.trim();
    if (term.length < 2) return show(false);
    const groups = searchResults(term);
    render(results, groups.length
      ? html`${groups.map((g) => html`
          <p class="menu-label">${g.label}</p>
          ${g.items.map((r) => html`<a class="menu-item" href="${r.href}" data-search-result>${icon(r.icon, 'icon-sm')}<span class="truncate">${r.title}</span><span class="ml-auto text-[12.5px] text-ink-3 shrink-0">${r.meta}</span></a>`)}`)}`
      : html`<p class="px-3 py-6 text-center text-ink-3">No results for “${term}”.</p>`);
    show(true);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      $('[data-search-result]', results)?.focus();
    }
    if (e.key === 'Enter') $('[data-search-result]', results)?.click();
  });
  results.addEventListener('keydown', (e) => {
    const items = $$('[data-search-result]', results);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = i + (e.key === 'ArrowDown' ? 1 : -1);
      next < 0 ? input.focus() : items[Math.min(next, items.length - 1)].focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-search]')) show(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !results.hidden) {
      show(false);
      input.focus();
    }
    if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable]') && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      openMobileSearch();
    }
  });

  const openMobileSearch = () => {
    panel.classList.remove('hidden');
    input.focus();
  };
  $('[data-search-open]').addEventListener('click', openMobileSearch);
  $('[data-search-close]').addEventListener('click', () => {
    panel.classList.add('hidden');
    show(false);
  });
}

/* ---------------------------------------------------------------- Drawer */

function initSidebar() {
  const sidebar = $('#sidebar');
  const backdrop = $('.drawer-backdrop');
  const mainCol = $('.main-col');
  const openBtn = $('[data-drawer-open]');
  const desktop = window.matchMedia('(min-width: 1024px)');

  const setDrawer = (open) => {
    sidebar.toggleAttribute('data-open', open);
    backdrop.hidden = !open;
    openBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    mainCol.inert = open;
    if (open) $('[data-drawer-close]', sidebar).focus();
    else if (!desktop.matches) openBtn.focus();
  };

  openBtn.addEventListener('click', () => setDrawer(true));
  on(document, 'click', '[data-drawer-close]', () => setDrawer(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.hasAttribute('data-open')) setDrawer(false);
  });
  desktop.addEventListener('change', () => sidebar.hasAttribute('data-open') && setDrawer(false));
  // Keep the drawer off the tab order while it is closed on small screens.
  const syncInert = () => (sidebar.inert = !desktop.matches && !sidebar.hasAttribute('data-open'));
  new MutationObserver(syncInert).observe(sidebar, { attributes: true, attributeFilter: ['data-open'] });
  desktop.addEventListener('change', syncInert);
  syncInert();

  // Desktop collapse
  const toggle = $('[data-sidebar-toggle]');
  const syncToggle = () => {
    const collapsed = document.documentElement.dataset.sidebar === 'collapsed';
    toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    render(toggle, html`${icon(collapsed ? 'panel-open' : 'panel-close', 'icon')}<span class="collapsible-label">Collapse sidebar</span>`);
  };
  toggle.addEventListener('click', () => {
    const collapsed = document.documentElement.dataset.sidebar !== 'collapsed';
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    prefs.set('sidebar', collapsed ? 'collapsed' : 'expanded');
    syncToggle();
  });
  syncToggle();

  // Nav groups
  on(sidebar, 'click', '[data-nav-group]', (e, btn) => {
    const expanded = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(expanded));
    document.getElementById(btn.getAttribute('aria-controls')).toggleAttribute('data-collapsed', !expanded);
    prefs.set(`nav-${btn.dataset.navGroup}`, expanded ? 'open' : 'closed');
  });
}

/* ------------------------------------------------------------------ Mount */

export function mountShell(pageId) {
  const item = findNavItem(pageId);
  document.title = `${item.label} | ${app.name} Clinic`;

  const root = document.getElementById('app');
  render(root, html`
    ${sidebarTemplate(pageId)}
    <div class="main-col">
      ${topbarTemplate(item)}
      <main id="page" class="page" tabindex="-1"></main>
    </div>`);

  initSidebar();
  initSearch();
  initDropdowns();
  initTooltips();

  // Theme menu
  const syncTheme = () => {
    const choice = prefs.get('theme', 'light');
    applyTheme(choice);
    $$('[data-theme-choice]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeChoice === choice)));
  };
  on(document, 'click', '[data-theme-choice]', (e, btn) => {
    prefs.set('theme', btn.dataset.themeChoice);
    syncTheme();
    document.dispatchEvent(new CustomEvent('themechange'));
  });
  media.addEventListener('change', syncTheme);
  syncTheme();

  // Notifications
  const notifMenu = $('#notif-menu');
  const notifDot = $('[data-notif-dot]');
  renderNotifications(notifMenu, notifDot);
  notifMenu.addEventListener('menu:open', () => renderNotifications(notifMenu, notifDot));
  document.addEventListener('store:change', () => renderNotifications(notifMenu, notifDot));

  // Profile actions
  on(document, 'click', '[data-reset-demo]', async () => {
    const ok = await confirmDialog({
      title: 'Reset demo data?',
      message: 'All patients, doctors, diseases and prescriptions return to the original sample set. Your changes in this browser will be lost.',
      confirmLabel: 'Reset data',
    });
    if (ok) {
      store.resetDemoData();
      toast('Demo data has been reset.');
      setTimeout(() => location.reload(), 600);
    }
  });
  on(document, 'click', '[data-about]', () => {
    openModal({
      title: 'About this template',
      body: html`
        <div class="space-y-3 text-ink-2">
          <p>${app.name} is a front-end template for clinic administration screens. It runs entirely in the browser using generated sample data.</p>
          <p>All patients, doctors, medications and records are fictional. The prescription screens are a UI demonstration, not a validated prescribing or clinical decision-support system.</p>
          <p>Before handling real health information you will need a secure backend, authentication, access control, audit logging and the legal and compliance work your region requires.</p>
        </div>`,
      footer: html`<button type="button" class="btn btn-primary" data-close>Got it</button>`,
    });
  });

  return $('#page');
}
