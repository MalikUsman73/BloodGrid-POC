import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'bloodgrid1';

async function signUpRecipient(page: Page, email: string) {
  await page.goto('/#/signup?role=recipient');
  await page.getByLabel('Full name').fill('Test Recipient');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel(/I understand this is a pilot/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/#\/recipient/);
}

test('a visitor is sent to sign in before reaching any workspace', async ({ page }) => {
  await page.goto('/#/recipient/new');
  await expect(page).toHaveURL(/#\/login/);
  await page.goto('/#/donor');
  await expect(page).toHaveURL(/#\/login/);
});

test('sign-up validates before it submits', async ({ page }) => {
  await page.goto('/#/signup?role=recipient');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Could not create the account').or(page.getByRole('alert').first())).toBeVisible();
  await expect(page).toHaveURL(/#\/signup/);
});

test('a recipient signs up, raises a request and gets a screened, ranked set of donors', async ({ page }) => {
  await signUpRecipient(page, 'recipient@example.com');
  await page.goto('/#/recipient/new');
  await expect(page.getByRole('heading', { name: 'New blood request' })).toBeVisible();

  await page.getByRole('button', { name: 'A+', exact: true }).click();
  await page.getByRole('button', { name: 'Urgent', exact: true }).click();
  await page.getByRole('button', { name: 'Find donors' }).click();
  await expect(page).toHaveURL(/#\/recipient\/requests\/.+/);
  await expect(page.getByRole('tab', { name: 'Selected donors' })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();

  await page.getByRole('button', { name: 'Simulate accept' }).first().click();
  await expect(page.getByText('Accepted').first()).toBeVisible();
});

test('a donor signs up, lands on their home and can sign out and back in', async ({ page }) => {
  await page.goto('/#/signup?role=donor');
  await page.getByLabel('Full name').fill('Test Donor');
  await page.getByLabel('Email').fill('donor@example.com');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'O+', exact: true }).click();
  await page.getByLabel('Your sector').selectOption({ index: 1 });
  await page.getByLabel(/I am at least 18/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/#\/donor/);
  await expect(page.getByRole('heading', { name: /Hello, Test/ })).toBeVisible();

  await page.getByRole('button', { name: /Sign out/ }).first().click();
  await page.goto('/#/login?role=donor');
  await page.getByLabel('Email').fill('donor@example.com');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in as donor/ }).click();
  await expect(page).toHaveURL(/#\/donor/);
});

test('a recipient cannot sign in through the donor tab', async ({ page }) => {
  await signUpRecipient(page, 'wrongrole@example.com');
  await page.getByRole('button', { name: /Sign out/ }).first().click();
  await page.goto('/#/login?role=donor');
  await page.getByLabel('Email').fill('wrongrole@example.com');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in as donor/ }).click();
  await expect(page.getByText('Could not sign in')).toBeVisible();
});
