import { BRAND, FREE_LIMITS, PRODUCTS, REFUND_LINE, SUPPORT_EMAIL, productById, type Product } from "./config";
import { captureOrder, createOrder, paypalConfigured } from "./paypal";
import { signPass, verifyPass, type Pass } from "./token";

export interface Env {
	ASSETS: Fetcher;
	ACCESS_SECRET?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_LINK_STUDENT?: string;
	STRIPE_LINK_CLASSROOM?: string;
	[key: string]: unknown;
}

const COOKIE = "bf_study";

// ---------- helpers ----------
const esc = (s: unknown) =>
	String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(body, {
		status,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			"x-content-type-options": "nosniff",
			"referrer-policy": "strict-origin-when-cross-origin",
			"x-frame-options": "DENY",
			...headers,
		},
	});
}

function readCookie(req: Request, name: string): string | null {
	const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
	return m ? decodeURIComponent(m[1]) : null;
}

const passCookie = (token: string) => `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=315360000; HttpOnly; Secure; SameSite=Lax`;

function stripeLink(env: Env, p: Product): string | null {
	const link = (p.id === "student" ? env.STRIPE_LINK_STUDENT : env.STRIPE_LINK_CLASSROOM)?.trim();
	return link && env.STRIPE_SECRET_KEY && /^https:\/\/buy\.stripe\.com\//.test(link) ? link : null;
}

function canSell(env: Env) {
	return Boolean(env.ACCESS_SECRET) && (paypalConfigured(env) || Object.values(PRODUCTS).some((p) => stripeLink(env, p)));
}

// ---------- layout ----------
function page(title: string, description: string, main: string, opts: { path?: string; script?: string } = {}): string {
	return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="https://paperclip.buzzyfly.com${esc(opts.path ?? "/")}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css?v=1">
</head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
<a class="brand" href="/">📚 Buzzyfly <span>Study Plan</span></a>
<nav aria-label="Main"><a href="/app">Open the app</a><a href="/schools">For teachers</a><a href="/#pricing">Pricing</a></nav>
</div></header>
<main id="main">${main}</main>
<footer><div class="wrap">
<p>${esc(REFUND_LINE)} One-time price. No subscription.</p>
<p>Questions? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> · <a href="/restore">Lost access?</a> · <a href="/terms">Terms &amp; privacy</a> · A <a href="https://www.buzzyfly.com/">Buzzyfly</a> app</p>
</div></footer>
${opts.script ? `<script src="${opts.script}" defer></script>` : ""}
</body></html>`;
}

function buyButtons(env: Env, p: Product, primary: boolean): string {
	if (!canSell(env)) {
		return `<a class="btn ${primary ? "primary" : ""}" href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${BRAND} – ${p.name} ($${p.price})`)}">Email us to buy – $${p.price.replace(".00", "")}</a>`;
	}
	const out: string[] = [];
	if (paypalConfigured(env)) out.push(`<a class="btn ${primary ? "primary" : ""}" href="/buy/${p.id}">Buy ${esc(p.name)} – $${p.price.replace(".00", "")}</a>`);
	const s = stripeLink(env, p);
	if (s) out.push(`<a class="btn ${out.length ? "" : primary ? "primary" : ""}" href="${esc(s)}">${out.length ? "Pay by card" : `Buy ${esc(p.name)} – $${p.price.replace(".00", "")}`}</a>`);
	return out.join("");
}

function priceCard(env: Env, p: Product, featured: boolean): string {
	return `<div class="card price ${featured ? "featured" : ""}">
${featured ? `<p class="badge">Most popular</p>` : ""}
<h3>${esc(p.name)}</h3>
<p class="amount">$${p.price.replace(".00", "")} <small>one time</small></p>
<p class="muted">${esc(p.who)}</p>
<ul class="fit">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<div class="ctas">${buyButtons(env, p, featured)}</div>
<p class="note">${esc(REFUND_LINE)}</p>
</div>`;
}

