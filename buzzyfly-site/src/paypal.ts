/**
 * Minimal PayPal Orders v2 client for the Cloudflare Worker (no SDK, no extra server).
 * Needs two Worker secrets: PAYPAL_CLIENT_ID and PAYPAL_SECRET (a PayPal "REST app" in
 * the Live tab of developer.paypal.com). Optional: PAYPAL_ENV=sandbox for testing.
 */
export interface PaypalEnv {
	PAYPAL_CLIENT_ID?: string;
	PAYPAL_SECRET?: string;
	/** Accepted in place of PAYPAL_CLIENT_ID / PAYPAL_SECRET: the names PayPal's dashboard and docs use. */
	PAYPAL_CLIENT_SECRET?: string;
	PAYPAL_SECRET_KEY?: string;
	PAYPAL_CLIENTID?: string;
	PAYPAL_ID?: string;
	PAYPAL_ENV?: string;
	/** Test hook only: overrides the PayPal API origin. */
	PAYPAL_API_BASE?: string;
}

/** The PayPal app's client ID and secret, whichever of the accepted names they were saved under. */
export function paypalCredentials(env: unknown): { clientId: string; secret: string } | null {
	const e = (env ?? {}) as PaypalEnv;
	const clientId = (e.PAYPAL_CLIENT_ID || e.PAYPAL_CLIENTID || e.PAYPAL_ID || "").trim();
	const secret = (e.PAYPAL_SECRET || e.PAYPAL_CLIENT_SECRET || e.PAYPAL_SECRET_KEY || "").trim();
	return clientId && secret ? { clientId, secret } : null;
}

export function paypalConfigured(env: unknown): boolean {
	return paypalCredentials(env) !== null;
}

function apiBase(e: PaypalEnv): string {
	if (e.PAYPAL_API_BASE) return e.PAYPAL_API_BASE.replace(/\/$/, "");
	return e.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

async function accessToken(e: PaypalEnv): Promise<string> {
	const res = await fetch(`${apiBase(e)}/v1/oauth2/token`, {
		method: "POST",
		headers: {
			authorization: `Basic ${btoa(`${paypalCredentials(e)?.clientId}:${paypalCredentials(e)?.secret}`)}`,
			"content-type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	});
	if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
	const json = (await res.json()) as { access_token?: string };
	if (!json.access_token) throw new Error("PayPal auth returned no token");
	return json.access_token;
}

export interface CreatedOrder {
	id: string;
	approveUrl: string;
}

export async function createOrder(
	env: unknown,
	opts: {
		itemId: string;
		amount: string;
		currency: string;
		description: string;
		returnUrl: string;
		cancelUrl: string;
		/** Traffic source ("source__medium__campaign"), carried as reference_id and read back on capture. */
		source?: string | null;
	},
): Promise<CreatedOrder> {
	const e = env as PaypalEnv;
	const token = await accessToken(e);
	const res = await fetch(`${apiBase(e)}/v2/checkout/orders`, {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify({
			intent: "CAPTURE",
			purchase_units: [
				{
					...(opts.source ? { reference_id: `${SOURCE_REF_PREFIX}${opts.source}` } : {}),
					custom_id: opts.itemId,
					description: opts.description,
					amount: { currency_code: opts.currency, value: opts.amount },
				},
			],
			payment_source: {
				paypal: {
					experience_context: {
						return_url: opts.returnUrl,
						cancel_url: opts.cancelUrl,
						user_action: "PAY_NOW",
						shipping_preference: "NO_SHIPPING",
					},
				},
			},
		}),
	});
	if (!res.ok) throw new Error(`PayPal create order failed (${res.status})`);
	const json = (await res.json()) as { id?: string; links?: { rel: string; href: string }[] };
	const link = json.links?.find((l) => l.rel === "payer-action") ?? json.links?.find((l) => l.rel === "approve");
	if (!json.id || !link) throw new Error("PayPal order response missing id or approval link");
	return { id: json.id, approveUrl: link.href };
}

export interface CapturedOrder {
	orderId: string;
	completed: boolean;
	amount: string | null;
	currency: string | null;
	customId: string | null;
	payerEmail: string | null;
	source: string | null;
}

// PayPal sets reference_id to "default" when none is given, so ours is prefixed.
const SOURCE_REF_PREFIX = "src:";

function sourceFromReference(referenceId: unknown): string | null {
	return typeof referenceId === "string" && referenceId.startsWith(SOURCE_REF_PREFIX)
		? referenceId.slice(SOURCE_REF_PREFIX.length) || null
		: null;
}

function summarize(orderId: string, json: any): CapturedOrder {
	const unit = json?.purchase_units?.[0];
	const capture = unit?.payments?.captures?.[0];
	return {
		orderId,
		completed: json?.status === "COMPLETED" && capture?.status === "COMPLETED",
		amount: capture?.amount?.value ?? null,
		currency: capture?.amount?.currency_code ?? null,
		customId: capture?.custom_id ?? unit?.custom_id ?? null,
		payerEmail: json?.payer?.email_address ?? null,
		source: sourceFromReference(unit?.reference_id),
	};
}

/**
 * Captures an approved order. Idempotent: the PayPal-Request-Id header makes a repeat
 * call (page reload) return the original result, and a GET fallback covers an
 * already-captured order. Returns what PayPal reports; the caller must verify it.
 */
export async function captureOrder(env: unknown, orderId: string): Promise<CapturedOrder> {
	const e = env as PaypalEnv;
	const token = await accessToken(e);
	const res = await fetch(`${apiBase(e)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
			"paypal-request-id": `bfstudy-capture-${orderId}`,
		},
		body: "{}",
	});
	if (res.ok) return summarize(orderId, await res.json());

	// Already captured (or capture raced): read the order instead.
	const get = await fetch(`${apiBase(e)}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
		headers: { authorization: `Bearer ${token}` },
	});
	if (get.ok) return summarize(orderId, await get.json());
	throw new Error(`PayPal capture failed (${res.status})`);
}
