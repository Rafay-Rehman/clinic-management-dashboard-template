import { test, expect } from '@playwright/test';
import { PAGES, noHorizontalOverflow, open } from './helpers.js';

test.describe('navigation and shell', () => {
  for (const id of PAGES) {
    test(`${id} renders without errors or overflow`, async ({ page }) => {
      const errors = await open(page, `${id}.html`);
      await expect(page.locator(`.nav-link[aria-current="page"]`)).toHaveAttribute('href', `${id}.html`);
      await expect(page.locator('h1')).toBeVisible();
      expect(await noHorizontalOverflow(page)).toBe(true);
      expect(errors).toEqual([]);
    });
  }

  test('sidebar links reach every page', async ({ page }) => {
    await open(page, 'patient-desk.html');
    for (const label of ['Patients', 'Diseases', 'Doctors', 'Prescriptions', 'Reports', 'Patient Desk']) {
      await page.locator('.nav-link', { hasText: label }).click();
      await expect(page.locator('.topbar [aria-current="page"]')).toHaveText(label);
    }
  });

  test('sidebar collapses to icons with tooltips and remembers it', async ({ page }) => {
    await open(page, 'patients.html');
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
    expect(await page.locator('#sidebar').evaluate((el) => el.offsetWidth)).toBeLessThan(90);
    await page.locator('.nav-link', { hasText: 'Doctors' }).hover();
    await expect(page.locator('.tooltip')).toHaveText('Doctors');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'expanded');
  });

  test('nav group collapses and expands', async ({ page }) => {
    await open(page, 'patients.html');
    const group = page.locator('[data-nav-group="clinic"]');
    await group.click();
    await expect(group).toHaveAttribute('aria-expanded', 'false');
    await group.click();
    await expect(group).toHaveAttribute('aria-expanded', 'true');
  });

  test('notifications open, mark as read and close with Escape', async ({ page }) => {
    await open(page, 'patient-desk.html');
    await page.locator('[data-notif-btn]').click();
    const menu = page.locator('#notif-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(page.locator('[data-notif-dot]')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('global search finds a patient and opens their record', async ({ page }) => {
    await open(page, 'reports.html');
    await page.keyboard.press('/');
    await page.locator('[data-search-input]').fill('PT-10004');
    await page.locator('[data-search-result]').first().click();
    await expect(page).toHaveURL(/patients\.html\?q=PT-10004/);
    await expect(page.locator('dialog[open]')).toContainText('PT-10004');
  });

  test('theme switches to dark and persists', async ({ page }) => {
    await open(page, 'patient-desk.html');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('quick action opens the create form on another page', async ({ page }) => {
    await open(page, 'patient-desk.html');
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('menuitem', { name: 'Add doctor' }).click();
    await expect(page.locator('dialog[open] .dialog-title')).toHaveText('Add doctor');
  });
});

test.describe('patient desk', () => {
  test('queue advances a waiting or scheduled patient', async ({ page }) => {
    await open(page, 'patient-desk.html');
    const checkIn = page.locator('[data-advance]').filter({ hasText: 'Check in' }).first();
    const name = (await checkIn.getAttribute('aria-label')).replace('Check in: ', '');
    await checkIn.click();
    await expect(page.locator('.toast')).toContainText(`${name} checked in`);
    await page.locator('[data-queue-filter="waiting"]').click();
    await expect(page.locator('[data-queue]')).toContainText(name);
  });

  test('chart responds to keyboard', async ({ page }) => {
    await open(page, 'patient-desk.html');
    const chart = page.locator('[data-visits-chart]');
    await chart.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(chart.locator('.chart-tip')).toBeVisible();
  });
});

test.describe('patients CRUD', () => {
  test('validates, creates, edits and deletes a patient', async ({ page }) => {
    await open(page, 'patients.html');
    await page.getByRole('button', { name: 'Add patient' }).first().click();
    const dialog = page.locator('dialog[open]');
    await dialog.getByRole('button', { name: 'Add patient' }).click();
    await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(5); // first, last, date of birth, gender, phone

    await dialog.getByLabel('First name').fill('Testa');
    await dialog.getByLabel('Last name').fill('Example');
    await dialog.getByLabel('Date of birth').fill('1990-04-12');
    await dialog.getByLabel('Gender').selectOption('Female');
    await dialog.getByLabel('Phone').fill('+1 555-0199');
    await dialog.getByRole('button', { name: 'Add patient' }).click();
    await expect(page.locator('.toast')).toContainText('Testa Example was registered');

    const search = page.getByPlaceholder('Search by name or patient ID');
    await search.fill('Testa Example');
    await expect(page.locator('tbody tr')).toHaveCount(1);

    await page.getByRole('button', { name: 'Edit Testa Example' }).click();
    await page.locator('dialog[open]').getByLabel('Last name').fill('Sample');
    await page.locator('dialog[open]').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await search.fill('Testa Sample');
    await expect(page.locator('tbody tr')).toHaveCount(1);

    await page.getByRole('button', { name: 'Delete Testa Sample' }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Delete patient' }).click();
    await expect(page.locator('.empty-title')).toHaveText('No matching records');
  });

  test('filters, sorting and pagination work', async ({ page }) => {
    await open(page, 'patients.html');
    await page.locator('[data-filter="status"]').selectOption('Inactive');
    await expect(page.locator('tbody .badge')).not.toHaveCount(0);
    for (const text of await page.locator('tbody .badge').allTextContents()) expect(text).toBe('Inactive');
    await page.getByRole('button', { name: 'Clear' }).first().click();

    await page.locator('[data-sort="name"]').click();
    const names = await page.locator('tbody tr td:first-child button').allTextContents();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

    await page.getByRole('button', { name: 'Page 2' }).click();
    await expect(page.locator('[data-role="footer"]')).toContainText('Showing 11–20');
  });

  test('modal closes with Escape and returns focus', async ({ page }) => {
    await open(page, 'patients.html');
    const button = page.locator('[data-new]').first();
    await button.click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(button).toBeFocused();
  });
});

test.describe('other entities', () => {
  test('disease code must be unique', async ({ page }) => {
    await open(page, 'diseases.html');
    await page.getByRole('button', { name: 'Add disease' }).click();
    const dialog = page.locator('dialog[open]');
    await dialog.getByLabel('Disease name').fill('Test condition');
    await dialog.getByLabel('Code').fill('I10');
    await dialog.getByLabel('Category').selectOption('Cardiovascular');
    await dialog.getByLabel('Usual specialty').selectOption('Cardiology');
    await dialog.getByRole('button', { name: 'Add disease' }).click();
    await expect(dialog.locator('.field-error')).toContainText('already used');
    await dialog.getByLabel('Code').fill('Z99.1');
    await dialog.getByRole('button', { name: 'Add disease' }).click();
    await expect(page.locator('.toast')).toContainText('Test condition was added');
  });

  test('doctor with history cannot be deleted', async ({ page }) => {
    await open(page, 'doctors.html');
    await page.getByRole('button', { name: /^Delete Dr\./ }).first().click();
    await expect(page.locator('dialog[open]')).toContainText('can’t be deleted');
    await page.locator('dialog[open]').getByRole('button', { name: 'Mark as off duty' }).click();
    await expect(page.locator('.toast')).toContainText('off duty');
  });

  test('doctor filter by specialty', async ({ page }) => {
    await open(page, 'doctors.html');
    await page.locator('[data-filter="specialty"]').selectOption('Pediatrics');
    await expect(page.locator('article')).toHaveCount(2);
  });

  test('creates and issues a prescription, then completes it', async ({ page }) => {
    await open(page, 'prescriptions.html');
    await page.getByRole('button', { name: 'New prescription' }).click();
    const dialog = page.locator('dialog[open]');
    await dialog.getByRole('button', { name: 'Issue prescription' }).click();
    await expect(dialog.locator('[aria-invalid="true"]').first()).toBeVisible();

    await dialog.getByRole('combobox', { name: 'Patient' }).fill('PT-10004');
    await dialog.getByLabel('Prescribing doctor').selectOption({ index: 1 });
    await dialog.getByLabel('Medication').fill('Velmora 500 mg tablet');
    await dialog.getByLabel('Dosage').fill('1 tablet');
    await dialog.getByLabel('Frequency').selectOption('Twice daily');
    await dialog.getByLabel('Duration').selectOption('7 days');
    await dialog.getByRole('button', { name: 'Add medication' }).click();
    await expect(dialog.locator('[data-item]')).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Remove medication' }).last().click();
    await dialog.getByRole('button', { name: 'Issue prescription' }).click();
    const toast = page.locator('.toast').first();
    await expect(toast).toContainText('was issued');
    const id = (await toast.textContent()).match(/RX-\d+/)[0];

    await page.getByPlaceholder('Search by prescription ID or patient').fill(id);
    await page.getByRole('button', { name: `View ${id}` }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Mark as completed' }).click();
    await expect(page.locator('tbody .badge')).toHaveText('Completed');
  });

  test('prescription print layout renders the sheet', async ({ page }) => {
    await open(page, 'prescriptions.html');
    await page.evaluate(() => (window.print = () => {}));
    await page.locator('[data-action="print"]').first().click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-sheet')).toBeVisible();
    await expect(page.locator('.print-sheet')).toContainText('Not a valid prescription');
    await expect(page.locator('#app')).toBeHidden();
  });

  test('status filter can be preset from the URL', async ({ page }) => {
    await open(page, 'prescriptions.html?status=Draft');
    await expect(page.locator('[data-filter="status"]')).toHaveValue('Draft');
    for (const t of await page.locator('tbody .badge').allTextContents()) expect(t).toBe('Draft');
  });
});

test.describe('reports', () => {
  test('date range presets, validation and CSV export', async ({ page }) => {
    await open(page, 'reports.html');
    await page.getByRole('button', { name: '7 days' }).click();
    await expect(page.locator('#trend-title + p')).toContainText('Daily totals');
    await page.getByRole('button', { name: '6 months' }).click();
    await expect(page.locator('#trend-title + p')).toContainText('Weekly totals');

    await page.locator('#range-from').fill('2026-10-10');
    await page.locator('#range-to').fill('2026-10-01');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('[data-range-msg]')).toContainText('start date must be on or before');

    await page.getByRole('button', { name: '30 days' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^clinic-report_.*\.csv$/);
    const csv = await (await file.createReadStream()).toArray();
    expect(Buffer.concat(csv).toString()).toContain('"Doctor","Specialty","Visits"');
  });

  test('report totals agree with the dataset', async ({ page }) => {
    await open(page, 'reports.html');
    const tableVisits = (await page.locator('tbody td[data-label="Visits"]').allTextContents()).reduce((s, t) => s + Number(t.replace(/,/g, '')), 0);
    const attendedText = await page.locator('#trend-title').locator('xpath=../..').textContent();
    const kpi = Number((await page.locator('.kpi-value').first().textContent()).replace(/,/g, ''));
    // Completed visits across doctors ≤ all non-cancelled visits.
    expect(tableVisits).toBeLessThanOrEqual(kpi);
    expect(attendedText).toMatch(/\d+% attended/);
  });
});
