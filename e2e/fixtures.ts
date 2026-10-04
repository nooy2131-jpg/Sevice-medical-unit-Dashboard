import { test as base, expect, type Page } from '@playwright/test';
import { adminEmail, memberEmail, password } from './global-setup';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('อีเมล').fill(email);
  await page.getByLabel('รหัสผ่าน').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/$/);
}

export const test = base.extend<{ adminPage: Page; memberPage: Page }>({
  adminPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await signIn(page, adminEmail);
    // Playwright fixture callbacks use a parameter named `use`, which the
    // React hooks lint rule cannot distinguish from a hook by name.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await context.close();
  },
  memberPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await signIn(page, memberEmail);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await context.close();
  },
});

export { expect };
