/**
 * Entry point for every page. The <body data-page="…"> attribute picks the
 * page module; each module is code-split and loaded on demand.
 */
import { mountShell } from './components/shell.js';
import { html, render } from './core/dom.js';
import { emptyState } from './components/ui.js';

const pages = {
  'patient-desk': () => import('./pages/patient-desk.js'),
  patients: () => import('./pages/patients.js'),
  diseases: () => import('./pages/diseases.js'),
  doctors: () => import('./pages/doctors.js'),
  prescriptions: () => import('./pages/prescriptions.js'),
  reports: () => import('./pages/reports.js'),
};

const pageId = document.body.dataset.page;
const main = mountShell(pageId);

try {
  const page = await pages[pageId]();
  page.default(main);
} catch (error) {
  console.error(error);
  render(main, html`<div class="card">${emptyState({
    iconName: 'alert',
    title: 'This page could not be loaded',
    text: 'Something went wrong while preparing this screen. Reload the page to try again.',
    action: html`<button type="button" class="btn btn-secondary" data-reload>Reload page</button>`,
  })}</div>`);
  main.querySelector('[data-reload]').addEventListener('click', () => location.reload());
}
