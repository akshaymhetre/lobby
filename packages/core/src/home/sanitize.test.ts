import { describe, expect, it } from "vitest";
import { htmlTextLength, safeHref, sanitizePostHtml as clean } from "./sanitize";

describe("sanitizePostHtml", () => {
  it("keeps the editor's formatting", () => {
    const html = "<h2>Title</h2><p>Some <strong>bold</strong>, <em>italic</em> and <s>gone</s>.</p><ul><li><p>One</p></li></ul><blockquote><p>Quote</p></blockquote><pre><code>x &lt; y</code></pre><hr>";
    expect(clean(html)).toBe(html.replace("<hr>", "<hr>"));
  });

  it("removes scripts, styles and their content", () => {
    expect(clean("<p>a</p><script>alert(1)</script><style>p{}</style><p>b</p>")).toBe("<p>a</p><p>b</p>");
    expect(clean("<SCRIPT >alert(1)</script ><p>ok</p>")).toBe("<p>ok</p>");
    expect(clean("<iframe src=x></iframe><svg><script>x</script></svg>hi")).toBe("hi");
  });

  it("strips every attribute and event handler", () => {
    expect(clean('<p onclick="x()" style="color:red" class="c">t</p>')).toBe("<p>t</p>");
    expect(clean('<img src=x onerror=alert(1)><p>t</p>')).toBe("<p>t</p>");
    expect(clean('<p title="a>b" onmouseover=alert(1)>t</p>')).toBe("<p>t</p>");
  });

  it("only keeps safe link targets", () => {
    expect(clean('<a href="https://x.example/a?b=1&amp;c=2" target="_blank">x</a>')).toBe(
      '<a href="https://x.example/a?b=1&amp;c=2" rel="noopener noreferrer">x</a>',
    );
    expect(clean('<a href="/knowledge/it/vpn">vpn</a>')).toBe('<a href="/knowledge/it/vpn" rel="noopener noreferrer">vpn</a>');
    expect(clean('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(clean('<a href="java&#x09;script:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(clean('<a href="&#106;avascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(clean('<a href="//evil.example">x</a>')).toBe("<a>x</a>");
    expect(clean('<a href="data:text/html,x">x</a>')).toBe("<a>x</a>");
  });

  it("escapes text and stray angle brackets", () => {
    expect(clean("<p>1 < 2 & 3 > 2</p>")).toBe("<p>1 &lt; 2 &amp; 3 &gt; 2</p>");
    expect(clean("<scr<script>alert(1)</script>ipt>x")).not.toMatch(/<(?!\/?(p|a)\b)/);
    expect(clean("<p>&lt;script&gt;</p>")).toBe("<p>&lt;script&gt;</p>");
    expect(clean('<p>"quoted"</p>')).toBe("<p>&quot;quoted&quot;</p>");
  });

  it("always produces well-nested output", () => {
    expect(clean("<p><strong>open")).toBe("<p><strong>open</strong></p>");
    expect(clean("</em><p>x</p></div>")).toBe("<p>x</p>");
    expect(clean("<ul><li>a<li>b</ul>")).toBe("<ul><li>a<li>b</li></li></ul>");
  });

  it("drops unknown tags but keeps their text, and removes comments", () => {
    expect(clean("<div><span>hi</span></div><!-- secret --><p>x</p>")).toBe("hi<p>x</p>");
    expect(clean("<b>b</b><i>i</i>")).toBe("<strong>b</strong><em>i</em>");
  });

  it("measures text length for empty checks", () => {
    expect(htmlTextLength("<p></p><p>  </p>")).toBe(0);
    expect(htmlTextLength("<p>Hi &amp; bye</p>")).toBe(8);
  });

  it("safeHref allows only safe schemes", () => {
    expect(safeHref("mailto:a@b.example")).toBe("mailto:a@b.example");
    expect(safeHref(" vbscript:x")).toBeNull();
  });
});
