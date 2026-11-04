// Signed access passes. No database: the pass carries the product and the
// payment reference, and an HMAC with ACCESS_SECRET proves we issued it.
export interface Pass {
	p: string; // product id
	o: string; // payment reference (PayPal order id or Stripe session id)
	t: number; // issued at (ms)
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
	const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signPass(secret: string, pass: Pass): Promise<string> {
	const body = b64url(enc.encode(JSON.stringify(pass)));
	const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
	return `${body}.${b64url(sig)}`;
}

export async function verifyPass(secret: string | undefined, token: string | null | undefined): Promise<Pass | null> {
	if (!secret || !token || token.length > 1000) return null;
	const [body, sig] = token.split(".");
	if (!body || !sig) return null;
	try {
		const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(sig), enc.encode(body));
		if (!ok) return null;
		const pass = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Pass;
		return typeof pass.p === "string" && typeof pass.o === "string" ? pass : null;
	} catch {
		return null;
	}
}
