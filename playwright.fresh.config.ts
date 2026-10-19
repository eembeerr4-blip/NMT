import {defineConfig} from "@playwright/test";
import beta from "./playwright.beta.config";
export default defineConfig({...beta,testDir:"e2e/fresh",outputDir:"test-results/fresh",reporter:[["list"],["json",{outputFile:"audit/reports/06-fresh-playwright.json"}]],use:{...beta.use,baseURL:"http://127.0.0.1:3101"}});
