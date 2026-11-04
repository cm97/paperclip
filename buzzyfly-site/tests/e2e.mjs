// End-to-end test: runs the real Worker locally (wrangler dev, local D1) against
// a fake PayPal API and checks every money, access, support and security path.
// Usage: npm test
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 8799;
const PP_PORT = 9799;
const B = `http://127.0.0.1:${PORT}`;
const ADMIN = "admin-token-for-tests-123";
const STATE = `.wrangler/e2e-${Date.now()}`; // fresh local database every run
let failures = 0;
const ok = (name, cond, extra = "") => {
	console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
	if (!cond) failures++;
};

// ---- fake PayPal ----
const PRICE = { student: "19.00", classroom: "99.00", team: "299.00" };
const pp = http.createServer((q, r) => {
	let body = "";
	q.on("data", (c) => (body += c));
	q.on("end", () => {
		r.setHeader("content-type", "application/json");
		if (q.url.startsWith("/v1/oauth2/token")) return r.end(JSON.stringify({ access_token: "x" }));
		if (q.url === "/v2/checkout/orders") {
			const id = JSON.parse(body).purchase_units[0].custom_id;
			return r.end(JSON.stringify({ id: `ORDER${id.toUpperCase()}123`, links: [{ rel: "payer-action", href: "https://www.paypal.com/checkoutnow?token=X" }] }));
		}
		const m = q.url.match(/orders\/([A-Z0-9]+)\/capture/);
		if (m) {
			const p = m[1].includes("CLASSROOM") ? "classroom" : m[1].includes("TEAM") ? "team" : "student";
			const value = m[1].includes("BAD") ? "1.00" : PRICE[p];
			return r.end(JSON.stringify({ status: "COMPLETED", payer: { email_address: "buyer@example.com" }, purchase_units: [{ custom_id: p, payments: { captures: [{ status: "COMPLETED", custom_id: p, amount: { value, currency_code: "USD" } }] } }] }));
		}
		r.statusCode = 404;
		r.end("{}");
	});
});
await new Promise((res) => pp.listen(PP_PORT, res));

// ---- worker ----
const run = (args) => new Promise((res) => spawn("npx", args, { stdio: "inherit" }).on("exit", res));
await run(["wrangler", "d1", "migrations", "apply", "DB", "--local", "-c", "wrangler.test.json", "--persist-to", STATE]);
const vars = { ADMIN_TOKEN: ADMIN, PAYPAL_CLIENT_ID: "a", PAYPAL_SECRET: "b", PAYPAL_API_BASE: `http://127.0.0.1:${PP_PORT}` };
const dev = spawn("npx", ["wrangler", "dev", "-c", "wrangler.test.json", "--port", String(PORT), "--persist-to", STATE, ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])], { stdio: ["ignore", "pipe", "inherit"], detached: true });
// Refuse to test against a stale server left on the port.
try { await fetch(`${B}/api/health`); console.error(`Port ${PORT} is already in use. Stop the old server first.`); process.exit(2); } catch {}
for (let i = 0; i < 60; i++) {
	try { if ((await fetch(`${B}/api/health`)).ok) break; } catch {}
	await sleep(1000);
}

const get = (p, opts = {}) => fetch(B + p, { redirect: "manual", ...opts });
const post = (p, form, headers = {}) => get(p, { method: "POST", body: new URLSearchParams(form), headers: { origin: B, ...headers } });
const cookieOf = (res) => (res.headers.get("set-cookie") || "").split(";")[0];

