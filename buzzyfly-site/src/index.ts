import { BRAND, FREE_LIMITS, PRODUCTS, REFUND_LINE, SUPPORT_EMAIL, productById, type Product } from "./config";
import { admin } from "./admin";
import { sendReceipt } from "./email";
import { legalPage } from "./legal";
import { esc, html, message, page, readCookie, type Env } from "./lib";
import { captureOrder, createOrder, paypalConfigured } from "./paypal";
import { chat, createTicket, supportPage, ticketPage } from "./support";
import { saveSurvey, surveyForm, surveyPage } from "./survey";
import { signPass, verifyPass, type Pass } from "./token";

export type { Env };

const COOKIE = "bf_study";
const ORIGIN = "https://paperclip.buzzyfly.com";
const PUBLIC_PAGES = ["/", "/app", "/schools", "/business", "/support", "/survey", "/about", "/terms", "/privacy", "/refunds", "/accessibility"];
const dollars = (p: Product) => p.price.replace(".00", "");

const passCookie = (token: string) => `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=315360000; HttpOnly; Secure; SameSite=Lax`;

function stripeLink(env: Env, p: Product): string | null {
	const raw = { student: env.STRIPE_LINK_STUDENT, classroom: env.STRIPE_LINK_CLASSROOM, team: env.STRIPE_LINK_TEAM }[p.id];
	const link = raw?.trim();
	return link && env.STRIPE_SECRET_KEY && /^https:\/\/buy\.stripe\.com\//.test(link) ? link : null;
}

function canSell(env: Env) {
	return Boolean(env.ACCESS_SECRET) && (paypalConfigured(env) || Object.values(PRODUCTS).some((p) => stripeLink(env, p)));
}

function buyButtons(env: Env, p: Product, primary: boolean): string {
	if (!canSell(env)) {
		return `<a class="btn ${primary ? "primary" : ""}" href="/support#ticket">Request ${esc(p.name)} – $${dollars(p)}</a>`;
	}
	const out: string[] = [];
	if (paypalConfigured(env)) out.push(`<a class="btn ${primary ? "primary" : ""}" href="/buy/${p.id}">Buy ${esc(p.name)} – $${dollars(p)}</a>`);
	const s = stripeLink(env, p);
	if (s) out.push(`<a class="btn ${out.length ? "" : primary ? "primary" : ""}" href="${esc(s)}">${out.length ? "Pay by card" : `Buy ${esc(p.name)} – $${dollars(p)}`}</a>`);
	return out.join("");
}

function priceCard(env: Env, p: Product, featured: boolean): string {
	return `<div class="card price ${featured ? "featured" : ""}">
${featured ? `<p class="badge">Most popular</p>` : ""}
<h3>${esc(p.name)}</h3>
<p class="amount">$${dollars(p)} <small>one time</small></p>
<p class="muted">${esc(p.who)}</p>
<ul class="fit">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<div class="ctas">${buyButtons(env, p, featured)}</div>
<p class="note">${esc(REFUND_LINE)}</p>
</div>`;
}

function jsonLd(): string {
	const data = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: BRAND,
		applicationCategory: "EducationalApplication",
		operatingSystem: "Web, Android, iOS (browser)",
		url: ORIGIN,
		description: "Day-by-day exam study plans with spaced review and flashcards.",
		offers: [{ "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" }].concat(
			Object.values(PRODUCTS).map((p) => ({ "@type": "Offer", price: p.price, priceCurrency: "USD", name: p.name })),
		),
	};
	return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

