/**
 * Rich-text sanitization for carousel slide title/subtitle.
 *
 * Content is authored in a contentEditable surface the app fully controls, so
 * the DOM-based cleaner (edit time) keeps only a small whitelist of inline
 * formatting. `stripUnsafeHtml` is an isomorphic defense-in-depth pass used on
 * the render path.
 */

const ALLOWED_TAGS = new Set(["SPAN", "B", "STRONG", "I", "EM", "U", "BR", "DIV", "P"]);
const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "font-family",
  "font-weight",
  "font-style",
  "text-decoration",
]);

function sanitizeStyle(style: string): string {
  return style
    .split(";")
    .map((decl) => decl.trim())
    .filter(Boolean)
    .filter((decl) => {
      const prop = decl.split(":")[0]?.trim().toLowerCase();
      if (!prop || !ALLOWED_STYLE_PROPS.has(prop)) return false;
      // Block url()/expression()/javascript: payloads in values.
      const value = decl.slice(decl.indexOf(":") + 1).toLowerCase();
      return !/url\(|expression\(|javascript:/.test(value);
    })
    .join("; ");
}

/** DOM-based cleaner — browser only (call before persisting edited HTML). */
export function sanitizeRichHtml(html: string): string {
  if (typeof document === "undefined") return stripUnsafeHtml(html);

  const template = document.createElement("template");
  template.innerHTML = html;

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!ALLOWED_TAGS.has(el.tagName)) {
          // Unwrap disallowed elements, keeping their text content.
          const text = document.createTextNode(el.textContent ?? "");
          el.replaceWith(text);
          continue;
        }
        // Strip all attributes except a sanitized style.
        const style = el.getAttribute("style");
        for (const attr of Array.from(el.attributes)) {
          el.removeAttribute(attr.name);
        }
        if (style) {
          const clean = sanitizeStyle(style);
          if (clean) el.setAttribute("style", clean);
        }
        walk(el);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove();
      }
    }
  };

  walk(template.content);
  return template.innerHTML;
}

/** Isomorphic best-effort strip of script/handlers — used on render. */
export function stripUnsafeHtml(html: string): string {
  return html
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

/** True when HTML has visible text content. */
export function hasRichContent(html?: string | null): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}
