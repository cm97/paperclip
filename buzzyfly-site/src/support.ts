import { BRAND, FREE_LIMITS, PRODUCTS, REFUND_LINE, SUPPORT_EMAIL } from "./config";
import { notifyOwner, sendTicketReceived } from "./email";
import { clean, esc, html, message, page, randomId, rateLimited, sameOrigin, validEmail, type Env } from "./lib";

const TOPICS = ["Can't get into the app", "Payment or receipt", "Refund request", "How do I…?", "Classroom or business licence", "Bug or problem", "Something else"];

const FAQ: [string, string][] = [
	["How do I get into the app after paying?", "The app unlocks on the thank-you page right after checkout. That page also shows an unlock link. Open it on any other phone or laptop."],
	["I lost my unlock link.", "Go to Lost access (/restore) and enter your PayPal order reference. Paid by card? Open a ticket below with the email you paid with."],
	["Is it a subscription?", "No. You pay once and keep the app."],
	["What does the free version include?", `${FREE_LIMITS.exams} exam plan and up to ${FREE_LIMITS.cards} flashcards. Upgrading keeps everything you've made.`],
	["Where is my data stored?", "Your plans and flashcards stay in your browser on your device. Clearing browser data deletes them, so print or keep a copy of important plans."],
	["How do refunds work?", `${REFUND_LINE} No change-of-mind refunds once you've had access. Open a ticket with your order reference.`],
	["How does the classroom or business link work?", "After checkout you get one link. Share it with your class or team. Each person who opens it gets the full app on their own device."],
	["Can I install it like an app?", "Yes. On Android tap the menu and choose Install app. On iPhone tap Share, then Add to Home Screen."],
];

function systemPrompt(): string {
	const prices = Object.values(PRODUCTS).map((p) => `${p.name} $${p.price} one-time (${p.who})`).join("; ");
	return `You are Bee, the AI support helper for ${BRAND}. Say you are an AI if asked, a browser study-planner app by Buzzyfly.
Answer in 1-4 short sentences in plain English. Only use these facts:
- What it does: you enter an exam date, topics and minutes per day, and it builds a day-by-day plan with reviews 1, 3 and 7 days after learning each topic, plus flashcards that resurface missed cards.
- Prices: ${prices}. No subscriptions.
- Free: ${FREE_LIMITS.exams} exam and ${FREE_LIMITS.cards} flashcards.
- Access: unlocks on the thank-you page after PayPal or card checkout. The unlock link opens it on other devices. Lost access: /restore with the PayPal order reference.
- Data stays in the user's browser. No accounts.
- Refunds: ${REFUND_LINE} No change-of-mind refunds once accessed.
- Install: Android menu > Install app; iPhone Share > Add to Home Screen.
FAQ: ${FAQ.map(([q, a]) => `${q} ${a}`).join(" ")}
If you don't know, or the user needs a refund, has a payment problem, or wants a human, tell them to open a ticket with the form on this page or email ${SUPPORT_EMAIL}.
Never promise grades or results. Never invent features, prices or policies. Never ask for card numbers or passwords.`;
}

