import { describe, expect, it } from "vitest";
import { sanitizeBasicHtml } from "@/lib/sanitize-html";

describe("sanitizeBasicHtml", () => {
  it("keeps basic formatting and safe links", () => {
    expect(
      sanitizeBasicHtml('<p>Hello <strong>fleet</strong> <a href="https://example.com/x">link</a></p>')
    ).toBe(
      '<p>Hello <strong>fleet</strong> <a href="https://example.com/x" rel="noopener noreferrer">link</a></p>'
    );
  });

  it("removes scripts, event handlers, and unsafe hrefs", () => {
    expect(
      sanitizeBasicHtml('<img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><script>alert(2)</script>')
    ).toBe("<a>bad</a>alert(2)");
  });
});
