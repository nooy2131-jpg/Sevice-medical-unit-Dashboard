import { test, expect } from './fixtures';

test('member draft survives reload, reset, cancel, and explicit publish', async ({ memberPage }) => {
  const reportDate = test.info().project.name === 'mobile' ? '2099-03-16' : '2099-03-15';
  await memberPage.goto(`/reports/${reportDate}`);
  const male = memberPage.getByLabel('ชาย (Male)').first();
  const female = memberPage.getByLabel('หญิง (Female)').first();
  await male.fill('7');
  await female.fill('11');
  await expect(memberPage.getByText('บันทึกฉบับร่างแล้ว')).toBeVisible();

  await memberPage.reload();
  await expect(male).toHaveValue('7');
  await expect(female).toHaveValue('11');

  await memberPage.getByRole('button', { name: 'ล้างฉบับร่าง' }).click();
  await expect(male).toHaveValue('');
  await memberPage.getByRole('button', { name: 'กลับภาพรวม (เก็บฉบับร่าง)' }).click();
  await expect(memberPage).toHaveURL(/\/dashboard$/);
  await memberPage.goto(`/reports/${reportDate}`);
  await expect(male).toHaveValue('');
  await male.fill('7');
  await female.fill('11');

  await memberPage.getByRole('button', { name: 'บันทึกรายงานที่เผยแพร่' }).click();
  await expect(memberPage.getByText(/เผยแพร่แล้ว · เวอร์ชัน 1/)).toBeVisible();
});

test('member cannot call admin settings APIs', async ({ memberPage }) => {
  const response = await memberPage.request.get('/api/users');
  expect(response.status()).toBe(403);
});
