# Station 4 — audit and first foundation batch

Historical result at319e0b1. The PRACTICE package and targeted tests were subsequently revised in [Station4.1](../station41/RESULT.md); difficulty and final-QA statements below describe the earlier version.

2026-11-02. Base: `84c1ea922b509bfcff72417896455d23dc0e039f`. Branch: `station4/math-foundations`.

**PARTIAL. Three original modules and their numeric keys are prepared and checked. The required genuine NMT difficulty distribution is NOT achieved. Publication remains blocked; no production import or deployment occurred.**

## What a learner actually has

[Current read-only content audit](./live-content-audit.json) refreshes the working application's content availability using `lessonAccess` rules. DRAFT and JSON candidates are excluded. No production login/layout/syncPlan was executed and no personal tables were queried. Existing subject reviews were reused rather than repeating all514 old questions. Scores below are provisional editorial judgements, not measured learning outcomes or independent approval of every legacy key.

Scale:0 absent;1 fragments;2 partial preparation;3 substantial coverage with gaps;4 nearly complete and verified;5 complete, independently reviewed and usable throughout. A short explanation is a review signal, not proof that its key is wrong. READY/VERIFIED is not curriculum completeness. Parent sections are included in the available-record count, so it is not a count of complete independent lessons.

| Subject | Overall /5 | Available records | Verified questions | Theory / notes / examples / practice / keys-and-explanations / tests / video / programme | Concrete gaps |
|---|---:|---:|---:|---|---|
| Mathematics |1|15 of16|114|1 /0 /2 /2 /2 /1 /1 /2|No available lesson reaches2000 theory characters; no substantive separate notes;113 short explanations; one confirmed video; no published mixed sets. The Stage8.2 QA bank is not imported into working lessons.|
| Ukrainian language |2|13 of15|100|2 /1 /2 /2 /2 /1 /0 /2|Three longer theory units;52 short explanations; large morphology/syntax gaps; no confirmed video or published mixed sets. Prepared grammar candidates do not count.|
| History of Ukraine |1|11 of12|68|1 /1 /1 /1 /2 /1 /0 /1|No available theory reaches2000 characters;58 short explanations; chronological coverage, maps, source work and official three-of-seven format remain incomplete.|
| Biology |2|14 of16|112|2 /1 /2 /2 /2 /1 /0 /2|Four longer theory units, concentrated in cell/molecular biology;63 short explanations; physiology/diversity/genetics breadth and official grouped response format remain incomplete.|

No subject has substantive notes above500 characters in the current audit. No published mixed set was observed. Existing dynamic topic/exam mechanics are not equivalent to independently curated curriculum tests. The prior24-question correction is recorded in `content/stage8/CONTINUATION-RESULT.md`; this task does not claim a fresh independent solution of every working question.

## Three modules

[Original PRACTICE package](./math-foundations.PRACTICE.package.json):

1. **Дроби та послідовність арифметичних дій** — existing map `math-numbers-sub-02`.
2. **Відсотки та послідовні зміни** — `math-numbers-sub-04`.
3. **Відношення, пропорції та масштаб** — `math-numbers-sub-03`.

These unpack the thin existing combined number/percentage/ratio overview into a prerequisite route before expressions/equations. Each has original theory, concise summary, substantial notes, six worked examples, typical mistakes and12 explained numeric practice questions. Advanced applications explicitly bridge to equations; they are not prerequisites for the basic arithmetic explanations. This is skill practice, not a full22-question NMT-format simulation. No new application UI or fake video controls were added.

The first editorial labels were4 EASY /5 MEDIUM /3 HARD per module. Two independent blind reviews did **not** support genuine NMT HARD classification. Nine practice tasks were substantively rewritten after the first review, not merely relabeled. The second reviewer independently solved all72 revised questions (36 practice plus36 private controls), and all72 keys matched. Three private model assumptions were made explicit after review, without changing numbers/keys. No teacher approval or empirical calibration is claimed.

