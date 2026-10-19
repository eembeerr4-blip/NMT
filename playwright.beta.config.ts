import {defineConfig} from "@playwright/test";

const baseURL=process.env.NMT_BETA_URL??"http://127.0.0.1:3100";
const url=new URL(baseURL);
if(url.hostname!=="127.0.0.1"||url.protocol!=="http:"||Number(url.port)<3100)throw Error("Beta checks require an isolated localhost QA port >=3100");
export default defineConfig({
  expect:{timeout:15000},
  testDir:"e2e/beta",workers:1,fullyParallel:false,timeout:45000,
  snapshotPathTemplate:"{testDir}/../../design/screenshots/06-baselines/{projectName}/{arg}{ext}",
  outputDir:"test-results/beta",
  reporter:[["list"],["json",{outputFile:`audit/reports/${process.env.NMT_BETA_STAGE??"01"}-playwright.json`}]],
  use:{baseURL,channel:"chrome",headless:true,trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:[{name:"desktop",use:{viewport:{width:1440,height:900}}},{name:"mobile",use:{viewport:{width:390,height:844}}}],
  // No webServer: never invoke the legacy 3000 server or content seed.
});
