@echo off
cd /d C:\Users\User\nmt-academy\audit\chrome-20261018\runtime
set DATABASE_URL=file:C:/Users/User/nmt-academy/audit/chrome-20261018/qa.db
set SESSION_COOKIE_SECURE=false
node node_modules\next\dist\bin\next dev --hostname 127.0.0.1 --port 3001

