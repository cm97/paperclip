import { sendAdminLink, sendTicketReply } from "./email";
import { clean, esc, html, message, page, randomId, rateLimited, readCookie, sameOrigin, sha256, timingSafeEqual, type Env } from "./lib";
import { renderThread } from "./support";

const COOKIE = "bf_admin";

const LINK_TTL = 15 * 60 * 1000;
const SESSION_TTL = 30 * 24 * 3600 * 1000;
const sessionCookie = (v: string) => `${COOKIE}=${v}; Path=/admin; Max-Age=${SESSION_TTL / 1000}; HttpOnly; Secure; SameSite=Lax`;

async function isAdmin(req: Request, env: Env): Promise<boolean> {
	const c = readCookie(req, COOKIE);
	if (!c) return false;
	if (env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 16 && timingSafeEqual(c, await sha256(`admin|${env.ADMIN_TOKEN}`))) return true;
	if (!env.DB || !/^[0-9a-f]{40,80}$/.test(c)) return false;
	const row = await env.DB.prepare("SELECT expires_at FROM admin_sessions WHERE hash = ?1").bind(await sha256(`session|${c}`)).first<{ expires_at: number }>();
	return !!row && row.expires_at > Date.now();
}

function shell(title: string, body: string): Response {
	return html(page(`${title} – Admin`, "Admin", `<div class="wrap admin">${body}</div>`, { head: `<meta name="robots" content="noindex">` }));
}

