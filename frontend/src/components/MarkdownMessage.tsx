'use client';

import React from 'react';
import { Info, Lightbulb, AlertTriangle, Sparkles } from 'lucide-react';

// Lightweight markdown renderer for AI assistant replies. Covers the subset
// the model is instructed to use — headings, bold/italic/inline code, bullet
// and numbered lists, tables, blockquotes, colored callouts, ==highlights==,
// dividers — without an external markdown dependency, styled with the
// editorial design tokens.

type CalloutVariant = 'key' | 'note' | 'tip' | 'warning';

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'callout'; variant: CalloutVariant; lines: string[] }
  | { kind: 'divider' };

const CALLOUT_MARKER_RE = /^\[!(\w+)\]\s*/;

const CALLOUT_VARIANTS: Record<string, CalloutVariant> = {
  KEY: 'key', IMPORTANT: 'key', TAKEAWAY: 'key',
  NOTE: 'note', INFO: 'note', PEARL: 'note',
  TIP: 'tip', HINT: 'tip', MNEMONIC: 'tip',
  WARNING: 'warning', CAUTION: 'warning', DANGER: 'warning',
};

const BULLET_RE = /^[-*•]\s+(.*)$/;
const ORDERED_RE = /^\d+[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const DIVIDER_RE = /^[-*_]{3,}$/;

const isTableRow = (line: string) => /^\|.*\|$/.test(line);
const isTableSeparator = (line: string) => /^\|?[\s:|-]+\|?$/.test(line) && line.includes('-');
const splitRow = (line: string) =>
  line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) { i++; continue; }

    // Blockquote / callout: consecutive lines starting with ">"
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const firstContent = quoteLines.find(l => l.trim()) || '';
      const marker = firstContent.match(CALLOUT_MARKER_RE);
      const variant = marker ? CALLOUT_VARIANTS[marker[1].toUpperCase()] : undefined;
      if (variant) {
        const contentLines = quoteLines
          .map(l => l.replace(CALLOUT_MARKER_RE, ''))
          .filter(l => l.trim());
        blocks.push({ kind: 'callout', variant, lines: contentLines });
      } else {
        blocks.push({ kind: 'quote', lines: quoteLines.filter(l => l.trim()) });
      }
      continue;
    }

    // Table: a | row | followed by a |---|---| separator row
    if (
      isTableRow(trimmed) &&
      i + 1 < lines.length &&
      isTableRow(lines[i + 1].trim()) &&
      isTableSeparator(lines[i + 1].trim())
    ) {
      const header = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        rows.push(splitRow(lines[i].trim()));
        i++;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].replace(/\*\*/g, '') });
      i++;
      continue;
    }

    if (DIVIDER_RE.test(trimmed)) {
      blocks.push({ kind: 'divider' });
      i++;
      continue;
    }

    if (BULLET_RE.test(trimmed) || ORDERED_RE.test(trimmed)) {
      const ordered = ORDERED_RE.test(trimmed);
      const itemRe = ordered ? ORDERED_RE : BULLET_RE;
      const items: string[] = [];
      while (i < lines.length) {
        const match = lines[i].trim().match(itemRe);
        if (!match) break;
        items.push(match[1]);
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    // Paragraph: accumulate consecutive plain lines
    const para: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next.startsWith('>') ||
        HEADING_RE.test(next) ||
        BULLET_RE.test(next) ||
        ORDERED_RE.test(next) ||
        DIVIDER_RE.test(next) ||
        isTableRow(next)
      ) break;
      para.push(next);
      i++;
    }
    blocks.push({ kind: 'paragraph', text: para.join('\n') });
  }

  return blocks;
}

