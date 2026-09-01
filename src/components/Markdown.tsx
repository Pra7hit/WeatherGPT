/**
 * Minimal Markdown renderer for assistant prose.
 *
 * The model is told to answer in short prose, so the only formatting worth
 * supporting is paragraphs, simple lists, bold, italics and inline code. It
 * builds React nodes and never touches `dangerouslySetInnerHTML`, so a model
 * response cannot inject markup into the page.
 */

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(INLINE).map((piece, index) => {
    const key = `${keyPrefix}-${index}`;
    if (piece.startsWith("**") && piece.endsWith("**") && piece.length > 4) {
      return (
        <strong key={key} className="font-semibold">
          {piece.slice(2, -2)}
        </strong>
      );
    }
    if (piece.startsWith("`") && piece.endsWith("`") && piece.length > 2) {
      return (
        <code
          key={key}
          className="border-line bg-surface-2 text-accent-ink numeric rounded border px-1 py-0.5 text-[0.9em]"
        >
          {piece.slice(1, -1)}
        </code>
      );
    }
    if (piece.startsWith("*") && piece.endsWith("*") && piece.length > 2) {
      return <em key={key}>{piece.slice(1, -1)}</em>;
    }
    return <span key={key}>{piece}</span>;
  });
}

const BULLET = /^\s*([-*•])\s+/;
const NUMBERED = /^\s*(\d+)[.)]\s+/;

/** Sits at the end of the text still arriving, so a pause reads as "more coming"
 *  rather than "finished". */
function Caret() {
  return (
    <span
      aria-hidden="true"
      className="bg-accent-ink animate-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] rounded-full align-baseline"
    />
  );
}

export function Markdown({ text, caret = false }: { text: string; caret?: boolean }) {
  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className="text-body max-w-[68ch] space-y-3">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((line) => line.trim().length > 0);
        const key = `b${blockIndex}`;
        const last = blockIndex === blocks.length - 1;

        if (lines.length > 0 && lines.every((line) => BULLET.test(line))) {
          return (
            <ul key={key} className="marker:text-ink-3 list-disc space-y-1.5 pl-5">
              {lines.map((line, index) => (
                <li key={`${key}-${index}`}>
                  {inline(line.replace(BULLET, ""), `${key}-${index}`)}
                  {caret && last && index === lines.length - 1 ? <Caret /> : null}
                </li>
              ))}
            </ul>
          );
        }

        if (lines.length > 0 && lines.every((line) => NUMBERED.test(line))) {
          return (
            <ol key={key} className="marker:text-ink-3 list-decimal space-y-1.5 pl-5">
              {lines.map((line, index) => (
                <li key={`${key}-${index}`}>
                  {inline(line.replace(NUMBERED, ""), `${key}-${index}`)}
                  {caret && last && index === lines.length - 1 ? <Caret /> : null}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={key} className="whitespace-pre-wrap">
            {inline(lines.join("\n"), key)}
            {caret && last ? <Caret /> : null}
          </p>
        );
      })}
    </div>
  );
}
