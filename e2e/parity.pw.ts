import { test, expect } from "./fixtures";

function parityDate(projectName: string, desktopDay: number, mobileDay: number): string {
  return `2099-06-${String(projectName === "mobile" ? mobileDay : desktopDay).padStart(2, "0")}`;
}

test("admin can paste JSON, review it, and publish a report with service details", async ({ adminPage }) => {
  const reportDate = parityDate(test.info().project.name, 1, 2);
  await adminPage.goto("/records");
  await adminPage.getByRole("button", { name: "วาง CSV / JSON / TSV" }).click();
  await adminPage.getByLabel("ข้อมูลรายงาน").fill(
    JSON.stringify([
      {
        reportDate,
        totalMale: 5,
        totalFemale: 7,
        thaiMale: 2,
        thaiFemale: 3,
        genMale: 1,
        genFemale: 2,
        procMale: 1,
        procFemale: 1,
        refillMale: 1,
        refillFemale: 1,
        referDocMale: 0,
        referDocFemale: 1,
        admitMale: 0,
        admitFemale: 0,
        referOutMale: 0,
        referOutFemale: 1,
        topDiseases: [{ name: "ปวดศีรษะ", count: 7, male: 3, female: 4 }],
        topProcedures: [{ name: "ประคบสมุนไพร", count: 5, male: 2, female: 3 }],
        reporterNote: "Parity import",
      },
    ]),
  );
  await adminPage.getByRole("button", { name: "ตรวจสอบข้อมูล" }).click();

  const preview = adminPage.getByRole("dialog");
  await expect(preview).toContainText("นำเข้าได้ 1 แถว");
  await preview.getByRole("button", { name: "ยืนยันนำเข้า" }).click();

  const row = adminPage.locator("tbody tr").filter({ hasText: reportDate });
  await expect(row).toContainText("12");
  await expect(row).toContainText("5/7");
  await expect(row).toContainText("ปวดศีรษะ (7)");

  await row.getByRole("button", { name: `ดูรายงาน ${reportDate}` }).click();
  const details = adminPage.getByRole("dialog");
  await expect(details).toContainText("ช/ญ 3/4");
  await expect(details).toContainText("ช/ญ 2/3");
});

test("member can open a selected historical date but cannot import", async ({ memberPage }) => {
  const reportDate = parityDate(test.info().project.name, 11, 12);
  await memberPage.goto("/records");

  await expect(memberPage.locator('input[type="file"]')).toHaveCount(0);
  await expect(memberPage.getByRole("button", { name: "วาง CSV / JSON / TSV" })).toHaveCount(0);

  await memberPage.getByLabel("วันที่รายงานที่ต้องการเปิด").fill(reportDate);
  await memberPage.getByRole("button", { name: "เปิดรายงาน" }).click();
  await expect(memberPage).toHaveURL(new RegExp(`/reports/${reportDate}$`));
  await expect(memberPage.getByLabel("วันที่รายงาน")).toHaveValue(reportDate);
});
