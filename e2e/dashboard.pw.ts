import { test, expect } from './fixtures';

test('dashboard exposes the reporting controls without horizontal overflow', async ({ memberPage }) => {
  await memberPage.goto('/dashboard');
  await expect(memberPage.getByRole('heading', { name: 'ภาพรวมสถิติผู้รับบริการ' })).toBeVisible();
  await expect(memberPage.getByRole('tablist', { name: 'ช่วงสถิติ' })).toBeVisible();
  await expect(memberPage.getByRole('button', { name: 'บันทึกวันนี้' })).toBeVisible();
  expect(await memberPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('records export a CSV file from the records table', async ({ memberPage }) => {
  await memberPage.goto('/records');
  await expect(memberPage.getByRole('heading', { name: 'ตารางรายงานย้อนหลัง' })).toBeVisible();
  const downloadPromise = memberPage.waitForEvent('download');
  await memberPage.getByRole('button', { name: /ส่งออก CSV/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^daily-reports-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('editing a published report from records creates the next version', async ({ memberPage }) => {
  const reportDate = test.info().project.name === 'mobile' ? '2099-04-11' : '2099-04-01';
  await memberPage.goto(`/reports/${reportDate}`);
  const male = memberPage.getByLabel('ชาย (Male)').first();
  const female = memberPage.getByLabel('หญิง (Female)').first();
  await male.fill('3');
  await female.fill('4');
  await expect(memberPage.getByText('บันทึกฉบับร่างแล้ว')).toBeVisible();
  await memberPage.getByRole('button', { name: 'บันทึกรายงานที่เผยแพร่' }).click();
  await expect(memberPage.getByText(/เผยแพร่แล้ว · เวอร์ชัน 1/)).toBeVisible();

  await memberPage.goto('/records');
  const row = memberPage.locator('tbody tr').filter({ hasText: reportDate });
  await expect(row).toContainText('3');
  await row.getByRole('button', { name: 'แก้ไข' }).click();
  await expect(memberPage).toHaveURL(new RegExp(`/reports/${reportDate}$`));
  await male.fill('8');
  await expect(memberPage.getByText('บันทึกฉบับร่างแล้ว')).toBeVisible();
  await memberPage.getByRole('button', { name: 'บันทึกรายงานที่เผยแพร่' }).click();
  await expect(memberPage.getByText(/เผยแพร่แล้ว · เวอร์ชัน 2/)).toBeVisible();
});

test('records inspect dialog closes with Escape and restores trigger focus', async ({ adminPage }) => {
  const reportDate = test.info().project.name === 'mobile' ? '2099-04-13' : '2099-04-03';
  await adminPage.goto(`/reports/${reportDate}`);
  await adminPage.getByLabel('ชาย (Male)').first().fill('2');
  await adminPage.getByLabel('หญิง (Female)').first().fill('1');
  await expect(adminPage.getByText('บันทึกฉบับร่างแล้ว')).toBeVisible();
  await adminPage.getByRole('button', { name: 'บันทึกรายงานที่เผยแพร่' }).click();
  await expect(adminPage.getByText(/เผยแพร่แล้ว · เวอร์ชัน 1/)).toBeVisible();

  await adminPage.goto('/records');
  const row = adminPage.locator('tbody tr').filter({ hasText: reportDate });
  const trigger = row.getByRole('button', { name: `ดูรายงาน ${reportDate}` });
  await trigger.click();
  const dialog = adminPage.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await adminPage.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