// ---------- pages ----------
function home(env: Env): string {
	return page(
		"Buzzyfly Study Plan – a day-by-day exam plan in two minutes",
		"Type your exam date and topics. Get a day-by-day study plan with spaced review and flashcards. Free for your first exam.",
		`<section class="hero"><div class="wrap">
<p class="eyebrow">For students, parents and teachers</p>
<h1>Know exactly what to study tonight.</h1>
<p class="lede">Type your exam date and your topics. Get a day-by-day plan with review sessions spaced out so the material sticks. No more cramming the night before.</p>
<div class="ctas"><a class="btn primary" href="/app">Make my free plan</a><a class="btn" href="#pricing">See pricing</a></div>
<p class="note">Free for your first exam. No sign-up. Works on any phone or laptop.</p>
</div></section>

<section class="band"><div class="wrap">
<h2>Cramming feels productive. Then the exam comes.</h2>
<div class="grid">
<div class="card"><h3>Before</h3><p class="muted">A pile of notes, a vague "I'll start this weekend", and a panicked all-nighter.</p></div>
<div class="card"><h3>After</h3><p class="muted">A short list for today. Each topic comes back 1, 3 and 7 days later. The last days are mixed review.</p></div>
</div></div></section>

<section><div class="wrap">
<h2>How it works</h2>
<ol class="steps">
<li><strong>Add your exam.</strong> Name, date and how many minutes a day you can give it.</li>
<li><strong>List your topics.</strong> One per line. Copy them from the syllabus.</li>
<li><strong>Follow today's list.</strong> Tick things off. Drill your flashcards. The plan does the scheduling.</li>
</ol>
<div class="ctas"><a class="btn primary" href="/app">Try it free</a></div>
</div></section>

<section class="band" id="pricing"><div class="wrap">
<h2>One price. Yours to keep.</h2>
<div class="grid">${priceCard(env, PRODUCTS.student, true)}${priceCard(env, PRODUCTS.classroom, false)}</div>
<p class="note">Free version: ${FREE_LIMITS.exams} exam and up to ${FREE_LIMITS.cards} flashcards. Upgrading keeps everything you've made.</p>
</div></section>

<section id="faq"><div class="wrap">
<h2>Questions</h2>
<details><summary>Is this a subscription?</summary><p>No. You pay once and keep the app.</p></details>
<details><summary>How do I get in after paying?</summary><p>The app unlocks on the thank-you page right after checkout. Save the link it shows you to open it on other devices.</p></details>
<details><summary>Where is my data kept?</summary><p>In your own browser, on your device. We don't collect your plans, your cards or your name.</p></details>
<details><summary>Which subjects does it work for?</summary><p>Any subject with an exam date and a list of topics: school tests, finals, SAT/ACT, GCSE, A-levels, licensing exams.</p></details>
<details><summary>What if it isn't for me?</summary><p>${esc(REFUND_LINE)} No change-of-mind refunds once you've had access. Email ${SUPPORT_EMAIL}.</p></details>
</div></section>`,
	);
}

function schools(env: Env): string {
	return page(
		"Buzzyfly Study Plan for teachers and schools",
		"Give your whole class a study plan app with one link. One-time $99 classroom licence. No student accounts or emails.",
		`<section class="hero"><div class="wrap">
<p class="eyebrow">For teachers, tutors and schools</p>
<h1>Give every student a study plan before the next test.</h1>
<p class="lede">Share one link. Each student enters the test date and topics and gets their own day-by-day plan with spaced review and flashcards. Nothing to install. No student accounts.</p>
<div class="ctas">${buyButtons(env, PRODUCTS.classroom, true)}<a class="btn" href="/app">Try it as a student</a></div>
</div></section>
<section class="band"><div class="wrap grid">
<div class="card"><h3>Privacy-friendly by design</h3><p class="muted">Plans stay in each student's browser. We collect no student names or emails, and there are no ads or trackers.</p></div>
<div class="card"><h3>Built on how memory works</h3><p class="muted">Topics come back after 1, 3 and 7 days, which is spaced practice. Flashcards resurface the ones a student gets wrong.</p></div>
<div class="card"><h3>Easy to buy</h3><p class="muted">One-time $99 per teacher. Pay by card or PayPal. Need an invoice or a purchase order? Email ${SUPPORT_EMAIL}.</p></div>
</div></section>
<section><div class="wrap">
<h2>How to roll it out</h2>
<ol class="steps">
<li><strong>Buy the classroom licence.</strong> You get a class link on the thank-you page.</li>
<li><strong>Post the link</strong> in Google Classroom, Teams, Canvas or on the board.</li>
<li><strong>Students open it</strong> and make their plan in two minutes.</li>
</ol>
<p class="note">${esc(REFUND_LINE)}</p>
</div></section>`,
		{ path: "/schools" },
	);
}