try {
	// Pages
	for (const p of ["/", "/app", "/schools", "/business", "/support", "/survey", "/about", "/terms", "/privacy", "/refunds", "/accessibility", "/restore", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/sw.js", "/.well-known/assetlinks.json", "/.well-known/security.txt"]) {
		const r = await get(p);
		ok(`GET ${p} → 200`, r.status === 200, String(r.status));
	}
	ok("unknown page → 404", (await get("/nope")).status === 404);
	const home = await get("/");
	ok("security headers", !!home.headers.get("content-security-policy") && !!home.headers.get("strict-transport-security") && home.headers.get("x-frame-options") === "DENY");
	const health = await (await get("/api/health")).json();
	ok("health: db + selling", health.db && health.selling && health.admin, JSON.stringify(health));

	// Purchase → unlock, for every tier
	for (const [tier, label] of [["student", "personal unlock link"], ["classroom", "class link"], ["team", "team link"]]) {
		const buy = await get(`/buy/${tier}?src=test`);
		ok(`buy ${tier} → PayPal`, buy.status === 302 && (buy.headers.get("location") || "").startsWith("https://www.paypal.com/"));
		const ret = await get(`/paypal/return?token=ORDER${tier.toUpperCase()}123`);
		const body = await ret.text();
		ok(`return ${tier} → thank-you`, ret.status === 200 && body.includes("You're in") && body.toLowerCase().includes(label), ret.status === 200 ? "" : `${ret.status}: ${(body.match(/<h1>([^<]*)/) || [])[1]}`);
		const app = await (await get("/app", { headers: { cookie: cookieOf(ret) } })).text();
		ok(`app unlocked as ${tier}`, app.includes(`data-tier="${tier}"`));
		if (tier === "student") {
			const link = body.match(/\/unlock\?t=([^<"]+)/)[1].replace(/&amp;/g, "&");
			const un = await get(`/unlock?t=${link}`);
			ok("unlock link sets pass", un.status === 302 && cookieOf(un).startsWith("bf_study="));
			ok("forged unlock rejected", (await get(`/unlock?t=${link}x`)).status === 400);
			globalThis.studentCookie = cookieOf(ret);
		}
	}
	ok("wrong amount rejected", (await get("/paypal/return?token=ORDERBADSTUDENT123")).status === 402);
	ok("bad order id rejected", (await get("/paypal/return?token=%3Cscript%3E")).status === 400);
	ok("free app without pass", (await (await get("/app")).text()).includes('data-tier="free"'));

	// Support ticket → admin reply → customer sees it
	const t = await post("/support/tickets", { email: "a@example.com", topic: "Refund request", body: "Cannot log in <b>x</b>", order_ref: "ORDERSTUDENT123" });
	const tLoc = t.headers.get("location") || "";
	ok("ticket created", t.status === 303 && tLoc.includes("/support/ticket/"));
	const tPage = await (await get(tLoc.replace(B, ""))).text();
	ok("ticket page escapes HTML", tPage.includes("&lt;b&gt;x&lt;/b&gt;") && !tPage.includes("<b>x</b>"));
	ok("cross-site ticket blocked", (await post("/support/tickets", { email: "a@b.co", body: "x" }, { origin: "https://evil.example" })).status === 403);
	ok("ticket wrong key → 404", (await get("/support/ticket/1?k=nope")).status === 404);
	ok("chat answers (fallback without AI)", (await (await get("/api/support/chat", { method: "POST", headers: { origin: B, "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "refund?" }] }) })).json()).reply.length > 10);

	// Admin
	ok("admin requires login", (await get("/admin")).status === 302);
	ok("wrong admin key → 401", (await post("/admin/login", { token: "wrong" })).status === 401);
	const login = await post("/admin/login", { token: ADMIN });
	const adminCookie = cookieOf(login);
	ok("admin login", login.status === 303 && adminCookie.startsWith("bf_admin="));
	const A = { cookie: adminCookie };
	const dash = await (await get("/admin", { headers: A })).text();
	ok("admin shows revenue + orders", dash.includes("$417") && dash.includes("ORDERTEAM123"), "19+99+299");
	const tid = tLoc.match(/ticket\/(\d+)/)[1];
	await post(`/admin/tickets/${tid}`, { body: "We fixed it, try again.", status: "answered" }, A);
	ok("customer sees support reply", (await (await get(tLoc.replace(B, ""))).text()).includes("We fixed it, try again."));

	// Survey
	ok("survey saved", (await post("/survey", { kind: "business", role: "Business owner", need: "Staff need CompTIA prep", would_pay: "$100–$499" })).status === 200);
	ok("survey in admin", (await (await get("/admin", { headers: A })).text()).includes("Staff need CompTIA prep"));

	// Refund revokes access
	ok("refund needs confirmation", (await post("/admin/orders/refund", { ref: "ORDERSTUDENT123" }, A)).status === 400);
	await post("/admin/orders/refund", { ref: "ORDERSTUDENT123", confirm: "yes" }, A);
	ok("refunded pass no longer unlocks", (await (await get("/app", { headers: { cookie: globalThis.studentCookie } })).text()).includes('data-tier="free"'));
	ok("refunded order can't be re-claimed", (await get("/paypal/return?token=ORDERSTUDENTREFUND".replace("REFUND", "123"))).status === 403);

	// Email-link admin sign-in (token inserted directly; email isn't available locally)
	ok("email link needs the email service", (await post("/admin/email-link", {})).status === 503);
	ok("bad magic link rejected", (await get("/admin/magic?t=nope")).status === 400);
	const tok = randomBytes(24).toString("hex");
	const hash = createHash("sha256").update(`link|${tok}`).digest("hex");
	await run(["wrangler", "d1", "execute", "DB", "--local", "-c", "wrangler.test.json", "--persist-to", STATE, "--command", `INSERT INTO admin_links (hash, expires_at) VALUES ('${hash}', ${Date.now() + 600000})`]);
	const magic = await get(`/admin/magic?t=${tok}`);
	const sess = cookieOf(magic);
	ok("magic link signs in", magic.status === 303 && sess.startsWith("bf_admin="));
	ok("magic session opens admin", (await get("/admin", { headers: { cookie: sess } })).status === 200);
	ok("magic link works only once", (await get(`/admin/magic?t=${tok}`)).status === 400);
	const tok2 = randomBytes(24).toString("hex");
	const hash2 = createHash("sha256").update(`link|${tok2}`).digest("hex");
	await run(["wrangler", "d1", "execute", "DB", "--local", "-c", "wrangler.test.json", "--persist-to", STATE, "--command", `INSERT INTO admin_links (hash, expires_at) VALUES ('${hash2}', ${Date.now() - 1000})`]);
	ok("expired magic link rejected", (await get(`/admin/magic?t=${tok2}`)).status === 400);
	ok("fake session cookie rejected", (await get("/admin", { headers: { cookie: `bf_admin=${"a".repeat(48)}` } })).status === 302);

	// Privacy erase
	await post("/admin/erase", { kind: "ticket", id: tid, confirm: "yes" }, A);
	ok("erased ticket is gone", (await get(tLoc.replace(B, ""))).status === 404);
} catch (e) {
	console.error(e);
	failures++;
} finally {
	try { process.kill(-dev.pid, "SIGTERM"); } catch {}
	pp.close();
	rmSync(STATE, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