// Inline formatting: **bold**, ==highlight==, *italic*, `code`, plus
// auto-colored ↑/↓ flags so abnormal lab values read at a glance.
const INLINE_RE = /(\*\*[^*]+\*\*|==[^=\n]+==|\*[^*\n]+\*|`[^`]+`)/g;

function renderFlags(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/([↑↓])/).filter(Boolean).map((seg, idx) => {
    const key = `${keyPrefix}-f${idx}`;
    if (seg === '↑') return <span key={key} className="text-red-600 font-semibold">↑</span>;
    if (seg === '↓') return <span key={key} className="text-[var(--color-blue-primary)] font-semibold">↓</span>;
    return <span key={key}>{seg}</span>;
  });
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(INLINE_RE).filter(Boolean).map((seg, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
      return <strong key={key} className="font-semibold text-[var(--color-text-primary)]">{renderFlags(seg.slice(2, -2), key)}</strong>;
    }
    if (seg.startsWith('==') && seg.endsWith('==') && seg.length > 4) {
      return (
        <mark key={key} className="px-1 py-0.5 rounded bg-[var(--color-accent-soft)] text-[var(--color-navy)] font-medium">
          {seg.slice(2, -2)}
        </mark>
      );
    }
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
      return (
        <code key={key} className="px-1 py-0.5 rounded bg-[var(--color-surface-muted)] border border-[var(--color-border-light)] font-mono text-[0.85em]">
          {seg.slice(1, -1)}
        </code>
      );
    }
    if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2) {
      return <em key={key}>{seg.slice(1, -1)}</em>;
    }
    return <React.Fragment key={key}>{renderFlags(seg, key)}</React.Fragment>;
  });
}

const CALLOUT_STYLES: Record<CalloutVariant, {
  label: string;
  Icon: typeof Info;
  box: string;
  accent: string;
}> = {
  key: {
    label: 'Key point',
    Icon: Sparkles,
    box: 'border-[var(--color-navy)] bg-[var(--color-surface-muted)]',
    accent: 'text-[var(--color-navy)]',
  },
  note: {
    label: 'Note',
    Icon: Info,
    box: 'border-[var(--color-blue-primary)] bg-[var(--color-accent-soft)]/50',
    accent: 'text-[var(--color-blue-primary)]',
  },
  tip: {
    label: 'Study tip',
    Icon: Lightbulb,
    box: 'border-emerald-500 bg-emerald-50/70',
    accent: 'text-emerald-700',
  },
  warning: {
    label: 'Caution',
    Icon: AlertTriangle,
    box: 'border-amber-500 bg-amber-50/80',
    accent: 'text-amber-700',
  },
};

export default function MarkdownMessage({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);

  return (
    <div className="text-sm leading-relaxed space-y-2.5 min-w-0">
      {blocks.map((block, bi) => {
        switch (block.kind) {
          case 'heading':
            return (
              <p
                key={bi}
                className={
                  block.level <= 2
                    ? 'text-[15px] font-semibold text-[var(--color-navy)] tracking-tight pt-1'
                    : 'font-semibold text-[var(--color-text-primary)] pt-0.5'
                }
              >
                {renderInline(block.text, `h${bi}`)}
              </p>
            );

          case 'divider':
            return <hr key={bi} className="border-[var(--color-border-light)]" />;

          case 'quote':
            return (
              <blockquote
                key={bi}
                className="border-l-2 border-[var(--color-border-mid)] pl-3 py-0.5 space-y-1 text-[var(--color-text-secondary)]"
              >
                {block.lines.map((line, li) => (
                  <p key={li}>{renderInline(line, `q${bi}-${li}`)}</p>
                ))}
              </blockquote>
            );

          case 'callout': {
            const { label, Icon, box, accent } = CALLOUT_STYLES[block.variant];
            return (
              <div key={bi} className={`rounded-xl border-l-[3px] px-3.5 py-2.5 ${box}`}>
                <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] mb-1 ${accent}`}>
                  <Icon className="w-3.5 h-3.5" strokeWidth={2} /> {label}
                </p>
                <div className="space-y-1 text-[var(--color-text-primary)]">
                  {block.lines.map((line, li) => (
                    <p key={li}>{renderInline(line, `c${bi}-${li}`)}</p>
                  ))}
                </div>
              </div>
            );
          }

          case 'list':
            return block.ordered ? (
              <ol key={bi} className="list-decimal pl-5 space-y-1 marker:text-[var(--color-text-muted)] marker:font-medium">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item, `l${bi}-${ii}`)}</li>
                ))}
              </ol>
            ) : (
              <ul key={bi} className="list-disc pl-5 space-y-1 marker:text-[var(--color-blue-primary)]">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item, `l${bi}-${ii}`)}</li>
                ))}
              </ul>
            );

          case 'table':
            return (
              <div key={bi} className="overflow-x-auto rounded-xl border border-[var(--color-border-light)] bg-white">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-[var(--color-surface-muted)]">
                      {block.header.map((cell, ci) => (
                        <th
                          key={ci}
                          className="text-left font-semibold text-[var(--color-text-primary)] px-3 py-2 border-b border-[var(--color-border-light)] whitespace-nowrap"
                        >
                          {renderInline(cell, `t${bi}-h${ci}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="[&>tr:last-child>td]:border-b-0">
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 1 ? 'bg-[var(--color-surface-muted)]/60' : ''}>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="px-3 py-1.5 align-top border-b border-[var(--color-border-light)] text-[var(--color-text-secondary)]"
                          >
                            {renderInline(cell, `t${bi}-${ri}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          default:
            return (
              <p key={bi} className="whitespace-pre-wrap">
                {renderInline(block.text, `p${bi}`)}
              </p>
            );
        }
      })}
    </div>
  );
}
