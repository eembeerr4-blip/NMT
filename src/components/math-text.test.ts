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


describe("shared KaTeX formula boundaries", () => {
  it("separates inline math from display sizing without wrapping prose", () => {
    const html = render("Відсоток: $p\\%\\ \\text{від}\\ A = A \\cdot \\dfrac{p}{100}$. $$x=3$$");
    expect(html).toContain('class="math-formula math-formula-inline"');
    expect(html).toContain('class="math-formula math-formula-display"');
    expect(html).toContain("Відсоток: ");
    expect(html.match(/class="math-formula /g)).toHaveLength(2);
  });

  it("keeps the inline host valid when a paragraph contains display math", () => {
    const html = renderToStaticMarkup(createElement(MathText, { text: "$$x=3$$", inline: true }));
    expect(html).toContain('<span class="math-formula math-formula-display"');
    expect(html).not.toContain("<div");
    expect(html).toContain('class="katex-display"');
  });
});
