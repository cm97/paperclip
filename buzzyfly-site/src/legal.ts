// Plain-English legal and trust pages. Owner: have a lawyer review these before
// heavy business sales, and add your legal business name and postal address.
import { BRAND, PRODUCTS, SUPPORT_EMAIL } from "./config";
import { esc, html, page } from "./lib";

const UPDATED = "4 November 2026";
const prices = Object.values(PRODUCTS)
	.map((p) => `${esc(p.name)} $${p.price.replace(".00", "")}`)
	.join(", ");

function doc(path: string, title: string, description: string, body: string): Response {
	return html(page(`${title} – ${BRAND}`, description, `<section class="hero"><div class="wrap narrow legal"><h1>${esc(title)}</h1><p class="note">Last updated ${UPDATED}</p>${body}</div></section>`, { path }));
}

const PAGES: Record<string, () => Response> = {
	"/about": () =>
		doc(
			"/about",
			"About Buzzyfly",
			"Who makes Buzzyfly Study Plan and how to reach us.",
			`<p class="lede">${BRAND} is made by Buzzyfly, a small independent software maker. We build simple browser apps that do one job well, for students, teachers, freelancers and small teams.</p>
<h2>What we believe</h2>
<ul class="fit"><li>One fair price. No subscriptions on this app, no hidden fees.</li><li>Your study data stays on your device.</li><li>No fake reviews, fake countdowns or fake numbers. If we don't have testimonials yet, we don't invent them.</li><li>Real support from a person, with an AI helper for quick answers.</li></ul>
<h2>Contact</h2>
<p>Support: <a href="/support">Help &amp; support</a> or <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. We reply within one business day.</p>
<p>Ideas or requests: <a href="/survey">tell us what you need</a>. We build what people ask for most.</p>`,
		),
	"/terms": () =>
		doc(
			"/terms",
			"Terms of Service",
			"The terms for using and buying Buzzyfly Study Plan.",
			`<p>These terms are between you and Buzzyfly ("we", "us") for ${BRAND} at paperclip.buzzyfly.com and its Android app. By using the app you agree to them.</p>
<h2>1. What you get</h2>
<p>A browser study planner. The free version includes one exam plan and up to 20 flashcards. Paid licences (${prices}, all USD, one-time) unlock unlimited exams and flashcards. There is no subscription and no automatic renewal.</p>
<h2>2. Licences</h2>
<p><strong>Student</strong>: one person. <strong>Classroom</strong>: one teacher's classes. <strong>Business</strong>: up to 25 people at one organisation. You may not resell, publicly post or share an unlock link beyond your licence. We may disable links that are clearly shared beyond it.</p>
<h2>3. Payment</h2>
<p>Payments are processed by PayPal or Stripe. We never see or store your card details. Prices include no hidden fees. Taxes may apply where required.</p>
<h2>4. Refunds</h2>
<p>30-day refund if you can't get into the app or it isn't what the listing described. No change-of-mind refunds once you've had access. See the <a href="/refunds">refund policy</a>. A refunded order's access ends.</p>
<h2>5. Your data and your responsibilities</h2>
<p>Your plans and flashcards are stored in your browser on your device. Clearing browser data deletes them. Please keep a printout of anything important. Don't use the app to break the law, harass anyone, or attack or overload our systems.</p>
<h2>6. No guarantee of results</h2>
<p>The app helps you plan your studying. It does not promise any grade, pass, certification or result. Exam names belong to their owners. We are not affiliated with any exam board, school or test maker.</p>
<h2 id="security">7. Security</h2>
<p>We protect the service with encrypted connections, signed access links, rate limits and restricted admin access. Found a security problem? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with "Security" in the subject. Please don't access other people's data or disrupt the service while testing.</p>
<h2>8. Limits on our liability</h2>
<p>The app is provided "as is". To the extent the law allows, we are not liable for indirect or consequential losses, lost data, or exam outcomes, and our total liability to you is limited to the amount you paid us in the last 12 months. Nothing here limits rights you have under consumer law that can't be excluded.</p>
<h2>9. Changes and ending</h2>
<p>We may update the app and these terms. We'll post the date of any change here. Changes won't reduce what you already paid for. You can stop using the app at any time.</p>
<h2>10. Contact and disputes</h2>
<p>Please contact <a href="/support">support</a> first. We'll try to fix any problem quickly and fairly.</p>`,
		),
	"/privacy": () =>
		doc(
			"/privacy",
			"Privacy Policy",
			"What Buzzyfly Study Plan collects, why, and your choices.",
			`<p class="lede">Short version: your study plans stay on your device. We only collect what we need to sell you the app, help you, and improve it. We never sell personal data, and we don't use ad trackers.</p>
<h2>What we collect</h2>
<ul class="fit">
<li><strong>Study plans and flashcards:</strong> stored only in your browser. We don't receive them.</li>
<li><strong>Purchases:</strong> order reference, product, amount, and the email address PayPal or Stripe gives us. Card details stay with PayPal or Stripe.</li>
<li><strong>Support tickets:</strong> the name (optional), email and messages you send.</li>
<li><strong>Surveys:</strong> your answers, and your email only if you choose to give it.</li>
<li><strong>Security logs:</strong> a one-way hash of your IP address for rate limiting (kept about 2 hours), and short server logs kept by our host, Cloudflare.</li>
</ul>
<h2>Cookies</h2>
<p>We use only essential cookies: one that remembers your unlocked licence, and one for the owner's admin sign-in. No advertising or analytics cookies.</p>
<h2>Why we use it</h2>
<p>To deliver what you bought, send your receipt and unlock link, answer support requests, prevent fraud and abuse, and decide what to build next.</p>
<h2>Who we share it with</h2>
<p>Only the services that run the app: Cloudflare (hosting, database, email, AI helper), and PayPal or Stripe (payments). We share data with authorities only when the law requires it.</p>
<h2>How long we keep it</h2>
<p>Orders: as long as needed for tax and accounting records. Tickets and surveys: until you ask us to delete them, or 3 years at most.</p>
<h2>Your choices and rights</h2>
<p>You can ask to see, correct or delete your data at any time through <a href="/support">support</a>. Depending on where you live (for example under GDPR, UK GDPR or California law) you may have extra rights, and we honour them for everyone.</p>
<h2>Children</h2>
<p>The app is for students 13 and older, parents, teachers and businesses. The study planner collects no personal data from students. If you're under 13, please ask a parent or teacher to contact support for you. If we learn we've collected personal data from a child under 13, we delete it.</p>
<h2>Contact</h2>
<p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`,
		),
	"/refunds": () =>
		doc(
			"/refunds",
			"Refund Policy",
			"When you can get a refund for Buzzyfly Study Plan.",
			`<p class="lede">30-day refund if you can't get into the app or it isn't what the listing described. No change-of-mind refunds once you've had access.</p>
<h2>How to ask</h2>
<ol class="steps"><li>Open a <a href="/support#ticket">support ticket</a> within 30 days of buying. Choose "Refund request".</li><li>Include your order reference (on your receipt email and thank-you page).</li><li>Tell us what went wrong. We'll try to fix it first. If we can't, we refund you to the original payment method.</li></ol>
<p>Refunds usually reach you within 5–10 business days, depending on PayPal or your bank. A refunded order's access ends.</p>`,
		),
	"/accessibility": () =>
		doc(
			"/accessibility",
			"Accessibility",
			"Our accessibility commitment for Buzzyfly Study Plan.",
			`<p>We want everyone to be able to use ${BRAND}. We aim to meet WCAG 2.2 level AA.</p>
<ul class="fit"><li>Works with a keyboard alone, with visible focus outlines.</li><li>Large tap targets (at least 44px) and readable text on phones.</li><li>High-contrast colours in light and dark mode.</li><li>Respects "reduce motion" settings.</li><li>Labels on every form field for screen readers.</li></ul>
<p>Something hard to use? Tell us through <a href="/support">support</a> and we'll fix it.</p>`,
		),
};

export function legalPage(path: string): Response | null {
	return PAGES[path] ? PAGES[path]() : null;
}
