import { expect } from '@playwright/test';

export const PAGES = ['patient-desk', 'patients', 'diseases', 'doctors', 'prescriptions', 'reports'];

/** Open a page with fresh demo data and fail the test on any console error. */
export async function open(page, path) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`/pages/${path}`);
  await expect(page.locator('#page')).not.toBeEmpty();
  return errors;
}

export const noHorizontalOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
