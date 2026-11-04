import { defineConfig } from '@playwright/test';
// Start the separate production QA server on 3113 with prisma/stage5b-qa.db.
// No webServer fallback: never reuse or restart an unknown process.
export default defineConfig({testDir:'e2e/stage5',testMatch:'stage5b-retry.spec.ts',workers:1,timeout:60000,expect:{timeout:15000},outputDir:'test-results/stage5b',reporter:'list',use:{baseURL:'http://127.0.0.1:3113',channel:'chrome',headless:true,viewport:{width:390,height:844},trace:'off',screenshot:'off'}});
