// Transactional email through the Cloudflare Email Service binding (same setup
// buzzyfly.com already uses). Every send is best-effort: a failed email never
// blocks a purchase or a ticket, because the same information is always on screen.
import { BRAND, PRODUCTS, REFUND_LINE, SUPPORT_EMAIL, type Product } from "./config";
import { esc, ownerInbox, type Env } from "./lib";

const FROM_ORDERS = `${BRAND} <orders@buzzyfly.com>`;
const FROM_SUPPORT = `Buzzyfly Support <support@buzzyfly.com>`;
const ORIGIN = "https://paperclip.buzzyfly.com";

function wrap(body: string): string {
	return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#1a1a1a;max-width:540px;margin:0 auto;padding:24px">
${body}
<hr style="border:none;border-top:1px solid #e8e2d2;margin:24px 0">
<p style="font-size:13px;color:#555">${esc(BRAND)} by Buzzyfly · <a href="${ORIGIN}/support">Help &amp; support</a> · <a href="${ORIGIN}/privacy">Privacy</a> · ${esc(SUPPORT_EMAIL)}</p>
</body></html>`;
}

const button = (href: string, label: string) =>
	`<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#ffc533;color:#1a1a1a;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">${esc(label)}</a></p>`;

async function send(env: Env, msg: { from: string; to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<boolean> {
	if (!env.EMAIL || !msg.to) return false;
	try {
		await env.EMAIL.send({
			from: msg.from,
			to: msg.to,
			subject: msg.subject,
			html: msg.html,
			text: msg.text,
			headers: msg.replyTo ? { "Reply-To": msg.replyTo } : undefined,
		});
		return true;
	} catch (e) {
		console.error("email send failed", e);
		return false;
	}
}

const NEXT: Partial<Record<Product["id"], Product["id"]>> = { student: "classroom", classroom: "team" };

export function sendReceipt(env: Env, to: string | null, product: Product, ref: string, unlockLink: string) {
	if (!to) return Promise.resolve(false);
	const next = NEXT[product.id] ? PRODUCTS[NEXT[product.id]!] : null;
	const who = product.id === "classroom" ? "Share this link with your class:" : product.id === "team" ? "Share this link with your team (up to 25 people):" : "Open it on any phone or laptop you use:";
	return send(env, {
		from: FROM_ORDERS,
		to,
		replyTo: SUPPORT_EMAIL,
		subject: `Your ${BRAND} ${product.name} is unlocked`,
		html: wrap(`<h1 style="font-size:22px">You're in. Thanks for buying ${esc(BRAND)} ${esc(product.name)}.</h1>
<p>Your app is already unlocked on the device you paid on. ${esc(who)}</p>
${button(unlockLink, "Open my study planner")}
<p style="font-size:14px;color:#555">Keep this email. That button is your unlock link.<br>Order reference: <strong>${esc(ref)}</strong> · Amount: $${esc(product.price)} USD, one time.</p>
<p style="font-size:14px;color:#555">${esc(REFUND_LINE)} Questions? Reply to this email or visit ${ORIGIN}/support.</p>
${next ? `<p style="font-size:14px;color:#555">Teaching a class or training a team? ${esc(next.name)} ($${next.price.replace(".00", "")}) gives everyone access with one link: ${ORIGIN}/${next.id === "team" ? "business" : "schools"}</p>` : ""}`),
		text: `You're in. ${who}\n${unlockLink}\n\nOrder ${ref}, $${product.price} USD one time.\n${REFUND_LINE}\nHelp: ${ORIGIN}/support`,
	});
}

export function sendTicketReceived(env: Env, to: string, id: number, link: string) {
	return send(env, {
		from: FROM_SUPPORT,
		to,
		subject: `We got your message (ticket #${id})`,
		html: wrap(`<p>Hi, thanks for contacting Buzzyfly support. A person will reply within one business day.</p>${button(link, `View ticket #${id}`)}<p style="font-size:14px;color:#555">Keep this email. The button is your private link to the conversation.</p>`),
		text: `Thanks for contacting Buzzyfly support. We'll reply within one business day.\nYour ticket: ${link}`,
	});
}

export function sendTicketReply(env: Env, to: string, id: number, link: string, reply: string) {
	return send(env, {
		from: FROM_SUPPORT,
		to,
		subject: `Re: your Buzzyfly ticket #${id}`,
		html: wrap(`<p>We replied to your ticket:</p><blockquote style="border-left:4px solid #ffc533;margin:0;padding:8px 16px">${esc(reply).replace(/\n/g, "<br>")}</blockquote>${button(link, "View or reply")}`),
		text: `We replied to your ticket #${id}:\n\n${reply}\n\nView or reply: ${link}`,
	});
}

export function notifyOwner(env: Env, subject: string, text: string) {
	const to = ownerInbox(env);
	return send(env, { from: FROM_SUPPORT, to, subject: `[Study Plan] ${subject}`, html: wrap(`<pre style="white-space:pre-wrap;font:14px/1.5 ui-monospace,monospace">${esc(text)}</pre>`), text });
}

export function sendAdminLink(env: Env, link: string) {
	return send(env, {
		from: FROM_SUPPORT,
		to: ownerInbox(env),
		subject: "Your Study Plan admin sign-in link",
		html: wrap(`<p>Someone asked to sign in to the Study Plan admin. If it was you, click below within 15 minutes.</p>${button(link, "Sign in to admin")}<p style="font-size:14px;color:#555">If it wasn't you, ignore this email. Nobody can sign in without this link.</p>`),
		text: `Sign in to the Study Plan admin (valid 15 minutes):\n${link}\n\nIf it wasn't you, ignore this email.`,
	});
}
