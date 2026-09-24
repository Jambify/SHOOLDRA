// src/lib/utils/renderQuestionText.tsx
import "../katex-styles";
import React from "react";
import katex from "katex";
import { formatScienceText, SCIENCE_SUBJECTS } from "./formatScienceText";

/**
 * Unified question/option text renderer. Handles THREE distinct things,
 * applied in this order so they don't collide:
 *
 * 1. Real LaTeX ($$...$$ display math, $...$ inline math) → rendered via
 *    KaTeX. Extracted FIRST so the Unicode-subscript regex below never
 *    touches raw LaTeX source (which would corrupt it — e.g. turning
 *    digits inside "10^{-2}" into stray Unicode superscripts).
 * 2. Chemistry/Physics/Math plain-text formulas (CnH2n, H2O, m/s2, etc.)
 *    → Unicode subscripts/superscripts/arrows via formatScienceText.ts.
 *    Only applied to the NON-LaTeX portions of the string.
 * 3. [bracket] → underline, ENGLISH ONLY. Other subjects use [brackets]
 *    for given-data annotations (e.g. "[g = 10 m/s²]"), not underlining,
 *    so this step is skipped entirely for non-English subjects.
 *
 * Usage: <p>{renderQuestionText(question.text, question.subject)}</p>
 *
 * Security note: same as ExplanationText.tsx — KaTeX runs with
 * trust: false, which disables HTML/URL-embedding LaTeX commands
 * (\href, \url, \includegraphics), used here instead of a DOMPurify
 * pass since KaTeX's output is dense with span/svg markup that a
 * generic allowlist would strip.
 */

function renderMathToHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      strict: "ignore",
      trust: false,
      displayMode,
    });
  } catch {
    return latex; // fall back to raw LaTeX text if KaTeX itself throws
  }
}

/** Renders the non-LaTeX portions: science-subject Unicode formatting,
 * then (English only) [bracket] -> underline. */
function renderPlainSegment(
  segment: string,
  subject: string | undefined,
  keyPrefix: string,
): React.ReactNode[] {
  const prepared =
    subject && SCIENCE_SUBJECTS.includes(subject)
      ? formatScienceText(segment)
      : segment;

  // Non-English subjects never get bracket->underline treatment
  if (subject && subject !== "English") {
    return [<React.Fragment key={keyPrefix}>{prepared}</React.Fragment>];
  }

  // Split on BOTH <u>...</u> AND [brackets]
  const parts = prepared.split(/(<u>[^<]*<\/u>|\[[^\[\]]+\])/g);
  return parts.map((part, i) => {
    // Handle <u>word</u>
    const uMatch = part.match(/^<u>([^<]*)<\/u>$/);
    if (uMatch) {
      return (
        <span
          key={`${keyPrefix}-${i}`}
          className="underline decoration-2 underline-offset-2"
        >
          {uMatch[1]}
        </span>
      );
    }
    // Handle [bracket]
    const bracketMatch = part.match(/^\[([^\[\]]+)\]$/);
    if (bracketMatch) {
      return (
        <span
          key={`${keyPrefix}-${i}`}
          className="underline decoration-2 underline-offset-2"
        >
          {bracketMatch[1]}
        </span>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}
export function renderQuestionText(text: string, subject?: string): React.ReactNode[] {
  // Fast path: no "$" at all means no LaTeX, skip straight to the
  // existing plain-text pipeline (this covers the vast majority of rows).
  if (!text.includes("$")) {
    return renderPlainSegment(text, subject, "seg");
  }

  // Split on $$...$$ (display) and $...$ (inline), keeping surrounding
  // plain text intact. $$...$$ must be checked before $...$ in the
  // regex alternation, or a naive $...$ pattern would incorrectly match
  // INSIDE a $$...$$ block.
  const chunks = text.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);

  return chunks.reduce<React.ReactNode[]>((acc, chunk, i) => {
    if (chunk.startsWith("$$") && chunk.endsWith("$$") && chunk.length > 4) {
      const html = renderMathToHtml(chunk.slice(2, -2), true);
      return acc.concat([<span key={`math-${i}`} dangerouslySetInnerHTML={{ __html: html }} />]);
    }
    if (chunk.startsWith("$") && chunk.endsWith("$") && chunk.length > 2) {
      const html = renderMathToHtml(chunk.slice(1, -1), false);
      return acc.concat([<span key={`math-${i}`} dangerouslySetInnerHTML={{ __html: html }} />]);
    }
    // Non-LaTeX chunk — run through the existing Unicode/bracket pipeline
    return acc.concat(renderPlainSegment(chunk, subject, `seg-${i}`));
  }, []);
}