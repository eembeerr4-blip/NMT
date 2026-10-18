/* eslint-disable @typescript-eslint/no-require-imports -- npm lifecycle script uses Node CommonJS. */
/* Ukrainian display text for the locally installed Next.js development panel.
 * Do not translate protocol values, identifiers, code examples, or error messages.
 * Reapplied by postinstall; only this known package version is supported.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
const packagePath = projectRequire.resolve('next/package.json');
const version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
if (version !== '16.4.2') {
  console.warn(`Ukrainian development-panel translation skipped: review Next.js ${version} first.`);
  process.exit(0);
}
const translations = {
  'Preferences': 'Налаштування',
  'Theme': 'Тема оформлення',
  'Select your theme preference.': 'Оберіть світле, темне або системне оформлення панелі.',
  'System': 'Як у системі', 'Light': 'Світла', 'Dark': 'Темна',
  'Position': 'Розташування',
  'Adjust the placement of your dev tools.': 'Оберіть кут екрана, де показувати кнопку панелі.',
  'Bottom Left': 'Унизу ліворуч', 'Bottom Right': 'Унизу праворуч',
  'Top Left': 'Угорі ліворуч', 'Top Right': 'Угорі праворуч',
  'Size': 'Розмір панелі',
  'Adjust the size of your dev tools.': 'Оберіть зручний розмір тексту та елементів панелі.',
  'Small': 'Малий', 'Medium': 'Середній', 'Large': 'Великий',
  'Hide Dev Tools for this session': 'Тимчасово приховати панель',
  'Hide Dev Tools until you restart your dev server, or 1 day.': 'Приховати панель до перезапуску локального сайту або на одну добу.',
  'Hide': 'Приховати',
  'Hide Dev Tools shortcut': 'Клавіші для показу та приховування',
  'Set a custom keyboard shortcut to toggle visibility.': 'Натисніть кнопку й оберіть поєднання клавіш, щоб показувати або приховувати панель.',
  'Record Shortcut': 'Задати клавіші', 'Clear shortcut': 'Очистити поєднання клавіш',
  'Shortcut set': 'Поєднання клавіш збережено', 'Recording': 'Натисніть поєднання клавіш',
  'Disable Dev Tools for this project': 'Повністю вимкнути панель у проєкті',
  'To disable this UI completely, set': 'Щоб повністю вимкнути панель, укажіть',
  ' in your ': ' у файлі ', ' file.': '.',
  'Restart Dev Server': 'Перезапустити локальний сайт',
  'Restarts the development server without needing to leave the browser.': 'Перезапускає локальний сайт без виходу з браузера. Дочекайтеся завершення та оновіть сторінку.',
  'Restart': 'Перезапустити',
  'Reset Bundler Cache': 'Очистити кеш збирання',
  'Clears the bundler cache and restarts the dev server. Helpful if you are seeing stale errors or changes are not appearing.': 'Очищає тимчасові файли збирання та перезапускає локальний сайт. Допомагає, якщо правки не з’являються або показуються старі помилки.',
  'Reset Cache': 'Очистити кеш',
  'Open Next.js Dev Tools': 'Відкрити службову панель Next.js',
  'Close devtools panel': 'Закрити службову панель',
  'Open issues overlay': 'Переглянути повідомлення про помилки',
  'Collapse issues badge': 'Згорнути індикатор помилок',
  'Route': 'Поточна сторінка', 'Static': 'Статична', 'Dynamic': 'Динамічна',
  'Bundler': 'Збирач сайту', 'Route Info': 'Відомості про сторінку',
  'Loading...': 'Завантаження…',
  'Turbopack is enabled.': 'Сайт збирається за допомогою Turbopack.',
  'Learn about Turbopack and how to enable it in your application.': 'Дізнатися про Turbopack і його ввімкнення в проєкті.',
  'Cache Components': 'Кешування компонентів',
  'Cache Components is enabled.': 'Кешування компонентів увімкнено.',
  'Navigation Inspector': 'Перевірка переходів',
  'Test instant navigation behavior.': 'Перевірити поведінку швидких переходів між сторінками.',
  'Request Insights': 'Перегляд запитів',
  'Inspect recent App Router requests.': 'Переглянути останні запити під час переходів між сторінками.',
  'Cache': 'Кеш', 'Cache disabled': 'Кеш вимкнено', 'Cold cache': 'Кеш ще не заповнено',
  'Learn More': 'Докладніше', 'Learn more': 'Докладніше',
  'Close': 'Закрити', 'Cancel': 'Скасувати',
  'Issue': 'Помилка', 'Issues': 'Помилки', 'Insights': 'Підказки',
  'No issues': 'Помилок немає',
  'Next.js Dev Tools Items': 'Службова панель Next.js',
  'Open in editor': 'Відкрити в редакторі коду',
  'Click to open in your editor': 'Натисніть, щоб відкрити в редакторі коду',
  'Show More': 'Показати більше',
};
const file=path.join(path.dirname(packagePath),'dist/compiled/next-devtools/index.js');
const original=fs.readFileSync(file,'utf8');
// Exact quoted strings only: lowercase state keys and JavaScript identifiers stay intact.
let translated=original;
let replacements=0;
for(const [english,ukrainian] of Object.entries(translations)) {
  const source=JSON.stringify(english);
  const count=translated.split(source).length-1;
  if(count){translated=translated.split(source).join(JSON.stringify(ukrainian));replacements+=count;}
}
// This tooltip is a template literal; its state values must remain English internally.
translated=translated.replace('`Current route is ${y.staticIndicator}.`','`Поточна сторінка: ${y.staticIndicator === "static" ? "статична" : "динамічна"}.`');
// These labels are generated from state keys or templates rather than quoted display text.
translated=translated.replace('function eR(e){let[t,r]=e;return(0,z.jsx)("option",{value:r,children:t},t)}',
  'function eR(e){let[t,r]=e;return(0,z.jsx)("option",{value:r,children:({Small:"Малий",Medium:"Середній",Large:"Великий"})[t]||t},t)}');
translated=translated.replace('`${k?"Закрити":"Open"} Next.js Dev Tools`','`${k?"Закрити":"Відкрити"} службову панель Next.js`');
translated=translated.replace('`${"static"===w.staticIndicator?"Статична":"Динамічна"} Route`','`${"static"===w.staticIndicator?"Статична":"Динамічна"} сторінка`');
translated=translated.replaceAll('"Issues \\xb7 Insights"','"Помилки · Підказки"');
translated=translated.replace('`${w} ${1===w?"issue":"issues"}`','`Помилок: ${w}`');
translated=translated.replace('`${_} ${1===_?"insight":"insights"}`','`Підказок: ${_}`');
translated=translated.replace('`${t.join(" \\xb7 ")} found. Click to view details in the dev overlay.`','`${t.join(" · ")}. Натисніть, щоб переглянути подробиці.`');
if(translated!==original){
  const backup=file+'.en-original';
  if(!fs.existsSync(backup))fs.copyFileSync(file,backup);
  fs.writeFileSync(file,translated);
}
if(!translated.includes('Оберіть світле, темне або системне оформлення панелі.'))throw new Error('Development-panel translation not applied');
console.log(`Ukrainian Next.js development panel ready (${replacements} display strings replaced).`);