export function supportPage(): Response {
	return html(
		page(
			"Help & support – Buzzyfly Study Plan",
			"Get help with Buzzyfly Study Plan: instant answers, or open a support ticket and a person replies.",
			`<section class="hero"><div class="wrap narrow">
<p class="eyebrow">Help &amp; support</p>
<h1>How can we help?</h1>
<p class="lede">Ask Bee, our AI helper, for an instant answer, or open a ticket and a person will reply within one business day. You can also email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
</div></section>
<section class="band"><div class="wrap narrow">
<h2>Ask Bee (AI helper)</h2>
<div id="chat" class="card" aria-live="polite"><p class="muted">Hi, I'm Bee, Buzzyfly's AI helper. Ask me anything about the app, access, refunds or licences.</p></div>
<form id="chat-form" class="form"><label for="chat-q">Your question</label><input id="chat-q" maxlength="500" autocomplete="off" required><button class="btn primary" type="submit">Ask</button></form>
<p class="note">Answers come from an AI assistant and can be wrong. For anything about money or access, open a ticket.</p>
</div></section>
<section><div class="wrap narrow">
<h2>Common questions</h2>
${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
</div></section>
<section class="band" id="ticket"><div class="wrap narrow">
<h2>Open a support ticket</h2>
<form class="form" method="post" action="/support/tickets">
<label for="t-name">Name (optional)</label><input id="t-name" name="name" maxlength="80" autocomplete="name">
<label for="t-email">Email (so we can reply)</label><input id="t-email" name="email" type="email" maxlength="200" required autocomplete="email">
<label for="t-topic">Topic</label><select id="t-topic" name="topic">${TOPICS.map((t) => `<option>${esc(t)}</option>`).join("")}</select>
<label for="t-order">Order reference (if you paid)</label><input id="t-order" name="order_ref" maxlength="80">
<label for="t-msg">What's happening?</label><textarea id="t-msg" name="body" maxlength="4000" required></textarea>
<input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
<button class="btn primary" type="submit">Send ticket</button>
</form>
<p class="note">You'll get a private link to check replies, and an email when we answer. We usually reply within one business day. Under 13? Ask a parent or teacher to contact us for you.</p>
</div></section>`,
			{ path: "/support", script: "/support.js?v=1" },
		),
	);
}

export async function chat(req: Request, env: Env): Promise<Response> {
	if (!sameOrigin(req)) return Response.json({ error: "bad origin" }, { status: 403 });
	if (await rateLimited(env, req, "chat", 30)) return Response.json({ reply: `You've asked a lot of questions this hour. Please open a ticket below or email ${SUPPORT_EMAIL}.` }, { status: 429 });
	let messages: { role: string; content: string }[] = [];
	try {
		const body = (await req.json()) as { messages?: unknown };
		if (Array.isArray(body.messages)) {
			messages = body.messages
				.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
				.slice(-8)
				.map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 800) }));
		}
	} catch {}
	if (!messages.length || messages[messages.length - 1].role !== "user") return Response.json({ error: "no question" }, { status: 400 });
	const fallback = `I can't answer right now. Please open a ticket below or email ${SUPPORT_EMAIL} and a person will help.`;
	if (!env.AI) return Response.json({ reply: fallback, ai: false });
	try {
		const out = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as any, {
			messages: [{ role: "system", content: systemPrompt() }, ...messages],
			max_tokens: 220,
		})) as { response?: string };
		return Response.json({ reply: (out.response || fallback).trim().slice(0, 1200), ai: true });
	} catch (e) {
		console.error("ai", e);
		return Response.json({ reply: fallback, ai: false });
	}
}

export async function createTicket(req: Request, env: Env): Promise<Response> {
	if (!sameOrigin(req)) return message("That form didn't come from this site", `<p><a href="/support">Back to support</a></p>`, 403);
	if (!env.DB) return message("Support is offline", `<p>Please email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`, 503);
	const f = await req.formData();
	if (clean(f.get("website"), 10)) return Response.redirect(new URL("/support", req.url).toString(), 303); // honeypot
	const email = clean(f.get("email"), 200);
	const body = clean(f.get("body"), 4000);
	const topic = TOPICS.includes(clean(f.get("topic"), 80)) ? clean(f.get("topic"), 80) : "Something else";
	if (!validEmail(email) || body.length < 3) return message("Please check the form", `<p>We need a valid email and a message. <a href="/support#ticket">Try again</a>.</p>`, 400);
	if (await rateLimited(env, req, "ticket", 5)) return message("Too many tickets", `<p>Please wait an hour or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`, 429);
	const secret = randomId();
	const t = await env.DB.prepare("INSERT INTO tickets (secret, name, email, topic, order_ref) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id")
		.bind(secret, clean(f.get("name"), 80) || null, email, topic, clean(f.get("order_ref"), 80) || null)
		.first<{ id: number }>();
	await env.DB.prepare("INSERT INTO ticket_messages (ticket_id, author, body) VALUES (?1, 'customer', ?2)").bind(t!.id, body).run();
	const link = `${new URL(req.url).origin}/support/ticket/${t!.id}?k=${secret}`;
	await Promise.all([
		sendTicketReceived(env, email, t!.id, link),
		notifyOwner(env, `New ticket #${t!.id}: ${topic}`, `From: ${email}\nOrder: ${clean(f.get("order_ref"), 80) || "-"}\n\n${body}\n\nReply in admin: ${new URL(req.url).origin}/admin/tickets/${t!.id}`),
	]);
	return Response.redirect(`${link}&new=1`, 303);
}

