import { createElement, type ReactNode } from "react";
import { MathText } from "@/components/math-text";

// Older packages escaped paragraph breaks twice. Normalize prose only: TeX
// commands such as \nabla and \nu inside math delimiters must stay untouched.
export function normalizeLessonBreaks(text: string) {
  return text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g)
    .map((part, index) => index % 2 ? part : part.replace(/\\n/g, "\n"))
    .join("");
}

function inlineText(text: string): ReactNode {
  return text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*]+?\*\*|\*[^*\n]+?\*)/g).map((part, index) => {
    if (part.startsWith("$") && part.endsWith("$")) return <MathText key={index} text={part} inline />;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{inlineText(part.slice(2, -2))}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{inlineText(part.slice(1, -1))}</em>;
    return /[●○][━─]|[◀◄←][━─]/.test(part) ? <MathText key={index} text={part} inline /> : part;
  });
}

const heading = /^(#{1,6})\s+(.+)$/;
const bullet = /^\s*[-*]\s+(.+)$/;
const ordered = /^\s*\d+[.)]\s+(.+)$/;
const rule = /^\s*---+\s*$/;
const startsBlock = (line: string) => heading.test(line) || bullet.test(line) || ordered.test(line) || rule.test(line) || line.trimStart().startsWith("$$");

/** A small, HTML-free subset of Markdown for lesson prose, alongside KaTeX. */
export function LessonText({ text, className = "" }: { text: string; className?: string }) {
  const lines = normalizeLessonBreaks(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const key = index;
    const title = line.match(heading);
    if (title) {
      blocks.push(createElement(`h${Math.max(2, title[1].length)}`, { key, className: "mt-6 mb-3 text-lg font-semibold" }, inlineText(title[2])));
      index++; continue;
    }
    if (rule.test(line)) { blocks.push(<hr key={key} className="my-4 border-border" />); index++; continue; }
    if (line.trimStart().startsWith("$$")) {
      const formula = [line]; index++;
      while ((formula.join("\n").match(/\$\$/g)?.length ?? 0) < 2 && index < lines.length) formula.push(lines[index++]);
      blocks.push(<MathText key={key} text={formula.join("\n")} />); continue;
    }
    const listPattern = bullet.test(line) ? bullet : ordered.test(line) ? ordered : null;
    if (listPattern) {
      const items: ReactNode[] = [];
      const firstNumber = listPattern === ordered ? Number(line.trim().match(/^\d+/)?.[0]) : undefined;
      while (index < lines.length) {
        const item = lines[index].match(listPattern);
        if (!item) break;
        items.push(<li key={index++}>{inlineText(item[1])}</li>);
      }
      blocks.push(listPattern === bullet
        ? <ul key={key} className="my-3 list-disc space-y-2 pl-6">{items}</ul>
        : <ol key={key} start={firstNumber} className="my-3 list-decimal space-y-2 pl-6">{items}</ol>);
      continue;
    }
    const paragraph = [line]; index++;
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={key} className="my-3 whitespace-pre-wrap">{inlineText(paragraph.join("\n"))}</p>);
  }
  return <div className={`min-w-0 break-words leading-relaxed ${className}`}>{blocks}</div>;
}