function appPage(pass: Pass | null): string {
	const tier = pass ? esc(pass.p) : "free";
	return page(
		"Study planner – Buzzyfly Study Plan",
		"Build your day-by-day exam study plan.",
		`<div class="wrap app" id="app" data-tier="${tier}" data-free-exams="${FREE_LIMITS.exams}" data-free-cards="${FREE_LIMITS.cards}">
<noscript><p>This app needs JavaScript turned on.</p></noscript>
<p class="muted">Loading your plans…</p>
</div>`,
		{ path: "/app", script: "/app.js?v=1" },
	);
}

function message(title: string, body: string, status = 200): Response {
	return html(page(title, title, `<section class="hero"><div class="wrap narrow"><h1>${esc(title)}</h1>${body}</div></section>`), status);
}

async function thankYou(env: Env, product: Product, ref: string): Promise<Response> {
	const token = await signPass(env.ACCESS_SECRET!, { p: product.id, o: ref, t: Date.now() });
	const link = `https://paperclip.buzzyfly.com/unlock?t=${encodeURIComponent(token)}`;
	const classNote =
		product.id === "classroom"
			? `<p><strong>Your class link</strong> (post it for your students):</p>`
			: `<p><strong>Your personal unlock link.</strong> Save it to open the app on another phone or laptop:</p>`;
	return html(
		page(
			"You're in – Buzzyfly Study Plan",
			"Thanks for your order.",
			`<section class="hero"><div class="wrap narrow">
<p class="eyebrow">Payment received</p>
<h1>You're in. The full app is unlocked.</h1>
<div class="ctas"><a class="btn primary" href="/app">Open my study planner</a></div>
${classNote}
<pre><code id="link">${esc(link)}</code></pre>
<button class="copy" type="button" data-copy="link">Copy link</button>
<p class="note">Your order reference: ${esc(ref)}. Lost the link? Use <a href="/restore">Lost access</a> with this reference. ${esc(REFUND_LINE)}</p>
</div></section>`,
			{ script: "/copy.js?v=1" },
		),
		200,
		{ "set-cookie": passCookie(token) },
	);
}

// ---------- Stripe ----------
async function stripeSession(env: Env, id: string): Promise<{ paid: boolean; cents: number; currency: string } | null> {
	const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
		headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
	});
	if (!res.ok) return null;
	const s = (await res.json()) as { payment_status?: string; amount_total?: number; currency?: string };
	return { paid: s.payment_status === "paid", cents: s.amount_total ?? 0, currency: s.currency ?? "" };
}

