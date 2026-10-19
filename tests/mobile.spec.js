import { test, expect } from '@playwright/test';
import { PAGES, noHorizontalOverflow, open } from './helpers.js';

for (const id of PAGES) {
  test(`${id} fits a phone screen`, async ({ page }) => {
    const errors = await open(page, `${id}.html`);
    await expect(page.locator('#sidebar')).not.toBeInViewport();
    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('drawer opens and closes via button, backdrop and Escape', async ({ page }) => {
  await open(page, 'patients.html');
  const toggle = page.getByRole('button', { name: 'Open navigation' });

  await toggle.click();
  await expect(page.locator('#sidebar')).toBeInViewport();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await expect(page.locator('#sidebar')).not.toBeInViewport();

  await toggle.click();
  await page.locator('.drawer-backdrop').click({ position: { x: 370, y: 400 } });
  await expect(page.locator('#sidebar')).not.toBeInViewport();

  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sidebar')).not.toBeInViewport();
  await expect(toggle).toBeFocused();

  await toggle.click();
  await page.locator('.nav-link', { hasText: 'Reports' }).click();
  await expect(page).toHaveURL(/reports\.html/);
});

test('tables stack into cards and search opens full width', async ({ page }) => {
  await open(page, 'patients.html');
  await expect(page.locator('thead')).toBeHidden();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('[data-search-input]')).toBeFocused();
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('dialogs become bottom sheets', async ({ page }) => {
  await open(page, 'patients.html');
  await page.locator('[data-new]').first().click();
  const box = await page.locator('dialog[open]').boundingBox();
  expect(box.width).toBeGreaterThan(380);
  expect(box.y + box.height).toBeGreaterThan(830); // anchored to the bottom edge
});