async function loadTicket(env: Env, id: number, key: string) {
	const t = await env.DB!.prepare("SELECT * FROM tickets WHERE id = ?1").bind(id).first<any>();
	if (!t || !key || t.secret !== key) return null;
	const msgs = await env.DB!.prepare("SELECT author, body, created_at FROM ticket_messages WHERE ticket_id = ?1 ORDER BY id").bind(id).all<any>();
	return { t, msgs: msgs.results };
}

export function renderThread(msgs: any[]): string {
	return msgs
		.map((m) => `<div class="card msg ${m.author === "support" ? "from-support" : ""}"><p class="note">${m.author === "support" ? "Buzzyfly support" : "You"} · ${esc(m.created_at)} UTC</p><p>${esc(m.body).replace(/\n/g, "<br>")}</p></div>`)
		.join("");
}

export async function ticketPage(req: Request, env: Env, id: number): Promise<Response> {
	const url = new URL(req.url);
	const key = url.searchParams.get("k") || "";
	if (!env.DB) return message("Support is offline", `<p>Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`, 503);
	if (req.method === "POST") {
		if (!sameOrigin(req)) return message("That form didn't come from this site", "", 403);
		const data = await loadTicket(env, id, key);
		if (!data) return message("Ticket not found", `<p><a href="/support">Back to support</a></p>`, 404);
		const body = clean((await req.formData()).get("body"), 4000);
		if (body.length >= 1) {
			if (await rateLimited(env, req, "reply", 20)) return message("Too many replies", "<p>Please wait a little.</p>", 429);
			await env.DB.batch([
				env.DB.prepare("INSERT INTO ticket_messages (ticket_id, author, body) VALUES (?1, 'customer', ?2)").bind(id, body),
				env.DB.prepare("UPDATE tickets SET status = 'open', updated_at = datetime('now') WHERE id = ?1").bind(id),
			]);
			await notifyOwner(env, `Customer replied on ticket #${id}`, `${body}\n\nReply in admin: ${url.origin}/admin/tickets/${id}`);
		}
		return Response.redirect(`${url.origin}/support/ticket/${id}?k=${key}`, 303);
	}
	const data = await loadTicket(env, id, key);
	if (!data) return message("Ticket not found", `<p>Check the link, or <a href="/support#ticket">open a new ticket</a>.</p>`, 404);
	const fresh = url.searchParams.get("new") === "1";
	return html(
		page(
			`Ticket #${id} – Buzzyfly support`,
			"Your support ticket.",
			`<section class="hero"><div class="wrap narrow">
<p class="eyebrow">Ticket #${id} · ${esc(data.t.topic)} · ${esc(data.t.status)}</p>
<h1>${fresh ? "Thanks. We've got your ticket." : "Your support ticket"}</h1>
${fresh ? `<p class="lede"><strong>Bookmark this page.</strong> It's your private link to read our reply. We usually reply within one business day.</p>` : ""}
${renderThread(data.msgs)}
<form class="form" method="post"><label for="r">Add a reply</label><textarea id="r" name="body" maxlength="4000" required></textarea><button class="btn" type="submit">Send reply</button></form>
</div></section>`,
			{ head: `<meta name="robots" content="noindex">` },
		),
	);
}
