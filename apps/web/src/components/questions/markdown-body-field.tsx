"use client";

import { useCallback, useRef } from "react";

type MarkdownBodyFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

function restoreCaret(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
) {
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const top = textarea.scrollTop;
    textarea.scrollTop = top;
  });
}

export function MarkdownBodyField({
  id,
  value,
  onChange,
  placeholder,
  rows = 10,
}: MarkdownBodyFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyEdit = useCallback(
    (edit: (text: string, start: number, end: number) => { next: string; selStart: number; selEnd: number }) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const { next, selStart, selEnd } = edit(value, start, end);
      onChange(next);
      restoreCaret(el, selStart, selEnd);
    },
    [onChange, value],
  );

  const toolButtonClass =
    "rounded px-2 py-1.5 text-xs font-semibold text-[var(--text-strong)] transition-colors hover:bg-white/10";

  return (
    <div className="overflow-hidden rounded-lg border border-white/15 bg-[#15171C]">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-white/10 px-2 py-1.5">
        <button
          type="button"
          className={toolButtonClass}
          title="Bold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const inner = sel.length ? sel : "bold";
              const ins = `**${inner}**`;
              const next = text.slice(0, start) + ins + text.slice(end);
              const pad = 2;
              if (sel.length) {
                return { next, selStart: start + pad, selEnd: start + pad + sel.length };
              }
              return { next, selStart: start + pad, selEnd: start + pad + inner.length };
            })
          }
        >
          B
        </button>
        <button
          type="button"
          className={`${toolButtonClass} italic`}
          title="Italic"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const inner = sel.length ? sel : "italic";
              const ins = `*${inner}*`;
              const next = text.slice(0, start) + ins + text.slice(end);
              if (sel.length) {
                return { next, selStart: start + 1, selEnd: start + 1 + sel.length };
              }
              return { next, selStart: start + 1, selEnd: start + 1 + inner.length };
            })
          }
        >
          I
        </button>
        <button
          type="button"
          className={toolButtonClass}
          title="Heading 1"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const line = sel.length ? sel : "Heading";
              const ins = `# ${line}\n`;
              const next = text.slice(0, start) + ins + text.slice(end);
              const innerLen = sel.length ? sel.length : "Heading".length;
              return {
                next,
                selStart: start + 2,
                selEnd: start + 2 + innerLen,
              };
            })
          }
        >
          H1
        </button>
        <button
          type="button"
          className={toolButtonClass}
          title="Heading 2"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const line = sel.length ? sel : "Heading";
              const ins = `## ${line}\n`;
              const next = text.slice(0, start) + ins + text.slice(end);
              const innerLen = sel.length ? sel.length : "Heading".length;
              return {
                next,
                selStart: start + 3,
                selEnd: start + 3 + innerLen,
              };
            })
          }
        >
          H2
        </button>
        <button
          type="button"
          className={toolButtonClass}
          title="Blockquote"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const block = sel.length ? sel : "Quote";
              const quoted = block
                .split("\n")
                .map((line) => `> ${line}`)
                .join("\n");
              const ins = `${quoted}\n`;
              const next = text.slice(0, start) + ins + text.slice(end);
              if (sel.length) {
                return { next, selStart: start + 2, selEnd: start + 2 + sel.split("\n")[0].length };
              }
              return { next, selStart: start + 2, selEnd: start + 2 + block.length };
            })
          }
        >
          “
        </button>
        <button
          type="button"
          className={toolButtonClass}
          title="Link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const label = sel.length ? sel : "link text";
              const url =
                typeof window !== "undefined"
                  ? window.prompt("URL", "https://")
                  : null;
              if (url === null) {
                return { next: text, selStart: start, selEnd: end };
              }
              const safeUrl = url.trim() || "https://";
              const ins = `[${label}](${safeUrl})`;
              const next = text.slice(0, start) + ins + text.slice(end);
              return { next, selStart: start, selEnd: start + ins.length };
            })
          }
        >
          Link
        </button>
        <button
          type="button"
          className={toolButtonClass}
          title="Image"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const alt = sel.length ? sel : "description";
              const url =
                typeof window !== "undefined"
                  ? window.prompt("Image URL", "https://")
                  : null;
              if (url === null) {
                return { next: text, selStart: start, selEnd: end };
              }
              const safeUrl = url.trim() || "https://";
              const ins = `![${alt}](${safeUrl})`;
              const next = text.slice(0, start) + ins + text.slice(end);
              return { next, selStart: start, selEnd: start + ins.length };
            })
          }
        >
          Img
        </button>
        <button
          type="button"
          className={toolButtonClass}
          title="Bulleted list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const block = sel.length ? sel : "Item";
              const lines = block.split("\n");
              const listed = lines.map((line) => `- ${line}`).join("\n");
              const ins = `${listed}\n`;
              const next = text.slice(0, start) + ins + text.slice(end);
              return { next, selStart: start + 2, selEnd: start + 2 + lines[0].length };
            })
          }
        >
          • List
        </button>
        <button
          type="button"
          className={toolButtonClass}
          title="Numbered list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const block = sel.length ? sel : "Item";
              const lines = block.split("\n");
              const listed = lines
                .map((line, i) => `${i + 1}. ${line}`)
                .join("\n");
              const ins = `${listed}\n`;
              const next = text.slice(0, start) + ins + text.slice(end);
              const firstLinePrefix = "1. ";
              return {
                next,
                selStart: start + firstLinePrefix.length,
                selEnd: start + firstLinePrefix.length + lines[0].length,
              };
            })
          }
        >
          1. List
        </button>
        <button
          type="button"
          className={`${toolButtonClass} font-mono text-[11px]`}
          title="Code block"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            applyEdit((text, start, end) => {
              const sel = text.slice(start, end);
              const inner = sel.length ? sel : "code";
              const ins = `\`\`\`\n${inner}\n\`\`\`\n`;
              const next = text.slice(0, start) + ins + text.slice(end);
              const fence = "```\n";
              if (sel.length) {
                return {
                  next,
                  selStart: start + fence.length,
                  selEnd: start + fence.length + sel.length,
                };
              }
              return {
                next,
                selStart: start + fence.length,
                selEnd: start + fence.length + inner.length,
              };
            })
          }
        >
          {"{ }"}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="min-h-[200px] w-full resize-y bg-[#15171C] px-4 py-3 text-sm leading-6 text-[var(--text-strong)] placeholder:text-[#7f8797] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50"
      />
    </div>
  );
}
