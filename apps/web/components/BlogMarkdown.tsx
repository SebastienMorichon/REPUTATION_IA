"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugifyHeading } from "@/lib/utils";

interface Props {
  content: string;
}

export function BlogMarkdown({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => {
          const id = slugifyHeading(String(children));
          return (
            <h2
              id={id}
              className="mt-10 mb-4 scroll-mt-28 text-2xl font-bold text-text leading-snug"
            >
              {children}
            </h2>
          );
        },
        h3: ({ children }) => {
          const id = slugifyHeading(String(children));
          return (
            <h3
              id={id}
              className="mt-8 mb-3 scroll-mt-28 text-lg font-semibold text-text leading-snug"
            >
              {children}
            </h3>
          );
        },
        p: ({ children }) => (
          <p className="my-5 text-[15.5px] leading-[1.85] text-text/90">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-text">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-text/80">{children}</em>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent transition-colors"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="my-5 space-y-2 pl-6">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-5 space-y-2 pl-6 list-decimal">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-[15px] leading-relaxed text-text/90 marker:text-accent marker:font-bold">
            {children}
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-6 border-l-[3px] border-accent bg-card pl-5 py-3 pr-4 rounded-r-xl italic text-muted text-[15px] leading-relaxed">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => {
          const isBlock = Boolean(className?.includes("language-"));
          if (isBlock) {
            return (
              <pre className="my-6 overflow-x-auto rounded-xl bg-card border border-border p-5">
                <code className="text-[13px] leading-relaxed text-text font-mono">
                  {children}
                </code>
              </pre>
            );
          }
          return (
            <code className="rounded-md bg-card border border-border px-1.5 py-0.5 font-mono text-[13px] text-accent">
              {children}
            </code>
          );
        },
        hr: () => <hr className="my-10 border-border" />,
        table: ({ children }) => (
          <div className="my-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-card border-b border-border">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border px-4 py-2.5 text-[13px] text-text/90 last:border-0">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
