import katex from "katex";

export function MathText({ text, className = "", inline = false }: { text: string; className?: string; inline?: boolean }) {
  const Tag = inline ? "span" : "div";
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return (
    <Tag className={`math-text whitespace-pre-wrap leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          const html = katex.renderToString(part.slice(2, -2), { throwOnError: false, displayMode: true });
          return inline ? <span key={index} dangerouslySetInnerHTML={{ __html: html }} /> : <div key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        if (part.startsWith("$") && part.endsWith("$")) {
          const html = katex.renderToString(part.slice(1, -1), { throwOnError: false, displayMode: false });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        // Keep Unicode number-line labels attached to their markers, without
        // disabling wrapping for the surrounding explanation or changing data.
        const diagrams = part.split(/([−-]?\d+(?:[.,]\d+)?[ \t]+[●○][━─]+(?:[●○][ \t]+[−-]?\d+(?:[.,]\d+)?|[▶►→])|[◀◄←][━─]+[●○][ \t]+[−-]?\d+(?:[.,]\d+)?)/g);
        return <span key={index}>{diagrams.map((fragment, diagramIndex) =>
          diagramIndex % 2 === 1
            ? <span key={diagramIndex} className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom">{fragment}</span>
            : fragment
        )}</span>;
      })}
    </Tag>
  );
}
