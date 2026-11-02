# Stage 8.2 — balanced algebra bank and browser QA

Date: 2026-11-02. Base: `4c2a5c0742fca2d6eaff292b5571107e8c8cae43`. Branch: `stage82/algebra-pilot-balanced-bank`.

**Final scope result: PASS — this pilot only. No production publication, merge or deployment.**

## Content and independent review

Exactly **12 questions: 4 EASY / 5 MEDIUM / 3 HARD**. Existing 4/5/3 rules and application server guards are unchanged.

- EASY → MEDIUM: 03 combines a square root of a square with a logarithm; 05 combines two rational simplifications, domain preservation and evaluation.
- EASY → HARD: 07 combines absolute-value sign cases, original domain exclusions and a rational sign analysis; 08 intersects variable logarithm-base, rational-argument and square-root constraints; 09 distinguishes three strict/non-strict domains while preserving a canceled hole.
- Replaced old MEDIUM 10–12: removed parameter/root-counting and logarithmic-equation problems, using rational expression operations and powers/logarithms instead. This avoids disguising another topic as algebraic expressions. Question07 explicitly bridges to sign/inequality reasoning.
- Reworked 06 to a genuine one-rule EASY after independent classification feedback. Improved the sign structure/options in02 and distractors in01,03,04,09.

[Per-question prompts, solutions, keys, explanations, difficulty reasons and topic fit](./review-ledger.json). [Final second-review results](./final-independent-blind-review.json). First blind input/solutions and the initial disagreement about06 are preserved, including the disclosed revision and post-blind distractor clarifications. The author knew four retained keys from the earlier session; this is disclosed in the sealed author record. The second agent never read author keys/solutions or labels before solving.

All twelve keys matched independent reasoning. Every incorrect single-choice option and surplus MATCHING domain has a documented plausible error route. This is qualitative review by two AI executors, not teacher approval, empirical calibration, or measured distractor discrimination. Some simple alternatives remain easier to reject; no nonsensical filler is claimed to be high-quality psychometric evidence.

The [official 2026 mathematics page](https://testportal.gov.ua/matematyka-2026/) is the baseline for Numbers/Expressions and Equations/Inequalities. No NMT-2027 approval is claimed. Theory, worked domain/sign examples and the study module now support the revised practice. The other nine mathematics topics in the package are unchanged; no other subject content was touched.

## Gate and regression

A unique temporary SQLite was migrated and populated with this real pilot, three synthetic approved accounts and only the mathematics subject. Real `importContentPackage`, `verifyQuestion`, `publishLesson`, `saveTestSet` and `setTestPublication` actions were used. The lesson remained DRAFT until **the existing gate returned ready=true, counts 4/5/3**; publication then succeeded through `publishLesson`. No direct coverage override or difficulty relabeling was used.

- Full final regression run: **29/29 PASS** — [every test result](./regression-QA.json). This is one complete final run, not aggregated partial passes.
- An earlier full run had28 PASS and one obsolete test expectation of DRAFT after successful publication. The expectation was corrected; the gate was not changed.
- Independent numeric/key and package validation: **12/12 PASS**, 4/5/3, other math topics unchanged. Symbolic proofs accompany the finite numeric cross-checks.
- TypeScript, targeted ESLint and diff check: PASS. The direct-path ESLint process stalled while importing eslint-plugin-react-hooks, before file analysis. The final same-config/same-files check succeeded through a temporary ASCII junction with Node preserve-symlinks flags; no lint rules were disabled.

## Browser QA — actual Chromium and real application

Final full scenario: **PASS**. [Action response statuses and checks](./browser-QA.json).

| Stage | Observed result |
|---|---|
| 1. Approved STUDENT login | PASS, actual login form/session |
| 2. Open algebra topic | PASS, real imported lesson |
| 3. Theory and examples | PASS, rendered mathematics and server-revealed solution |
| 4. Ordinary practice | PASS, all12 real questions, 11/12; zero holdout IDs |
| 5. Complete lesson | PASS, real completion action |
| 6. FINAL admission | PASS, published independent bank |
| 7. Answer questions | PASS, six responses through UI |
| 8. Save results | PASS, draft survived reload; completed result5/6 persisted |
| 9. Mistakes and correction | PASS, real retry changed owned mistake to FIXED |
| 10. Login again | PASS, cookies/browser storage cleared; results and progress persisted |
| 11. Repeat FINAL | PASS, server refusal; no duplicate attempt |
| 12. Early DELAYED | PASS, server refusal; no premature attempt |
| 13. Independent delayed check | PASS after controlled fixture timestamp simulation;6/6 and MASTERED |

Additional checks: control IDs absent from the pre-admission catalogue; practice/final/delayed IDs disjoint; foreign result and admin access denied with actual unavailable page/no question data; OWNER management controls visible. HTTP200 is accepted only with the actual not-found page because Next.js can stream unavailable routes. No uncaught page errors.

Desktop1280 and mobile390 screenshots were inspected; checked pages had no horizontal document overflow. [Examples mobile](./screenshots/examples-mobile.png), [MASTERED result mobile](./screenshots/delayed-mastered-mobile.png), [lesson desktop](./screenshots/lesson-desktop.png), [result desktop](./screenshots/delayed-mastered-desktop.png).

Two earlier harness attempts stopped on a five-second compilation wait and a wrong heading selector (`Помилки` versus `Мої помилки`). Both causes were identified; the final complete scenario ran on a fresh temporary fixture. A screenshot-induced caret hydration warning was avoided by preserving the initial caret style in final screenshots. Development-only module/color/script-tag warnings were observed; no production build was run or implied.

## Data and limits

[Final database checks](./database-QA.json): one subject,24 questions (12 practice +12 separate controls), pilot READY, three completed learner attempts11/12,5/6,6/6, no pending review, MASTERED, integrity_check=ok and zero foreign-key violations. The dedicated server is stopped. Temporary databases and randomly generated QA credentials remain local, outside Git; screenshots contain only synthetic identities.

Seven days were **simulated by moving only this fixture's FINAL timestamps into the past**, after verifying early rejection. Server time was not changed; no production test backdoor was introduced. This is not an actual seven-day wait.

The working database was never connected to by these tests/server. Its DB/WAL/SHM size and modification-time metadata are unchanged before/after. Existing23 worktrees and the previous pilot branch were not edited; only the new worktree was used. Historical reports are preserved.

The result is acceptance of this isolated pilot under the stated qualitative rubric. It does not certify the entire academy, the 2027 syllabus or teacher approval, and does not authorize a working-database import.
