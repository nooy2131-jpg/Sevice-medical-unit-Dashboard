# UI and Feature Audit — 2026-10-05

## Scope and verification boundary

Review dashboard, report entry, private drafts, published reports, history, CSV migration, authentication screens, invitations, and Settings against `PLAN.md` and the original `fd01e48` implementation. Ping authorized restoring the original capabilities removed by the rebuild. Preserve the existing Thai interface and visual identity.

This is a source review with local database tests and a production build. Browser execution was stopped because a saved browser permission blocked the local audit origin. Ping subsequently chose to skip browser QA. Desktop/mobile rendering, actual keyboard focus, print layout, and the browser regression suite remain unverified. No WCAG compliance or visual health score is claimed.

Google OAuth, real Resend delivery, Supabase connectivity, and production routing were not exercised. All database tests used a separate local audit database. No production data was changed.

## Findings addressed

| Priority | Finding | Change |
| --- | --- | --- |
| P1 | Repeated navigation after failed autosave could discard a queued local draft. | Retry pending drafts on each flush; retain edits when saving fails. |
| P1 | Browser history navigation could discard an unsaved draft after a failed request. | Keep a session recovery copy keyed by account and date; require an explicit local/server choice when reopening. |
| P1 | Draft cleanup failure after publishing could leave the editor stuck busy. | Release the publishing state even when draft cleanup fails; retain the draft and report the cleanup failure. |
| P1 | CSV columns were read by position even when their headers were reordered. | Map recognized headers by name and reject duplicate, unknown, or missing data headers. |
| P1 | Missing CSV data columns could silently clear top items or notes during overwrite. | Require all report data headers; only `UpdatedAt` is optional. |
| P1 | Formula protection changed literal apostrophes on export/import. | Escape formula-leading text and literal leading apostrophes reversibly; preserve trailing TSV fields. |
| P1 | Settings and invitation requests could leave loading/busy states stuck after network failures. | Catch request failures, release busy state, and show recoverable errors. |
| P1 | History dialogs declared modal semantics without keyboard focus management. | Use native modal dialogs with initial focus, Escape handling, and focus restoration. Runtime keyboard behavior still needs browser verification. |
| P2 | “Record today” opened the selected historical period. | Use the current Bangkok calendar date. |
| P2 | Clearing date inputs could produce invalid dates/routes. | Accept only valid calendar dates. |
| P2 | Missing password-reset tokens left a disabled form without explanation. | Show an explicit error and a link to request a new token. |
| P2 | Numeric inputs could exceed their mobile grid columns. | Constrain inputs to their column widths; visual behavior still needs browser verification. |
| P2 | Small white primary-button text used a lighter teal surface. | Use the existing darker teal primary shade. |

## Feature parity restoration

Restore the daily gender trend, peak-day summary, period-filtered reporter notes, and disease/procedure gender breakdowns in the dashboard. Restore service columns and detailed top-item gender counts in history, pasted CSV/JSON/TSV imports, and direct entry points for today's report and a chosen historical date. Keep the rebuilt server permissions, explicit saves, duplicate import preview, and conflict checks.

The dashboard average uses recorded days rather than dividing sparse seven-day periods by seven. Missing dates remain explicitly visible and do not become zero-valued reports.

## Regression suite

Repair E2E setup timestamps and use Playwright's built-in page fixture to preserve project device settings. Align sign-in and report navigation expectations with actual routes and controls. Add cases for dashboard controls, CSV download, report versions, dialog dismissal/focus, Settings recovery, failed invitation requests, reset-token states, and repeated failed autosave navigation.

Browser cases are supplied for desktop and mobile but have not passed a runtime execution in this audit. They must run before release. Unit/database verification covers report CAS, independent totals, tombstones, import rollback, invitation admission/revocation, concurrent last-Admin protection, date boundaries, HTTP guards, and CSV round trips.

## Verification results

| Check | Result |
| --- | --- |
| Unit and local PostgreSQL integration tests | 28 passed, 0 failed; 86 assertions across seven files. |
| Strict TypeScript check | Passed. |
| ESLint | No errors; two existing anonymous-default-export warnings in configuration files. |
| Production build | Passed with local-only test configuration. Google credentials were intentionally absent. |
| Whitespace/diff check | Passed. |
| Browser test discovery | 28 cases across desktop and mobile; discovery does not execute the tests. |
| Browser execution, screenshot inspection, and print inspection | Skipped by Ping after the saved permission blocked the local audit origin. |

Pending-draft recovery uses browser session storage as a fallback, while the server remains the source of saved drafts. Storage keys include the authenticated account ID and date. A recovery prompt blocks editing until the user chooses the retained local data or the server data. This fallback is scoped to the browser tab/session; it is not a cross-device backup. The new client workflows still require runtime browser verification before release.

## Remaining release checks

1. Run the desktop/mobile browser suite after browser access is enabled, including draft conflicts across tabs and navigation while a draft save fails.
2. Inspect mobile overflow, touch targets, 200% text sizing, keyboard navigation, and print output using actual rendered pages.
3. Verify Google sign-in, password-reset/invitation email delivery, and final-origin configuration with test credentials.
4. Verify the production database and deployment controls described in `PLAN.md`.

Legacy manually edited CSV cells beginning with an apostrophe before a formula are ambiguous: they may represent literal text or the old spreadsheet protection format. The reversible escape applies to exports produced by the updated application; review legacy import previews before overwriting reports.

## UX/UI refinement after first draft

The first-draft checkpoint is commit `06ea1ad`. Ping selected native dropdowns and whole-app refinement while preserving the teal/slate identity. This follow-up standardizes native select, input, and button styling; adds 44px control heights, keyboard focus, disabled states, and a forced-colors native-select fallback; keeps the header stacked below the large breakpoint; and exposes accurate current-page navigation semantics.

Settings and authentication surfaces now share the control treatment, persistent labels, responsive spacing, and loading/empty feedback. History distinguishes an empty dataset from an unmatched search and offers the appropriate recovery action. Missing reset tokens offer a new reset-link request. Report recovery and destructive actions have larger touch targets. Existing domain behavior remains in place.

Local lint, strict typecheck, production build, whitespace checks, and the static UI detector passed during this refinement. Lint retains two existing configuration warnings. Narrow final recovery-link and touch-target fixes passed targeted lint and strict typecheck. Browser rendering and interactions remain unverified under the previously selected browser-QA boundary; static checks do not establish visual quality or WCAG compliance.
