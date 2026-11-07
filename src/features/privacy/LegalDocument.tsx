import type { ReactNode } from "react";
import { type LegalBlock, type LegalLine, parseLegalMarkdown } from "@/engine/legal-markdown";
import { type LegalDocumentName, readLegalDocument } from "@/features/privacy/legal-documents";

function Inline({ line }: { line: LegalLine }) {
  return line.map((part, index) =>
    part.kind === "link" ? (
      <a key={index} href={part.href} className="break-words text-gold underline underline-offset-2 hover:text-gold-light">
        {part.text}
      </a>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}

function Lines({ lines }: { lines: LegalLine[] }) {
  return lines.map((line, index) => (
    <span key={index} className="block">
      <Inline line={line} />
    </span>
  ));
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "heading":
      return block.level === 3 ? (
        <h3 className="pt-2 font-semibold">
          <Inline line={block.text} />
        </h3>
      ) : (
        <h2 className="font-display text-xl font-semibold">
          <Inline line={block.text} />
        </h2>
      );
    case "paragraph":
      return (
        <p className="text-ink-soft">
          <Lines lines={block.lines} />
        </p>
      );
    case "list":
      return (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-soft">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline line={item} />
            </li>
          ))}
        </ul>
      );
    case "notice":
      return (
        <p className="rounded-2xl border border-gold/60 bg-gold/10 p-4 text-sm font-semibold text-gold">
          <Lines lines={block.lines} />
        </p>
      );
    case "table":
      // Une fiche par ligne, lisible sur téléphone sans défilement horizontal.
      return (
        <div className="flex flex-col gap-3">
          {block.rows.map((row, rowIndex) => (
            <dl key={rowIndex} className="flex flex-col gap-2 rounded-2xl border border-gold/15 bg-abyss/30 p-4">
              {row.map((cell, cellIndex) => (
                <div key={cellIndex} className="flex flex-col">
                  <dt className="text-sm font-semibold">
                    <Inline line={block.head[cellIndex] ?? []} />
                  </dt>
                  <dd className="text-ink-soft">
                    <Inline line={cell} />
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      );
  }
}

/** Document juridique du kit : le titre, la version, puis une carte par rubrique. */
export function LegalDocument({ name }: { name: LegalDocumentName }) {
  const blocks = parseLegalMarkdown(readLegalDocument(name));
  const intro: LegalBlock[] = [];
  const sections: { heading: LegalBlock; body: LegalBlock[] }[] = [];
  let title: LegalLine = [];

  for (const block of blocks) {
    if (block.kind === "heading" && block.level === 1) title = block.text;
    else if (block.kind === "heading" && block.level === 2) sections.push({ heading: block, body: [] });
    else (sections.at(-1)?.body ?? intro).push(block);
  }

  const render = (list: LegalBlock[]): ReactNode => list.map((block, index) => <Block key={index} block={block} />);

  return (
    <>
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-semibold">
          <Inline line={title} />
        </h1>
        {render(intro)}
      </section>
      {sections.map((section, index) => (
        <section key={index} className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
          <Block block={section.heading} />
          {render(section.body)}
        </section>
      ))}
    </>
  );
}
