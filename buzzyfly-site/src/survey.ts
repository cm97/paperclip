import { SUPPORT_EMAIL } from "./config";
import { clean, esc, html, message, page, rateLimited, sameOrigin, validEmail, type Env } from "./lib";

const ROLES = ["Student", "Parent", "Teacher", "Tutor", "School leader", "Business owner", "Manager / HR / training", "Other"];
const SIZES = ["Just me", "2–10", "11–50", "51–250", "251–1,000", "1,000+"];
const PAY = ["Nothing, it must be free", "Under $20", "$20–$99", "$100–$499", "$500+", "Depends"];

function select(name: string, label: string, options: string[]): string {
	return `<label for="s-${name}">${label}</label><select id="s-${name}" name="${name}"><option value="">Choose…</option>${options.map((o) => `<option>${esc(o)}</option>`).join("")}</select>`;
}

export function surveyForm(kind: "personal" | "business"): string {
	const business = kind === "business";
	return `<form class="form" method="post" action="/survey">
<input type="hidden" name="kind" value="${kind}">
${select("role", "Which best describes you?", ROLES)}
${business ? `<label for="s-org">Company or school (optional)</label><input id="s-org" name="org" maxlength="120" autocomplete="organization">${select("org_size", "How many people?", SIZES)}` : ""}
<label for="s-need">${business ? "What are your people struggling to learn, track or prepare for? What tool would you pay for?" : "What's the hardest part of studying or staying organised? What would you want an app to do for you?"}</label>
<textarea id="s-need" name="need" maxlength="3000" required></textarea>
${select("would_pay", business ? "What would your organisation pay for a tool that solves this?" : "What would you pay, one time, for an app that solves it?", PAY)}
<label for="s-email">Email (optional, only if you'd like a reply or early access)</label><input id="s-email" name="email" type="email" maxlength="200" autocomplete="email">
<input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
<button class="btn primary" type="submit">Send my answers</button>
<p class="note">We read every answer and use them to decide what to build next. We never sell your details.</p>
</form>`;
}

export function surveyPage(): Response {
	return html(
		page(
			"Tell us what you need – Buzzyfly",
			"Two questions. Tell us what you struggle with and we'll build the tool for it.",
			`<section class="hero"><div class="wrap narrow">
<p class="eyebrow">Two-minute survey</p>
<h1>What should we build for you?</h1>
<p class="lede">Tell us what's hard. We build the tools people ask for most. Running a business or school? <a href="/business#survey">Use the business survey</a>.</p>
${surveyForm("personal")}
</div></section>`,
			{ path: "/survey" },
		),
	);
}

export async function saveSurvey(req: Request, env: Env): Promise<Response> {
	if (!sameOrigin(req)) return message("That form didn't come from this site", "", 403);
	const f = await req.formData();
	if (clean(f.get("website"), 10)) return Response.redirect(new URL("/", req.url).toString(), 303);
	const need = clean(f.get("need"), 3000);
	const email = clean(f.get("email"), 200);
	if (need.length < 3) return message("Please tell us a little more", `<p><a href="/survey">Back to the survey</a></p>`, 400);
	if (email && !validEmail(email)) return message("That email doesn't look right", `<p><a href="/survey">Back to the survey</a></p>`, 400);
	if (!env.DB) return message("Thanks!", `<p>We couldn't save that right now. Please email it to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`, 503);
	if (await rateLimited(env, req, "survey", 10)) return message("Thanks, we've got plenty from you this hour", `<p><a href="/">Back home</a></p>`, 429);
	const kind = clean(f.get("kind"), 20) === "business" ? "business" : "personal";
	const pick = (name: string, list: string[]) => (list.includes(clean(f.get(name), 60)) ? clean(f.get(name), 60) : null);
	await env.DB.prepare("INSERT INTO survey_responses (kind, role, org, org_size, need, would_pay, email, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
		.bind(kind, pick("role", ROLES), clean(f.get("org"), 120) || null, pick("org_size", SIZES), need, pick("would_pay", PAY), email || null, (req.headers.get("referer") || "").slice(0, 200) || null)
		.run();
	return message(
		"Thank you. That helps a lot.",
		`<p class="lede">We read every answer. ${kind === "business" ? "If you left an email, we'll reply about your team's needs." : ""}</p><div class="ctas"><a class="btn primary" href="/app">Try the study planner free</a></div>`,
	);
}
