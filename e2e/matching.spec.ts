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

async function raiseRequest(page: Page, opts: { mr: string; file: string; urgency: 'Routine' | 'Urgent' | 'Critical' }) {
  await page.goto('/#/recipient/new');
  await expect(page.getByRole('heading', { name: 'New blood request' })).toBeVisible();
  await page.locator('#patientPick').selectOption('new');
  await page.getByLabel('Full name').fill('Ali Raza');
  await page.getByLabel('Hospital record number').fill(opts.mr);
  await page.getByLabel('Hospital', { exact: true }).selectOption({ label: 'Capital General Hospital (G-8)' });
  await page.getByLabel('Year of birth').fill('1980');
  await page.getByRole('group', { name: 'Patient’s blood group' }).getByRole('button', { name: 'A+', exact: true }).click();
  await page.getByLabel('Prescribing doctor').fill('Dr. Sana Malik');
  await page.getByLabel('PMDC number').fill('10234-P');
  await page.getByLabel('Prescription or requisition form').setInputFiles({
    name: 'rx.pdf', mimeType: 'application/pdf', buffer: Buffer.from(opts.file),
  });
  await page.getByRole('button', { name: opts.urgency, exact: true }).click();
  await page.getByRole('button', { name: 'Submit request' }).click();
}

test('a recipient raises a verified request, donors accept, and the recipient confirms and says thanks', async ({ page }) => {
  await signUpRecipient(page, 'recipient@example.com');
  await raiseRequest(page, { mr: 'CGH-9001', file: 'prescription one', urgency: 'Urgent' });
  await expect(page).toHaveURL(/#\/recipient\/requests\/.+/);
  await expect(page.getByRole('tab', { name: 'Donors' })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await expect(page.getByText('Unverified request')).toHaveCount(0);

  await page.getByRole('button', { name: 'Simulate accept' }).first().click();
  await expect(page.getByText('Confirm who came')).toBeVisible();
  await page.getByLabel(/Thank-you note for donor/).fill('Thank you, you saved my father.');
  await page.getByRole('button', { name: 'Donated', exact: true }).click();
  await expect(page.getByText('Confirm who came')).toHaveCount(0);
  await expect(page.getByText('Donated').first()).toBeVisible();
});

test('a critical request also shows the nearest registered blood banks', async ({ page }) => {
  await signUpRecipient(page, 'critical@example.com');
  await raiseRequest(page, { mr: 'CGH-9002', file: 'prescription two', urgency: 'Critical' });
  await expect(page).toHaveURL(/#\/recipient\/requests\/.+/);
  await expect(page.getByText('you can also contact a blood bank directly')).toBeVisible();
});

test('a prescription file used before is refused, and nothing is saved', async ({ page }) => {
  await signUpRecipient(page, 'reuse@example.com');
  await raiseRequest(page, { mr: 'CGH-9003', file: 'the same scan', urgency: 'Routine' });
  await expect(page).toHaveURL(/#\/recipient\/requests\/.+/);

  await raiseRequest(page, { mr: 'CGH-9004', file: 'the same scan', urgency: 'Routine' });
  await expect(page.getByText('BloodGrid could not verify this request')).toBeVisible();
  await expect(page).toHaveURL(/#\/recipient\/new/);
  await page.goto('/#/recipient/requests');
  await expect(page.locator('tbody tr')).toHaveCount(1);
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
