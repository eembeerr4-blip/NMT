import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonText, normalizeLessonBreaks } from "./lesson-text";
import { MathText } from "../math-text";

const render = (text: string) => renderToStaticMarkup(createElement(LessonText, { text }));

describe("lesson prose rendering", () => {
  it("restores legacy paragraph breaks and renders headings, emphasis and paragraphs", () => {
    const html = render("### Тема\\n\\n**Правило** та *приклад*.\\n\\nДругий абзац.");
    expect(html).toContain('<h3');
    expect(html).toContain('<strong>Правило</strong>');
    expect(html).toContain('<em>приклад</em>');
    expect(html.match(/<p /g)).toHaveLength(2);
    expect(html).not.toContain('\\n');
    expect(html).not.toContain('###');
  });
  it("renders ordered/unordered lists and a separator semantically", () => {
    const html = render("- **Один**\n- Два\n\n3. Три\n4. Чотири\n\n---");
    expect(html).toContain('<ul');
    expect(html).toContain('<ol start="3"');
    expect(html.match(/<li>/g)).toHaveLength(4);
    expect(html).toContain('<hr');
  });
  it("preserves TeX commands while normalizing only prose breaks", () => {
    const text = "### Вектори\\n\\n$\\nabla f + \\nu + \\neq$\\n\\n$$\\frac{1}{2}$$";
    expect(normalizeLessonBreaks(text)).toContain('$\\nabla f + \\nu + \\neq$');
    const html = render(text);
    expect(html).toContain('katex');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('katex-error');
  });
  it("supports inline formulas inside bold text without block elements in paragraphs", () => {
    const html = render('**Правило $x^2$** та $y=1$.');
    expect(html).toContain('<strong>Правило <span');
    expect(html).not.toMatch(/<p[^>]*>[\s\S]*?<div/);
    expect(html).toContain('katex');
  });
  it("preserves multiline display formulas", () => {
    const html = render('$$\n\\begin{aligned}\nx&=1\\\\\ny&=2\n\\end{aligned}\n$$');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('katex-error');
  });
  it("escapes HTML, scripts and unsupported links instead of interpreting them", () => {
    const html = render('**<script>alert(1)</script>**\n\n<img src=x onerror=alert(1)>\n\n[link](javascript:alert(1))');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<a');
    expect(html).toContain('&lt;script&gt;');
  });
  it("keeps existing number-line labels attached inside lesson paragraphs", () => {
    const html = render("Інтервал: −3 ●━━━━○ 3.");
    expect(html).toContain('whitespace-nowrap align-bottom">−3 ●━━━━○ 3</span>');
  });
  it("keeps existing plain text and the default MathText contract", () => {
    expect(render('Звичайний текст.\nДругий рядок.')).toContain('Звичайний текст.\nДругий рядок.');
    const legacy = renderToStaticMarkup(createElement(MathText, { text: '**не Markdown**\\n$\\nabla f$' }));
    expect(legacy).toContain('**не Markdown**\\n');
    expect(legacy).toContain('katex');
  });
});
