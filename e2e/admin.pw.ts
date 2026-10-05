import { test, expect } from './fixtures';

test('admin can invite and revoke a member', async ({ adminPage }) => {
  await adminPage.goto('/settings');
  await adminPage.getByLabel('อีเมลผู้รับคำเชิญ').fill(`revoked-${Date.now()}@example.test`);
  await adminPage.getByLabel('สิทธิ์').selectOption('member');
  await adminPage.getByRole('button', { name: 'ส่งคำเชิญ' }).click();
  await expect(adminPage.getByText('บันทึกคำเชิญแล้ว')).toBeVisible();
  const row = adminPage.locator('tbody tr').filter({ hasText: 'revoked-' });
  await row.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(row).toContainText('ยกเลิกแล้ว');
});
