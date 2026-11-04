import { REFUND_LINE, SUPPORT_EMAIL } from "./config";

export interface Env {
	ASSETS: Fetcher;
	DB?: D1Database;
	AI?: Ai;
	ACCESS_SECRET?: string;
	ADMIN_TOKEN?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_LINK_STUDENT?: string;
	STRIPE_LINK_CLASSROOM?: string;
	STRIPE_LINK_TEAM?: string;
	ANDROID_PACKAGE?: string;
	ANDROID_SHA256?: string;
	OWNER_EMAIL?: string;
	EMAIL?: {
		send(message: { from: string; to: string; subject: string; html?: string; text?: string; headers?: Record<string, string> }): Promise<unknown>;
	};
	[key: string]: unknown;
}

export const esc = (s: unknown) =>
	String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(body, {
		status,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			"x-content-type-options": "nosniff",
			"referrer-policy": "strict-origin-when-cross-origin",
			"x-frame-options": "DENY",
			"strict-transport-security": "max-age=31536000; includeSubDomains",
			"permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
			"cross-origin-opener-policy": "same-origin",
			"content-security-policy":
				"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self' https://www.paypal.com https://buy.stripe.com; frame-ancestors 'none'; base-uri 'none'",
			...headers,
		},
	});
}

export function readCookie(req: Request, name: string): string | null {
	const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
	return m ? decodeURIComponent(m[1]) : null;
}

/** Rejects cross-site form posts. Browsers always send Origin on POST. */
export function sameOrigin(req: Request): boolean {
	const origin = req.headers.get("origin");
	return !!origin && origin === new URL(req.url).origin;
}

export async function sha256(s: string): Promise<string> {
	const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
	return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return r === 0;
}

export function randomId(bytes = 18): string {
	const b = crypto.getRandomValues(new Uint8Array(bytes));
	return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Fixed-window rate limit per client per hour, stored in D1. Fails open if D1 is missing. */
export async function rateLimited(env: Env, req: Request, name: string, max: number): Promise<boolean> {
	if (!env.DB) return false;
	const ip = req.headers.get("cf-connecting-ip") || "local";
	const hour = Math.floor(Date.now() / 3_600_000);
	const bucket = `${name}:${(await sha256(`${ip}|${hour}`)).slice(0, 24)}`;
	const row = await env.DB.prepare(
		"INSERT INTO rate_limits (bucket, count, expires_at) VALUES (?1, 1, ?2) ON CONFLICT(bucket) DO UPDATE SET count = count + 1 RETURNING count",
	)
		.bind(bucket, (hour + 2) * 3_600_000)
		.first<{ count: number }>();
	if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?1").bind(Date.now()).run();
	return (row?.count ?? 0) > max;
}

export const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
export const validEmail = (e: string) => /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/i.test(e);

export function page(
	title: string,
	description: string,
	main: string,
	opts: { path?: string; script?: string; head?: string } = {},
): string {
	return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="https://paperclip.buzzyfly.com${esc(opts.path ?? "/")}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website"><meta property="og:image" content="https://paperclip.buzzyfly.com/icon-512.png">
<meta name="theme-color" content="#ffc533">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon-192.png">
<link rel="stylesheet" href="/styles.css?v=3">
${opts.head ?? ""}
</head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
<a class="brand" href="/">📚 Buzzyfly <span>Study Plan</span></a>
<nav aria-label="Main"><a href="/app">Open the app</a><a href="/schools">Teachers</a><a href="/business">Business</a><a href="/support">Help</a></nav>
</div></header>
<main id="main">${main}</main>
<footer><div class="wrap">
<p>${esc(REFUND_LINE)} One-time price. No subscription.</p>
<p><a href="/support">Help &amp; support</a> · <a href="/about">About us</a> · <a href="/survey">Tell us what you need</a> · <a href="/restore">Lost access?</a></p>
<p><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/refunds">Refunds</a> · <a href="/accessibility">Accessibility</a> · <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> · A <a href="https://www.buzzyfly.com/">Buzzyfly</a> app</p>
<p class="note">Not affiliated with any exam board or test maker. Exam names are trademarks of their owners.</p>
</div></footer>
<script src="/pwa.js?v=1" defer></script>
${opts.script ? `<script src="${opts.script}" defer></script>` : ""}
</body></html>`;
}

export function message(title: string, body: string, status = 200): Response {
	return html(page(title, title, `<section class="hero"><div class="wrap narrow"><h1>${esc(title)}</h1>${body}</div></section>`), status);
}