export async function admin(req: Request, env: Env, path: string): Promise<Response> {
	const url = new URL(req.url);

	// Email-link sign-in: no password to manage. The link goes to the owner's inbox.
	if (path === "/admin/email-link" && req.method === "POST") {
		if (!sameOrigin(req)) return message("Bad origin", "", 403);
		if (!env.DB || !env.EMAIL) return message("Email sign-in isn't available", "<p>The database or email service isn't connected.</p>", 503);
		if (await rateLimited(env, req, "admin-link", 3)) return message("Too many requests", "<p>Please wait an hour.</p>", 429);
		const token = randomId(24);
		await env.DB.batch([
			env.DB.prepare("DELETE FROM admin_links WHERE expires_at < ?1").bind(Date.now()),
			env.DB.prepare("INSERT INTO admin_links (hash, expires_at) VALUES (?1, ?2)").bind(await sha256(`link|${token}`), Date.now() + LINK_TTL),
			env.DB.prepare("INSERT INTO audit_log (action, detail) VALUES ('admin_link_requested', ?1)").bind(req.headers.get("cf-connecting-ip") || ""),
		]);
		await sendAdminLink(env, `${url.origin}/admin/magic?t=${token}`);
		return shell("Check your email", `<h1>Check the owner inbox</h1><p>If email is set up, a sign-in link is on its way to the owner's inbox. It works once, for 15 minutes.</p>`);
	}
	if (path === "/admin/magic") {
		const token = url.searchParams.get("t") || "";
		if (!env.DB || !/^[0-9a-f]{48}$/.test(token)) return message("That sign-in link isn't valid", `<p><a href="/admin/login">Get a new link</a></p>`, 400);
		const hash = await sha256(`link|${token}`);
		const used = await env.DB.prepare("UPDATE admin_links SET used = 1 WHERE hash = ?1 AND used = 0 AND expires_at > ?2 RETURNING hash").bind(hash, Date.now()).first();
		if (!used) return message("That sign-in link has expired or was already used", `<p><a href="/admin/login">Get a new link</a></p>`, 400);
		const session = randomId(24);
		await env.DB.batch([
			env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at < ?1").bind(Date.now()),
			env.DB.prepare("INSERT INTO admin_sessions (hash, expires_at) VALUES (?1, ?2)").bind(await sha256(`session|${session}`), Date.now() + SESSION_TTL),
			env.DB.prepare("INSERT INTO audit_log (action, detail) VALUES ('admin_signed_in', 'email_link')"),
		]);
		return new Response(null, { status: 303, headers: { location: "/admin", "set-cookie": sessionCookie(session) } });
	}

	if (path === "/admin/login") {
		if (req.method === "POST") {
			if (!sameOrigin(req)) return message("Bad origin", "", 403);
			if (await rateLimited(env, req, "admin-login", 5)) return message("Too many sign-in attempts", "<p>Locked for this hour.</p>", 429);
			const token = clean((await req.formData()).get("token"), 300);
			if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16 || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
				await env.DB?.prepare("INSERT INTO audit_log (action, detail) VALUES ('admin_login_failed', ?1)").bind(req.headers.get("cf-connecting-ip") || "").run().catch(() => {});
				return message("Wrong admin key", `<p><a href="/admin/login">Try again</a></p>`, 401);
			}
			return new Response(null, {
				status: 303,
				headers: { location: "/admin", "set-cookie": `${COOKIE}=${await sha256(`admin|${env.ADMIN_TOKEN}`)}; Path=/admin; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict` },
			});
		}
		return shell(
			"Sign in",
			`<h1>Admin sign in</h1>
<form class="form" method="post" action="/admin/email-link"><p>We'll email a one-time sign-in link to the owner's inbox.</p><button class="btn primary">Email me a sign-in link</button></form>
${env.ADMIN_TOKEN ? `<details><summary>Sign in with an admin key instead</summary><form class="form" method="post"><label for="tk">Admin key</label><input id="tk" name="token" type="password" required autocomplete="current-password"><button class="btn">Sign in</button></form></details>` : ""}`,
		);
	}
	if (!(await isAdmin(req, env))) return Response.redirect(`${url.origin}/admin/login`, 302);
	if (!env.DB) return shell("Admin", "<h1>No database bound</h1>");
	const db = env.DB;

	// Mark an order refunded: its unlock pass stops working everywhere.
	if (path === "/admin/orders/refund" && req.method === "POST") {
		if (!sameOrigin(req)) return message("Bad origin", "", 403);
		const f = await req.formData();
		if (f.get("confirm") !== "yes") return message("Tick the box to confirm", `<p><a href="/admin#orders">Back</a></p>`, 400);
		const ref = clean(f.get("ref"), 200);
		await db.batch([
			db.prepare("UPDATE orders SET status = 'refunded' WHERE ref = ?1").bind(ref),
			db.prepare("INSERT INTO audit_log (action, detail) VALUES ('order_refunded', ?1)").bind(ref),
		]);
		return Response.redirect(`${url.origin}/admin#orders`, 303);
	}
	// Privacy requests: erase a ticket (with its messages) or a survey answer.
	if (path === "/admin/erase" && req.method === "POST") {
		if (!sameOrigin(req)) return message("Bad origin", "", 403);
		const f = await req.formData();
		if (f.get("confirm") !== "yes") return message("Tick the box to confirm", `<p><a href="/admin">Back</a></p>`, 400);
		const kind = clean(f.get("kind"), 20);
		const id = Number(clean(f.get("id"), 20));
		if (kind === "ticket" && id) {
			await db.batch([
				db.prepare("DELETE FROM ticket_messages WHERE ticket_id = ?1").bind(id),
				db.prepare("DELETE FROM tickets WHERE id = ?1").bind(id),
			]);
		}
		if (kind === "survey" && id) await db.prepare("DELETE FROM survey_responses WHERE id = ?1").bind(id).run();
		await db.prepare("INSERT INTO audit_log (action, detail) VALUES ('erased', ?1)").bind(`${kind}:${id}`).run();
		return Response.redirect(`${url.origin}/admin`, 303);
	}

	const ticketMatch = path.match(/^\/admin\/tickets\/(\d+)$/);
	if (ticketMatch) {
		const id = +ticketMatch[1];
		if (req.method === "POST") {
			if (!sameOrigin(req)) return message("Bad origin", "", 403);
			const f = await req.formData();
			const body = clean(f.get("body"), 6000);
			const status = ["open", "answered", "closed"].includes(clean(f.get("status"), 20)) ? clean(f.get("status"), 20) : body ? "answered" : "open";
			const stmts = [db.prepare("UPDATE tickets SET status = ?2, updated_at = datetime('now') WHERE id = ?1").bind(id, status)];
			if (body) stmts.unshift(db.prepare("INSERT INTO ticket_messages (ticket_id, author, body) VALUES (?1, 'support', ?2)").bind(id, body));
			await db.batch(stmts);
			if (body) {
				const t = await db.prepare("SELECT email, secret FROM tickets WHERE id = ?1").bind(id).first<any>();
				if (t) await sendTicketReply(env, t.email, id, `${url.origin}/support/ticket/${id}?k=${t.secret}`, body);
			}
			return Response.redirect(`${url.origin}/admin/tickets/${id}`, 303);
		}
		const t = await db.prepare("SELECT * FROM tickets WHERE id = ?1").bind(id).first<any>();
		if (!t) return shell("Not found", "<h1>Ticket not found</h1>");
		const msgs = (await db.prepare("SELECT author, body, created_at FROM ticket_messages WHERE ticket_id = ?1 ORDER BY id").bind(id).all<any>()).results;
		const link = `${url.origin}/support/ticket/${id}?k=${t.secret}`;
		return shell(
			`Ticket ${id}`,
			`<p><a href="/admin">← All tickets</a></p>
<h1>#${id} · ${esc(t.topic)}</h1>
<p class="muted">${esc(t.name || "")} &lt;<a href="mailto:${esc(t.email)}?subject=${encodeURIComponent(`Re: your Buzzyfly ticket #${id}`)}&body=${encodeURIComponent(`\n\nView the full conversation: ${link}`)}">${esc(t.email)}</a>&gt; · order ${esc(t.order_ref || "–")} · ${esc(t.status)}</p>
${renderThread(msgs)}
<form class="form" method="post"><label for="b">Reply (the customer sees it on their ticket page)</label><textarea id="b" name="body" maxlength="6000"></textarea>
<label for="st">Status</label><select id="st" name="status"><option value="answered">answered</option><option value="open">open</option><option value="closed">closed</option></select>
<button class="btn primary">Save reply</button></form>
<p class="note">Customer's private link: <code>${esc(link)}</code>. Saving a reply emails the customer automatically when email is set up.</p>
<form method="post" action="/admin/erase" class="form"><input type="hidden" name="kind" value="ticket"><input type="hidden" name="id" value="${id}"><label class="item"><input type="checkbox" name="confirm" value="yes" required> Yes, permanently erase this ticket (privacy request)</label><button class="btn small">Erase ticket</button></form>`,
		);
	}

	const [stats, tickets, surveys, orders] = await Promise.all([
		db
			.prepare(
				"SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COALESCE(SUM(CAST(amount AS REAL)),0) FROM orders WHERE status='paid') AS revenue, (SELECT COALESCE(SUM(CAST(amount AS REAL)),0) FROM orders WHERE status='paid' AND created_at >= datetime('now','-30 days')) AS revenue30, (SELECT COUNT(*) FROM tickets WHERE status='open') AS open_tickets, (SELECT COUNT(*) FROM survey_responses) AS surveys",
			)
			.first<any>(),
		db.prepare("SELECT id, topic, email, status, updated_at FROM tickets ORDER BY (status='open') DESC, updated_at DESC LIMIT 50").all<any>(),
		db.prepare("SELECT id, kind, role, org, org_size, need, would_pay, email, created_at FROM survey_responses ORDER BY id DESC LIMIT 50").all<any>(),
		db.prepare("SELECT ref, provider, product, amount, email, source, status, created_at FROM orders ORDER BY created_at DESC LIMIT 50").all<any>(),
	]);
	const row = (cells: unknown[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
	return shell(
		"Dashboard",
		`<h1>Study Plan admin</h1>
<div class="grid stats">
<div class="card"><p class="note">Revenue, last 30 days</p><p class="amount">$${Number(stats.revenue30).toFixed(0)}</p></div>
<div class="card"><p class="note">Revenue, all time</p><p class="amount">$${Number(stats.revenue).toFixed(0)}</p></div>
<div class="card"><p class="note">Orders</p><p class="amount">${stats.orders}</p></div>
<div class="card"><p class="note">Open tickets</p><p class="amount">${stats.open_tickets}</p></div>
<div class="card"><p class="note">Survey answers</p><p class="amount">${stats.surveys}</p></div>
</div>
<h2>Support tickets</h2>
<div class="table"><table><thead><tr><th>#</th><th>Topic</th><th>Email</th><th>Status</th><th>Updated</th></tr></thead><tbody>
${tickets.results.map((t) => row([`<a href="/admin/tickets/${t.id}">${t.id}</a>`, esc(t.topic), esc(t.email), esc(t.status), esc(t.updated_at)])).join("") || row(["–", "No tickets yet", "", "", ""])}
</tbody></table></div>
<h2>Survey answers</h2>
<div class="table"><table><thead><tr><th>When</th><th>Kind</th><th>Who</th><th>Need</th><th>Would pay</th><th>Email</th><th>Erase</th></tr></thead><tbody>
${surveys.results.map((s) => row([esc(s.created_at), esc(s.kind), esc([s.role, s.org, s.org_size].filter(Boolean).join(" · ")), esc(s.need), esc(s.would_pay || ""), esc(s.email || ""), `<form method="post" action="/admin/erase"><input type="hidden" name="kind" value="survey"><input type="hidden" name="id" value="${s.id}"><label><input type="checkbox" name="confirm" value="yes" required> sure</label> <button class="copy">Erase</button></form>`])).join("") || row(["–", "No answers yet", "", "", "", "", ""])}
</tbody></table></div>
<h2 id="orders">Orders</h2>
<p class="note">Refund the payment in PayPal or Stripe first, then mark it refunded here. That stops the buyer's unlock link working.</p>
<div class="table"><table><thead><tr><th>When</th><th>Product</th><th>Amount</th><th>Via</th><th>Email</th><th>Source</th><th>Ref</th><th>Status</th></tr></thead><tbody>
${orders.results.map((o) => row([esc(o.created_at), esc(o.product), `$${esc(o.amount)}`, esc(o.provider), esc(o.email || ""), esc(o.source || ""), esc(o.ref), o.status === "refunded" ? "refunded" : `<form method="post" action="/admin/orders/refund"><input type="hidden" name="ref" value="${esc(o.ref)}"><label><input type="checkbox" name="confirm" value="yes" required> sure</label> <button class="copy">Mark refunded</button></form>`])).join("") || row(["–", "No orders yet", "", "", "", "", "", ""])}
</tbody></table></div>`,
	);
}
