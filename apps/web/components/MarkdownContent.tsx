"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

/**
 * Renders markdown from an LLM response with clean, readable typography.
 * Handles: headings, bold/italic, bullet lists, numbered lists, blockquotes, code, links.
 */
export function MarkdownContent({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // ── Headings ──────────────────────────────────────────
        h1: ({ children }) => (
          <h1 className="mb-3 mt-5 text-base font-bold text-text first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-4 text-sm font-bold text-text first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1.5 mt-3 text-sm font-semibold text-text first:mt-0">{children}</h3>
        ),

        // ── Paragraphs ────────────────────────────────────────
        p: ({ children }) => (
          <p className="mb-3 text-sm leading-7 text-text last:mb-0">{children}</p>
        ),

        // ── Lists ─────────────────────────────────────────────
        ul: ({ children }) => (
          <ul className="mb-3 space-y-1 pl-5 text-sm text-text last:mb-0"
            style={{ listStyleType: "disc" }}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 space-y-1 pl-5 text-sm text-text last:mb-0"
            style={{ listStyleType: "decimal" }}>
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-6 text-text">{children}</li>
        ),

        // ── Inline formatting ─────────────────────────────────
        strong: ({ children }) => (
          <strong className="font-semibold text-text">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-text">{children}</em>
        ),

        // ── Blockquote ────────────────────────────────────────
        blockquote: ({ children }) => (
          <blockquote
            className="my-3 border-l-2 pl-3 text-sm italic"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            {children}
          </blockquote>
        ),

        // ── Code ──────────────────────────────────────────────
        code: ({ children, className }) => {
          const isBlock = className?.startsWith("language-");
          return isBlock ? (
            <code
              className="block overflow-x-auto rounded-lg p-3 text-xs"
              style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "monospace" }}
            >
              {children}
            </code>
          ) : (
            <code
              className="rounded px-1 py-0.5 text-xs"
              style={{
                background: "rgba(28,28,26,0.08)",
                color: "var(--text)",
                fontFamily: "monospace",
              }}
            >
              {children}
            </code>
          );
        },

        // ── Horizontal rule ───────────────────────────────────
        hr: () => (
          <hr className="my-4" style={{ borderColor: "var(--border)" }} />
        ),

        // ── Links ─────────────────────────────────────────────
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted hover:opacity-80"
            style={{ color: "var(--good)" }}
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
