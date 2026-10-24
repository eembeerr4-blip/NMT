import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MathText } from "./math-text";

const render = (text: string) => renderToStaticMarkup(createElement(MathText, { text }));

describe("Unicode number lines", () => {
  it.each(["−3 ●━━━━▶", "◀━━━━○ 5", "−8 ●━━━━▶", "−3 ●━━━━○ 3", "−1 ○━━━━● 3"])("keeps labels and markers together: %s", (diagram) => {
    const html = render(`Інтервал; схема: ${diagram}.\nПеревірка.`);
    expect(html).toContain(`class="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom">${diagram}</span>`);
    expect(html).toContain("Інтервал; схема: ");
    expect(html).toContain(".\nПеревірка.");
  });

  it("preserves ordinary prose, inequalities, escaping and KaTeX", () => {
    const html = render("x < 3\n<script>alert(1)</script>\n$x^2$\n$$x=3$$");
    expect(html).toContain("x &lt; 3\n&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("whitespace-nowrap");
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
  });
});
