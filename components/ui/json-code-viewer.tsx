"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type TokenType =
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "punctuation"
  | "plain";

type Token = { type: TokenType; text: string };

function tokenizeJsonLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (/\s/.test(ch)) {
      tokens.push({ type: "plain", text: ch });
      i += 1;
      continue;
    }

    if (ch === '"') {
      let value = '"';
      i += 1;
      while (i < line.length) {
        value += line[i];
        if (line[i] === "\\") {
          i += 1;
          if (i < line.length) value += line[i];
        } else if (line[i] === '"') {
          break;
        }
        i += 1;
      }
      i += 1;
      const next = line.slice(i).match(/^\s*:/);
      tokens.push({ type: next ? "key" : "string", text: value });
      continue;
    }

    if (/[-\d]/.test(ch)) {
      let value = ch;
      i += 1;
      while (i < line.length && /[0-9.eE+-]/.test(line[i])) {
        value += line[i];
        i += 1;
      }
      tokens.push({ type: "number", text: value });
      continue;
    }

    if (line.startsWith("true", i) || line.startsWith("false", i)) {
      const word = line.startsWith("true", i) ? "true" : "false";
      tokens.push({ type: "boolean", text: word });
      i += word.length;
      continue;
    }

    if (line.startsWith("null", i)) {
      tokens.push({ type: "null", text: "null" });
      i += 4;
      continue;
    }

    tokens.push({ type: "punctuation", text: ch });
    i += 1;
  }

  return tokens;
}

const tokenClass: Record<TokenType, string> = {
  key: "text-[#9cdcfe]",
  string: "text-[#ce9178]",
  number: "text-[#b5cea8]",
  boolean: "text-[#569cd6]",
  null: "text-[#569cd6]",
  punctuation: "text-[#d4d4d4]",
  plain: "text-[#d4d4d4]",
};

function HighlightedLine({ line }: { line: string }) {
  const tokens = tokenizeJsonLine(line);
  if (tokens.length === 0) {
    return <span className="text-[#d4d4d4]">&nbsp;</span>;
  }
  return (
    <>
      {tokens.map((token, index) => (
        <span
          key={index}
          className={cn(tokenClass[token.type], "break-words")}
        >
          {token.text}
        </span>
      ))}
    </>
  );
}

type JsonCodeViewerProps = {
  value: Record<string, unknown> | unknown[];
  className?: string;
  maxHeight?: string;
};

export function JsonCodeViewer({
  value,
  className,
  maxHeight = "max-h-80",
}: JsonCodeViewerProps) {
  const lines = useMemo(() => {
    const formatted = JSON.stringify(value, null, 2);
    return formatted.split("\n");
  }, [value]);

  return (
    <div
      className={cn(
        "w-full max-w-full overflow-hidden rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] font-mono text-[13px] leading-[1.55] shadow-inner",
        className
      )}
    >
      <div
        className={cn(
          "flex w-full max-w-full overflow-x-hidden overflow-y-auto",
          maxHeight
        )}
      >
        <div
          className="shrink-0 border-r border-[#3c3c3c] bg-[#252526] px-3 py-4 text-right text-[#858585]"
          aria-hidden
        >
          {lines.map((_, idx) => (
            <div key={idx} className="min-h-[1.55em] min-w-[1.5rem] leading-[1.55]">
              {idx + 1}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 py-4 pr-4 pl-3">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="min-h-[1.55em] w-full max-w-full leading-[1.55] whitespace-pre-wrap break-words"
            >
              <code className="block w-full max-w-full">
                <HighlightedLine line={line} />
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
