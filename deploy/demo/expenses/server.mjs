// A tiny stand-in "internal app" for the demo. It sits behind oauth2-proxy,
// which handles SSO against the same IdP as Lobby and forwards the identity.
import { createServer } from "node:http";

const rows = [
  ["Client dinner, Berlin", "2026-10-02", "€184.20", "Approved"],
  ["Train to Munich", "2026-10-06", "€96.00", "Approved"],
  ["Conference ticket", "2026-10-09", "€640.00", "Pending"],
  ["Taxi from airport", "2026-10-11", "€42.50", "Draft"],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

createServer((req, res) => {
  const email = req.headers["x-forwarded-email"] ?? "unknown";
  const user = req.headers["x-forwarded-preferred-username"] ?? email;
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Expenses</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f6f7f9;color:#1d232b}
header{background:#14532d;color:#fff;padding:14px 24px;display:flex;justify-content:space-between}
main{max-width:760px;margin:32px auto;padding:0 16px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden}
td,th{padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:left}th{font-size:12px;text-transform:uppercase;color:#5b6470}</style></head>
<body><header><strong>Expenses</strong><span data-testid="signed-in-as">Signed in as ${esc(user)}</span></header>
<main><h1>My claims</h1><table><tr><th>Item</th><th>Date</th><th>Amount</th><th>Status</th></tr>
${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}
</table></main></body></html>`);
}).listen(3000, () => console.log("expenses demo app on :3000"));
