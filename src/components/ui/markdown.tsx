"use client";

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";

function RawSvg({ html }: { html: string }) {
  return (
    <div
      className="my-6 flex justify-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:overflow-visible"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Pattern to match structural code references like "ASCE 7-16 §27.3.2", "ACI 318-19 §22.2", "AISC 360 §D2", etc.
const CODE_REF_PATTERN =
  /\b((?:ASCE|ACI|AISC|NDS|TMS|IBC|AASHTO|AWS|PCI|SDI)\s*[\d./-]*)\s*(?:§|Section\s*|Sec\.?\s*)([\d.]+(?:\.\d+)*(?:\.\d+)*)/g;

function linkifyCodeRefs(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(CODE_REF_PATTERN.source, CODE_REF_PATTERN.flags);

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const fullMatch = match[0];
    const searchQuery = fullMatch.replace(/§/g, "").trim();
    parts.push(
      <a
        key={match.index}
        href={`/references?q=${encodeURIComponent(searchQuery)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary cursor-pointer"
        title={`Search references: ${searchQuery}`}
      >
        {fullMatch}
      </a>,
    );
    lastIndex = match.index + fullMatch.length;
  }

  if (parts.length === 0) return [text];
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// SVG elements that may leak through rehypeRaw outside of an <svg> wrapper
// (e.g. from AI-generated content or streaming chunks). These are already
// handled by RawSvg via dangerouslySetInnerHTML when properly wrapped,
// so we suppress them here to avoid React DOM warnings.
const svgPassthrough = () => null;
const svgElementOverrides: Partial<Components> = Object.fromEntries(
  [
    "svg",
    "text",
    "defs",
    "marker",
    "polygon",
    "polyline",
    "line",
    "rect",
    "circle",
    "ellipse",
    "path",
    "g",
    "use",
    "symbol",
    "clipPath",
    "linearGradient",
    "radialGradient",
    "stop",
    "pattern",
    "mask",
    "foreignObject",
    "image",
    "tspan",
  ].map((tag) => [tag, svgPassthrough]),
);

const markdownComponents: Components = {
  // Suppress SVG elements that leak through rehypeRaw
  ...svgElementOverrides,
  // Override text rendering inside paragraphs, list items, etc.
  p: ({ children, ...props }) => <p {...props}>{processChildren(children)}</p>,
  li: ({ children, ...props }) => (
    <li {...props}>{processChildren(children)}</li>
  ),
  td: ({ children, ...props }) => (
    <td {...props}>{processChildren(children)}</td>
  ),
  strong: ({ children, ...props }) => (
    <strong {...props}>{processChildren(children)}</strong>
  ),
  em: ({ children, ...props }) => (
    <em {...props}>{processChildren(children)}</em>
  ),
};

function processChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      const linked = linkifyCodeRefs(child);
      return linked.length === 1 && typeof linked[0] === "string"
        ? child
        : React.createElement(React.Fragment, null, ...linked);
    }
    return child;
  });
}

export function Markdown({ children }: { children: string }) {
  // Step 1: Convert SVG code blocks (```xml, ```svg, ```html, or bare ```) into inline SVG
  const processed = children.replace(
    /```(?:xml|svg|html)?\s*\n(<svg[\s\S]*?<\/svg>)\s*\n```/gi,
    (_match, svgContent: string) => svgContent,
  );

  // Step 2: Extract inline SVG blocks and render them separately to avoid React DOM warnings
  const svgRegex = /<svg[\s\S]*?<\/svg>/gi;
  const parts: { type: "text" | "svg"; content: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = svgRegex.exec(processed)) !== null) {
    const textBefore = processed.slice(lastIndex, match.index).trim();
    if (textBefore) {
      parts.push({ type: "text", content: textBefore });
    }
    parts.push({ type: "svg", content: match[0] });
    lastIndex = match.index + match[0].length;
  }
  const textAfter =
    lastIndex < processed.length ? processed.slice(lastIndex).trim() : "";
  if (textAfter) {
    parts.push({ type: "text", content: textAfter });
  }

  // If no SVGs found, render normally
  if (parts.length === 0 || (parts.length === 1 && parts[0].type === "text")) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: false }]]}
          components={markdownComponents}
        >
          {processed}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      {parts.map((part, i) =>
        part.type === "svg" ? (
          <RawSvg key={i} html={part.content} />
        ) : (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: false }]]}
            components={markdownComponents}
          >
            {part.content}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
}