// ---------- pages ----------
function home(env: Env): string {
	return page(
		"Buzzyfly Study Plan – a day-by-day exam plan in two minutes",
		"Type your exam date and topics. Get a day-by-day study plan with spaced review and flashcards. Free for your first exam.",
		`<section class="hero"><div class="wrap">
<p class="eyebrow">For students, parents, teachers and teams</p>
<h1>Know exactly what to study tonight.</h1>
<p class="lede">Type your exam date and your topics. Get a day-by-day plan with review sessions spaced out so the material sticks. No more cramming the night before.</p>
<div class="ctas"><a class="btn primary" href="/app">Make my free plan</a><a class="btn" href="#pricing">See pricing</a></div>
<p class="note">Free for your first exam. No sign-up. Works on any phone or laptop, and installs like an app.</p>
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
<div class="grid">${priceCard(env, PRODUCTS.student, true)}${priceCard(env, PRODUCTS.classroom, false)}${priceCard(env, PRODUCTS.team, false)}</div>
<p class="note">Free version: ${FREE_LIMITS.exams} exam and up to ${FREE_LIMITS.cards} flashcards. Upgrading keeps everything you've made.</p>
</div></section>

<section id="faq"><div class="wrap">
<h2>Questions</h2>
<details><summary>Is this a subscription?</summary><p>No. You pay once and keep the app.</p></details>
<details><summary>How do I get in after paying?</summary><p>The app unlocks on the thank-you page right after checkout. Save the link it shows you to open it on other devices.</p></details>
<details><summary>Where is my data kept?</summary><p>In your own browser, on your device. We don't collect your plans, your cards or your name.</p></details>
<details><summary>Which subjects does it work for?</summary><p>Any subject with an exam date and a list of topics: school tests, finals, SAT/ACT, GCSE, A-levels, professional licences and certifications.</p></details>
<details><summary>What if I need help?</summary><p>Use <a href="/support">Help &amp; support</a> for instant answers or a ticket answered by a person. ${esc(REFUND_LINE)}</p></details>
</div></section>`,
		{ head: jsonLd() },
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
<div class="card"><h3>Easy to buy</h3><p class="muted">One-time $99 per teacher. Pay by card or PayPal. Need an invoice or purchase order? <a href="/support#ticket">Ask support</a>.</p></div>
</div></section>
<section><div class="wrap">
<h2>How to roll it out</h2>
<ol class="steps">
<li><strong>Buy the classroom licence.</strong> You get a class link on the thank-you page.</li>
<li><strong>Post the link</strong> in Google Classroom, Teams, Canvas or on the board.</li>
<li><strong>Students open it</strong> and make their plan in two minutes.</li>
</ol>
<p class="note">${esc(REFUND_LINE)}</p>
</div></section>
<section class="band" id="survey"><div class="wrap narrow"><h2>What would help your students most?</h2>${surveyForm("business")}</div></section>`,
		{ path: "/schools" },
	);
}

function business(env: Env): string {
	return page(
		"Buzzyfly Study Plan for businesses – certification study plans for your team",
		"Help staff pass licence and certification exams. Day-by-day plans with spaced review for up to 25 people. $299 one-time.",
		`<section class="hero"><div class="wrap">
<p class="eyebrow">For companies and training providers</p>
<h1>Get your team through their certification exams.</h1>
<p class="lede">Staff studying for IT, finance, nursing, trades or safety exams get a day-by-day plan that fits around work, with spaced review and flashcards. One link for up to 25 people.</p>
<div class="ctas">${buyButtons(env, PRODUCTS.team, true)}<a class="btn" href="#survey">Tell us what your team needs</a></div>
</div></section>
<section class="band"><div class="wrap grid">
<div class="card"><h3>Fits a working week</h3><p class="muted">Each person sets their own minutes per day. The plan spreads topics out and saves the final days for mixed review.</p></div>
<div class="card"><h3>No IT project</h3><p class="muted">Works in any browser and installs like an app. No accounts, no integrations, no staff data collected.</p></div>
<div class="card"><h3>Simple to buy</h3><p class="muted">$299 once, for up to 25 staff. Pay by card or PayPal. Invoices and larger teams: <a href="/support#ticket">ask support</a>.</p></div>
</div></section>
<section id="survey"><div class="wrap narrow">
<h2>What does your business need?</h2>
<p class="lede">We build tools businesses ask for. Tell us what your people struggle with, and we'll tell you if we can build it.</p>
${surveyForm("business")}
</div></section>`,
		{ path: "/business" },
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
		{ path: "/app", script: "/app.js?v=3" },
	);
}

async function isRefunded(env: Env, ref: string): Promise<boolean> {
	if (!env.DB) return false;
	try {
		const row = await env.DB.prepare("SELECT status FROM orders WHERE ref = ?1").bind(ref).first<{ status: string }>();
		return row?.status === "refunded";
	} catch {
		return false; // database hiccup: never lock out a paying customer
	}
}

/** A valid signature AND an order that hasn't been refunded. */
async function activePass(env: Env, token: string | null): Promise<Pass | null> {
	const pass = await verifyPass(env.ACCESS_SECRET, token);
	if (!pass) return null;
	return (await isRefunded(env, pass.o)) ? null : pass;
}

/** Returns true the first time an order is recorded (so the receipt is emailed once). */
async function recordOrder(env: Env, o: { ref: string; provider: string; product: Product; amount: string; currency: string; email: string | null; source: string | null }): Promise<boolean> {
	if (!env.DB) return false;
	try {
		const r = await env.DB.prepare("INSERT OR IGNORE INTO orders (ref, provider, product, amount, currency, email, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
			.bind(o.ref, o.provider, o.product.id, o.amount, o.currency, o.email, o.source)
			.run();
		return (r.meta?.changes ?? 0) > 0;
	} catch (e) {
		console.error("recordOrder", e);
		return false;
	}
}

async function thankYou(env: Env, product: Product, ref: string, email: string | null, isNew: boolean): Promise<Response> {
	const token = await signPass(env.ACCESS_SECRET!, { p: product.id, o: ref, t: Date.now() });
	const link = `${ORIGIN}/unlock?t=${encodeURIComponent(token)}`;
	const emailed = isNew ? await sendReceipt(env, email, product, ref, link) : false;
	const label =
		product.id === "classroom"
			? "Your class link (post it for your students):"
			: product.id === "team"
				? "Your team link (share it with up to 25 staff):"
				: "Your personal unlock link. Save it to open the app on another phone or laptop:";
	return html(
		page(
			"You're in – Buzzyfly Study Plan",
			"Thanks for your order.",
			`<section class="hero"><div class="wrap narrow">
<p class="eyebrow">Payment received</p>
<h1>You're in. The full app is unlocked.</h1>
<div class="ctas"><a class="btn primary" href="/app">Open my study planner</a></div>
<p><strong>${label}</strong></p>
<pre><code id="link">${esc(link)}</code></pre>
<button class="copy" type="button" data-copy="link">Copy link</button>
<p class="note">${emailed ? `We've also emailed this link to ${esc(email)} as a backup. ` : ""}Your order reference: ${esc(ref)}. Lost the link? Use <a href="/restore">Lost access</a> or <a href="/support">support</a>. ${esc(REFUND_LINE)}</p>
</div></section>`,
			{ script: "/copy.js?v=1", head: `<meta name="robots" content="noindex">` },
		),
		200,
		{ "set-cookie": passCookie(token) },
	);
}

async function stripeSession(env: Env, id: string) {
	const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
		headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
	});
	if (!res.ok) return null;
	const s = (await res.json()) as { payment_status?: string; amount_total?: number; currency?: string; customer_details?: { email?: string } };
	return { paid: s.payment_status === "paid", cents: s.amount_total ?? 0, currency: s.currency ?? "", email: s.customer_details?.email ?? null };
}

// ---------- router ----------
export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		const path = url.pathname.replace(/\/+$/, "") || "/";
		const method = req.method;

		try {
			if (method === "POST") {
				if (path === "/support/tickets") return createTicket(req, env);
				if (path === "/api/support/chat") return chat(req, env);
				if (path === "/survey") return saveSurvey(req, env);
				const t = path.match(/^\/support\/ticket\/(\d+)$/);
				if (t) return ticketPage(req, env, +t[1]);
				if (path.startsWith("/admin")) return admin(req, env, path);
				return new Response("Method not allowed", { status: 405 });
			}
			if (method !== "GET" && method !== "HEAD") return new Response("Method not allowed", { status: 405 });

			if (path === "/") return html(home(env));
			if (path === "/schools") return html(schools(env));
			if (path === "/business") return html(business(env));
			if (path === "/app") return html(appPage(await activePass(env, readCookie(req, COOKIE))));
			if (path === "/support") return supportPage();
			if (path === "/survey") return surveyPage();
			const legal = legalPage(path);
			if (legal) return legal;
			if (path === "/.well-known/security.txt") {
				return new Response(`Contact: mailto:${SUPPORT_EMAIL}\nExpires: 2027-12-31T23:59:59Z\nPreferred-Languages: en\nCanonical: ${ORIGIN}/.well-known/security.txt\nPolicy: ${ORIGIN}/terms#security\n`, { headers: { "content-type": "text/plain" } });
			}
			const t = path.match(/^\/support\/ticket\/(\d+)$/);
			if (t) return ticketPage(req, env, +t[1]);
			if (path.startsWith("/admin")) return admin(req, env, path);

			if (path === "/robots.txt") return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /support/ticket/\nSitemap: ${ORIGIN}/sitemap.xml\n`, { headers: { "content-type": "text/plain" } });
			if (path === "/sitemap.xml") {
				const urls = PUBLIC_PAGES.map((p) => `<url><loc>${ORIGIN}${p === "/" ? "/" : p}</loc></url>`).join("");
				return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "content-type": "application/xml" } });
			}
			// Digital Asset Links: lets the Play Store app (Trusted Web Activity) open this site full-screen.
			if (path === "/.well-known/assetlinks.json") {
				const fps = (env.ANDROID_SHA256 || "").split(",").map((s) => s.trim()).filter(Boolean);
				const body = fps.length
					? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: env.ANDROID_PACKAGE || "com.buzzyfly.studyplan", sha256_cert_fingerprints: fps } }]
					: [];
				return Response.json(body, { headers: { "cache-control": "public, max-age=3600" } });
			}

			if (path === "/api/health") {
				return Response.json({
					ok: true,
					db: Boolean(env.DB),
					ai: Boolean(env.AI),
					admin: Boolean(env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 16),
					accessSecret: Boolean(env.ACCESS_SECRET),
					paypal: paypalConfigured(env),
					stripe: Object.fromEntries(Object.values(PRODUCTS).map((p) => [p.id, Boolean(stripeLink(env, p))])),
					android: Boolean(env.ANDROID_SHA256),
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
					source: url.searchParams.get("src")?.replace(/[^\w.-]/g, "").slice(0, 60) || null,
				});
				return Response.redirect(order.approveUrl, 302);
			}

			if (path === "/paypal/return" || path === "/restore/paypal") {
				const orderId = (url.searchParams.get("token") || url.searchParams.get("order") || "").trim().toUpperCase();
				if (!/^[A-Z0-9]{8,40}$/.test(orderId)) return message("We couldn't find that order", `<p>Check the order reference and try <a href="/restore">Lost access</a> again.</p>`, 400);
				if (!env.ACCESS_SECRET || !paypalConfigured(env)) return message("Checkout is offline", `<p>Please <a href="/support#ticket">open a ticket</a>.</p>`, 503);
				const c = await captureOrder(env, orderId);
				const p = productById(c.customId);
				if (!c.completed || !p || c.amount !== p.price || c.currency !== "USD") {
					return message("Payment not completed", `<p>PayPal hasn't confirmed this payment. If you were charged, <a href="/support#ticket">open a ticket</a> with reference ${esc(orderId)}.</p>`, 402);
				}
				const isNew = await recordOrder(env, { ref: orderId, provider: "paypal", product: p, amount: c.amount!, currency: c.currency!, email: c.payerEmail, source: c.source });
				if (!isNew && (await isRefunded(env, orderId))) {
					return message("This order was refunded", `<p>Access for order ${esc(orderId)} ended when it was refunded. Questions? <a href="/support#ticket">Open a ticket</a>.</p>`, 403);
				}
				return thankYou(env, p, orderId, c.payerEmail, isNew);
			}

			if (path === "/stripe/return") {
				const id = url.searchParams.get("session_id") || "";
				const p = productById(url.searchParams.get("p"));
				if (!p || !/^cs_[A-Za-z0-9_]{10,200}$/.test(id) || !env.STRIPE_SECRET_KEY || !env.ACCESS_SECRET) {
					return message("We couldn't confirm that payment", `<p><a href="/support#ticket">Open a ticket</a> and we'll sort it out.</p>`, 400);
				}
				const s = await stripeSession(env, id);
				if (!s || !s.paid || s.cents !== p.cents || s.currency !== "usd") {
					return message("Payment not completed", `<p>Stripe hasn't confirmed this payment. If you were charged, <a href="/support#ticket">open a ticket</a>.</p>`, 402);
				}
				const isNew = await recordOrder(env, { ref: id, provider: "stripe", product: p, amount: p.price, currency: "USD", email: s.email, source: null });
				if (!isNew && (await isRefunded(env, id))) {
					return message("This order was refunded", `<p>Access for this order ended when it was refunded. Questions? <a href="/support#ticket">Open a ticket</a>.</p>`, 403);
				}
				return thankYou(env, p, id, s.email, isNew);
			}

			if (path === "/unlock") {
				const tk = url.searchParams.get("t");
				const pass = await activePass(env, tk);
				if (!pass) return message("That unlock link isn't valid (or the order was refunded)", `<p>Try <a href="/restore">Lost access</a> or <a href="/support">support</a>.</p>`, 400);
				return new Response(null, { status: 302, headers: { location: "/app", "set-cookie": passCookie(tk!) } });
			}

			if (path === "/restore") {
				return message(
					"Lost access?",
					`<p>Paid with PayPal? Enter the order reference shown on your thank-you page.</p>
<form action="/restore/paypal" method="get" class="form"><label for="order">PayPal order reference</label><input id="order" name="order" required pattern="[A-Za-z0-9]{8,40}" autocomplete="off"><button class="btn primary" type="submit">Unlock my app</button></form>
<p>Paid by card, or can't find the reference? <a href="/support#ticket">Open a support ticket</a> with the email you paid with.</p>`,
				);
			}

			const asset = await env.ASSETS.fetch(req);
			if (asset.status !== 404) return asset;
			return message("That page isn't here", `<p><a href="/">Back to the home page</a></p>`, 404);
		} catch (err) {
			console.error(err);
			return message("Something went wrong", `<p>Please try again. If you paid and this keeps happening, <a href="/support#ticket">open a ticket</a> or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`, 500);
		}
	},
} satisfies ExportedHandler<Env>;
