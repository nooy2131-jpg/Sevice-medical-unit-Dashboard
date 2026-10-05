import { test, expect } from './fixtures';

test('settings remains usable after a users request failure and recovers on reload', async ({ adminPage }) => {
  let attempts = 0;
  await adminPage.route('**/api/users', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'temporary failure' } }) });
      return;
    }
    await route.continue();
  });
  await adminPage.goto('/settings');
  await expect(adminPage.getByRole('heading', { name: 'ตั้งค่าการใช้งาน' })).toBeVisible();
  await expect(adminPage.getByRole('alert')).toBeVisible();
  await adminPage.reload();
  const accounts = adminPage.locator('section').filter({ has: adminPage.getByRole('heading', { name: 'บัญชีผู้ใช้งาน' }) });
  await expect(accounts.locator('tbody tr').filter({ hasText: 'e2e-admin@example.test' })).toContainText('E2E Admin');
});

test('invite signup reports an aborted request and re-enables the form', async ({ memberPage }) => {
  await memberPage.route('**/api/invitations/accept*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ invitation: { email: 'new-user@example.test', role: 'member', expiresAt: '2099-01-01T00:00:00.000Z' } }),
      });
      return;
    }
    await route.abort('failed');
  });
  await memberPage.goto('/invite?token=aborted-token');
  await memberPage.getByLabel('ชื่อที่แสดง').fill('New User');
  await memberPage.getByLabel('รหัสผ่าน').fill('correct-horse-battery-staple');
  await memberPage.getByRole('button', { name: 'สร้างบัญชี' }).click();
  await expect(memberPage.getByRole('alert')).toContainText(/ไม่สามารถสร้างบัญชีได้|ลองใหม่/);
  await expect(memberPage.getByRole('button', { name: /สร้างบัญชี/ })).toBeEnabled();
});

test('reset password without a token disables submission', async ({ memberPage }) => {
  await memberPage.goto('/reset-password/new');
  await expect(memberPage.getByRole('heading', { name: 'ตั้งรหัสผ่านใหม่' })).toBeVisible();
  await expect(memberPage.getByRole('alert')).toContainText('ไม่พบ token');
  await expect(memberPage.locator('a[href="/reset-password"]')).toBeVisible();
  await expect(memberPage.getByRole('button', { name: 'บันทึกรหัสผ่าน' })).toBeDisabled();
});

test('expired reset password token shows a recoverable error', async ({ memberPage }) => {
  await memberPage.route('**/api/auth/**', async (route) => {
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'invalid_token' } }) });
  });
  await memberPage.goto('/reset-password/new?token=expired-token');
  await memberPage.getByLabel('รหัสผ่านใหม่').fill('correct-horse-battery-staple');
  await memberPage.getByRole('button', { name: 'บันทึกรหัสผ่าน' }).click();
  await expect(memberPage.getByRole('alert')).toContainText('ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุ');
});

test('failed autosave keeps the report date until a retry succeeds', async ({ memberPage }) => {
  const reportDate = test.info().project.name === 'mobile' ? '2099-05-11' : '2099-05-01';
  const nextDate = test.info().project.name === 'mobile' ? '2099-05-12' : '2099-05-02';
  let putAttempts = 0;
  await memberPage.route('**/api/drafts/*', async (route) => {
    if (route.request().method() === 'PUT') {
      putAttempts += 1;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await memberPage.goto(`/reports/${reportDate}`);
  const male = memberPage.getByLabel('ชาย (Male)').first();
  await male.fill('9');
  await expect.poll(() => putAttempts).toBe(1);

  await memberPage.getByRole('button', { name: 'วันถัดไป' }).click();
  await expect(memberPage.getByLabel('วันที่รายงาน')).toHaveValue(reportDate);
  await expect(male).toHaveValue('9');
  await memberPage.getByRole('button', { name: 'วันถัดไป' }).click();
  await expect(memberPage.getByLabel('วันที่รายงาน')).toHaveValue(reportDate);
  await expect(male).toHaveValue('9');

  await memberPage.unroute('**/api/drafts/*');
  await memberPage.getByRole('button', { name: 'วันถัดไป' }).click();
  await expect(memberPage.getByLabel('วันที่รายงาน')).toHaveValue(nextDate);
  await memberPage.getByRole('button', { name: 'วันก่อนหน้า' }).click();
  await expect(memberPage.getByLabel('วันที่รายงาน')).toHaveValue(reportDate);
  await expect(memberPage.getByLabel('ชาย (Male)').first()).toHaveValue('9');
});
