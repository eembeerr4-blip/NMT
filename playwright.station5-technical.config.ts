import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'e2e/station5-technical',workers:1,retries:0,timeout:600000,
  expect:{timeout:30000},outputDir:process.env.STATION5_ARTIFACTS,reporter:'list',
  use:{baseURL:'http://127.0.0.1:3155',headless:true,viewport:{width:390,height:844},navigationTimeout:90000,trace:'off',screenshot:'off',video:'off'},
  webServer:{command:'node scripts/station5-qa-server.mjs',url:'http://127.0.0.1:3155/login',reuseExistingServer:false,timeout:180000},
});
