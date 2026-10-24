import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/server/actions", () => ({ logout: vi.fn() }));

import { ProfileMenu } from "./profile-menu";

it("renders closed profile menu trigger for keyboard and screen readers", () => {
  const html = renderToStaticMarkup(
    jsx(ProfileMenu, { name: "Тест", isAdmin: true, isOwner: true, isEditor: false }),
  );
  expect(html).toContain('aria-label="Меню профілю"');
  expect(html).toContain('aria-haspopup="menu"');
  expect(html).toContain("Тест");
});
