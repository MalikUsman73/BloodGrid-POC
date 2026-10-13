import { expect, test } from '@playwright/test';

test('a request goes in and a screened, ranked set of donors comes out', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'New blood request' })).toBeVisible();

  await page.getByRole('button', { name: 'A+', exact: true }).click();
  await page.getByRole('button', { name: 'Urgent', exact: true }).click();
  await expect(page.getByText('Donors to notify', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Find donors' }).click();
  await expect(page).toHaveURL(/#\/requests\/.+/);
  await expect(page.getByRole('tab', { name: 'Selected donors' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(4);

  await page.getByRole('tab', { name: 'Compare methods' }).click();
  await expect(page.getByText('Exact Pareto selection')).toBeVisible();
});

test('a rare group with a large contact set still returns a usable page', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'AB-', exact: true }).click();
  await page.getByRole('button', { name: 'Critical', exact: true }).click();
  await page.getByRole('button', { name: 'More units' }).click();
  await page.getByRole('button', { name: 'More units' }).click();
  await page.getByRole('button', { name: 'Find donors' }).click();
  await expect(page).toHaveURL(/#\/requests\/.+/);
  await expect(page.getByRole('heading', { name: /BR-\d+/ })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});