**Final honest distributions: fractions9 EASY /3 MEDIUM /0 HARD; percentages9/3/0; ratios10/2/0.** One elevated percentage task is conservatively MEDIUM. The unchanged readiness gate rejects all three modules. [Public practice-only independent review](./independent-practice-review.json) contains no control questions or keys.

Separate FINAL and DELAYED banks have six questions each per module,36 controls in total, disjoint IDs and prompts from practice and from each other. Banks, author keys and full blind reports remain outside Git. They are reviewed numerically, but are not production-published or claimed to be calibrated assessments.

## New QA, distinguished by version

- **Exploratory fixture before final difficulty review:** [browser evidence](./browser-QA.json), actual Chromium, three modules,72 answers across9 completed attempts. Mobile390 theory/examples/notes, wrong and correct example answers, revealed solutions, practice11/12, draft reload, mistake retry, lesson completion, FINAL6/6, fresh login with persistent results, early DELAYED rejection, DELAYED6/6 and MASTERED all passed. Seven days were simulated only in fixture-owned FINAL timestamps. Integrity was ok and FK violations zero. This exercised provisional labels and is **not acceptance of the final bank**.
- Screenshots from that exploratory run were inspected locally. No horizontal overflow was observed. A duplicate summary/notes paragraph was subsequently removed in the final package. Screenshots remain private and are not presented as final-content screenshots.
- **Final package:** [integration evidence](./integration-QA.json). The targeted two-test file passed on a fresh disposable SQLite: parsing/grading, independent-review difficulty labels, real import/verification, real publication refusal, three lessons still DRAFT, no publication audit event or learner attempt. No gate override.
- **Final browser guard:** [evidence](./draft-guard-QA.json). Real approved STUDENT login; all three final lessons show “Матеріал готується”; all36 controls remain hidden; no attempt created. This negative test confirms the final review cannot be bypassed. It does not claim an available student learning flow for blocked modules.
- Final targeted integration tests:2/2 PASS. Final browser guard:1/1 PASS (12.4 seconds for the scenario). TypeScript, targeted ESLint, diff, private/public boundary and final evidence-hash checks passed. The previous Stage8.2 full regression/Chromium suites were not repeated.
- Development warnings: Google Font download was blocked and fallback rendering was used; existing module/color and KaTeX Unicode-label warnings were nonblocking. The first Windows server teardown needed verified termination of its own process tree after the scenario passed; the QA launcher now terminates its own Next child tree. No unrelated server was stopped.

## Sources and remaining gates

[Source ledger](./sources.json) records official2026 subject pages and programme-map links, Telegram selection and YouTube candidates. New text/questions are original. Existing5984-file Telegram index was reused; one relevant five-page percentage/ratio PDF was inspected and rejected for uncorrected arithmetic plus unknown redistribution rights. No Telegram video or third-party image/PDF was copied into Git. Two unrelated covers were excluded. Duplicate selection uses the existing hashes; no archive rescan.

Two YouTube candidates were discovered, **zero fully watched and zero CONFIRMED**. Duration, views, likes and comments were not observable and are left null. Search snippets are not playback or teacher-quality review. Programme2027 is not confirmed; official2026 remains the bounded baseline.

Required remaining work: author and independently verify genuinely difficult but in-scope questions rather than forcing4/5/3 labels; re-run affected final module QA when a bank actually passes; fully watch and review videos with real engagement data; complete the programme crosswalk and teacher review; request separate permission before any working import/publication. The existing publicly exposed Stage8.2 control bank is not reused as a new closed assessment.

Work happened in a separate worktree. The original50 local files and TASK artifacts were not edited. Production SQLite was opened only through explicit read-only/query-only content queries; no working writes, backups, migrations, seed, personal account/session access, imports or publication. No deployment. Private QA databases/credentials/control banks and source media remain local outside the repository.