// ---------- router ----------
export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		const path = url.pathname.replace(/\/+$/, "") || "/";
		if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

		try {
			if (path === "/") return html(home(env));
			if (path === "/schools") return html(schools(env));
			if (path === "/app") return html(appPage(await verifyPass(env.ACCESS_SECRET, readCookie(req, COOKIE))));

			if (path === "/api/health") {
				return Response.json({
					ok: true,
					accessSecret: Boolean(env.ACCESS_SECRET),
					paypal: paypalConfigured(env),
					stripe: Object.fromEntries(Object.values(PRODUCTS).map((p) => [p.id, Boolean(stripeLink(env, p))])),
					selling: canSell(env),
				});
			}

			const buy = path.match(/^\/buy\/([a-z]+)$/);
			if (buy) {
				const p = productById(buy[1]);
				if (!p) return message("That product doesn't exist", `<p><a href="/#pricing">See pricing</a></p>`, 404);
				if (!env.ACCESS_SECRET || !paypalConfigured(env)) return Response.redirect(`${url.origin}/#pricing`, 302);
				const order = await createOrder(env, {
					itemId: p.id,
					amount: p.price,
					currency: "USD",
					description: `${BRAND} – ${p.name}`,
					returnUrl: `${url.origin}/paypal/return`,
					cancelUrl: `${url.origin}/#pricing`,
					source: url.searchParams.get("src")?.slice(0, 60) || null,
				});
				return Response.redirect(order.approveUrl, 302);
			}

			if (path === "/paypal/return" || path === "/restore/paypal") {
				const orderId = (url.searchParams.get("token") || url.searchParams.get("order") || "").trim();
				if (!/^[A-Z0-9]{8,40}$/.test(orderId)) return message("We couldn't find that order", `<p>Check the order reference and try <a href="/restore">Lost access</a> again.</p>`, 400);
				const c = await captureOrder(env, orderId);
				const p = productById(c.customId);
				if (!c.completed || !p || c.amount !== p.price || c.currency !== "USD") {
					return message("Payment not completed", `<p>PayPal hasn't confirmed this payment. If you were charged, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with reference ${esc(orderId)}.</p>`, 402);
				}
				return thankYou(env, p, orderId);
			}

			if (path === "/stripe/return") {
				const id = url.searchParams.get("session_id") || "";
				const p = productById(url.searchParams.get("p"));
				if (!p || !/^cs_[A-Za-z0-9_]{10,200}$/.test(id) || !env.STRIPE_SECRET_KEY || !env.ACCESS_SECRET) {
					return message("We couldn't confirm that payment", `<p>Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and we'll sort it out.</p>`, 400);
				}
				const s = await stripeSession(env, id);
				if (!s || !s.paid || s.cents !== p.cents || s.currency !== "usd") {
					return message("Payment not completed", `<p>Stripe hasn't confirmed this payment. If you were charged, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`, 402);
				}
				return thankYou(env, p, id);
			}

			if (path === "/unlock") {
				const t = url.searchParams.get("t");
				const pass = await verifyPass(env.ACCESS_SECRET, t);
				if (!pass) return message("That unlock link isn't valid", `<p>Try <a href="/restore">Lost access</a> or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`, 400);
				return new Response(null, { status: 302, headers: { location: "/app", "set-cookie": passCookie(t!) } });
			}

			if (path === "/restore") {
				return message(
					"Lost access?",
					`<p>Paid with PayPal? Enter the order reference shown on your thank-you page.</p>
<form action="/restore/paypal" method="get" class="form"><label for="order">PayPal order reference</label><input id="order" name="order" required pattern="[A-Za-z0-9]{8,40}" autocomplete="off"><button class="btn primary" type="submit">Unlock my app</button></form>
<p>Paid by card, or still stuck? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with the email you paid with.</p>`,
				);
			}

			if (path === "/terms") {
				return message(
					"Terms & privacy",
					`<p>${BRAND} is a browser app sold by Buzzyfly. You pay once. There is no subscription.</p>
<p><strong>Refunds.</strong> 30-day refund if you can't get into the app or it isn't what the listing described. No change-of-mind refunds once you've had access.</p>
<p><strong>Your data.</strong> Plans and flashcards are stored in your browser on your device. We don't see them. Payments are handled by PayPal or Stripe. We keep the order reference so we can restore access.</p>
<p><strong>Classroom licence.</strong> One licence covers one teacher's classes.</p>
<p><strong>Limits on our liability.</strong> The app helps you plan. It does not promise any grade or result. Our total liability is limited to what you paid.</p>
<p>Contact: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`,
				);
			}

			// Static files (app.js, styles.css, favicon)
			const asset = await env.ASSETS.fetch(req);
			if (asset.status !== 404) return asset;
			return message("That page isn't here", `<p><a href="/">Back to the home page</a></p>`, 404);
		} catch (err) {
			console.error(err);
			return message("Something went wrong", `<p>Please try again. If you paid and this keeps happening, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`, 500);
		}
	},
} satisfies ExportedHandler<Env>;
