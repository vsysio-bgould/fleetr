const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "br",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "u",
  "ul",
]);

const VOID_TAGS = new Set(["br"]);

export function sanitizeBasicHtml(input: string): string {
  let output = "";
  let lastIndex = 0;
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)(\s[^<>]*)?>/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(input)) !== null) {
    output += escapeHtml(input.slice(lastIndex, match.index));
    const rawTag = match[0];
    const tag = match[1].toLowerCase();
    const attrs = match[2] ?? "";
    const closing = rawTag.startsWith("</");

    if (ALLOWED_TAGS.has(tag)) {
      if (closing && !VOID_TAGS.has(tag)) {
        output += `</${tag}>`;
      } else if (!closing) {
        output += tag === "a" ? sanitizeAnchor(attrs) : `<${tag}>`;
      }
    }

    lastIndex = tagPattern.lastIndex;
  }

  output += escapeHtml(input.slice(lastIndex));
  return output;
}

function sanitizeAnchor(attrs: string): string {
  const href = extractHref(attrs);
  if (!href) return "<a>";
  return `<a href="${escapeAttribute(href)}" rel="noopener noreferrer">`;
}

function extractHref(attrs: string): string | null {
  const hrefMatch = attrs.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? null;
  if (!href) return null;

  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return href.startsWith("/") && !href.startsWith("//") ? href : null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
