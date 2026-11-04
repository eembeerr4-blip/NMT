import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ preview: vi.fn(), import: vi.fn() }));
vi.mock("@/server/content-import", () => ({ previewContentPackage: actions.preview, importContentPackage: actions.import }));
import { ContentImportForm } from "./content-import-form";
const render = () => renderToStaticMarkup(createElement(ContentImportForm));
beforeEach(() => vi.clearAllMocks());

it("presents the three steps in their execution order", () => {
  const html = render();
  const first = html.indexOf("Крок 1. Оберіть файл");
  const second = html.indexOf("Крок 2. Перевірте пакет");
  const third = html.indexOf("Крок 3. Імпортуйте матеріали");
  expect(first).toBeGreaterThan(-1); expect(second).toBeGreaterThan(first); expect(third).toBeGreaterThan(second);
});

it("keeps a labeled native JSON input and a keyboard-operable chooser", () => {
  const html = render();
  const input = html.match(/<input\b[^>]*type="file"[^>]*>/)?.[0] ?? "";
  const id = input.match(/\bid="([^"]+)"/)?.[1];
  expect(id).toBeTruthy(); expect(html).toContain(`for="${id}"`);
  expect(input).toContain('accept="application/json,.json"');
  expect(html).toContain("Обрати JSON-файл"); expect(html).toContain("максимум 2 МБ");
});

it("blocks preview and import initially and explains how to unlock them", () => {
  const html = render();
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  for (const text of ["Перевірити пакет", "Імпортувати як чернетки"]) {
    const button = buttons.find((match) => match[2].includes(text));
    expect(button, text).toBeTruthy(); expect(button![1]).toContain('disabled=""');
    expect(button![1]).toContain("aria-describedby=");
  }
  expect(html).toContain("Кнопка стане доступною після вибору файлу.");
  expect(html).toContain("Спочатку оберіть JSON-файл у кроці 1.");
  expect(html).toContain("Чернетки не доступні учням до публікації");
});

it("never invokes server actions or reports successful import just by rendering", () => {
  const html = render();
  expect(actions.preview).not.toHaveBeenCalled(); expect(actions.import).not.toHaveBeenCalled();
  expect(html).not.toContain('role="alertdialog"');
  expect(html).not.toContain("Матеріали імпортовано як чернетки");
});
