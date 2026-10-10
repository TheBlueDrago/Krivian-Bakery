// "Sign in with Google" for Krivian Bakery. Everything else is the plain site files.
//   /auth/google    -> sends the visitor to Google
//   /auth/callback  -> Google sends them back; we sign them in
//   /auth/me        -> who's signed in ({ user: null } if nobody)
//   /auth/logout    -> signs them out
// No database: the sign-in is a cookie signed with a key made from GOOGLE_CLIENT_SECRET,
// so nobody can fake one. It holds only their name, email and picture, for 30 days.
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
const cookie = (req, name) => ((req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)")) || [])[1] || "";
const setCookie = (name, value, seconds) => `${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

async function key(env) {
  return crypto.subtle.importKey("raw", enc.encode("krivian-session:" + env.GOOGLE_CLIENT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(env, data) {
  const body = b64u(enc.encode(JSON.stringify(data)));
  return body + "." + b64u(await crypto.subtle.sign("HMAC", await key(env), enc.encode(body)));
}
async function read(env, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig || !env.GOOGLE_CLIENT_SECRET) return null;
  const raw = Uint8Array.from(fromB64u(sig), (c) => c.charCodeAt(0));
  if (!(await crypto.subtle.verify("HMAC", await key(env), raw, enc.encode(body)))) return null;
  const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(fromB64u(body), (c) => c.charCodeAt(0))));
  return data.exp > Date.now() ? data : null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname, origin = url.origin;
    // The old workers.dev address (and www) permanently moves to krivianbakery.com, so search engines list the real one.
    if (url.hostname.endsWith(".workers.dev") || url.hostname === "www.krivianbakery.com") return Response.redirect("https://krivianbakery.com" + path + url.search, 301);
    if (path === "/auth/google") {
      if (!env.GOOGLE_CLIENT_ID) return new Response("Google sign-in isn't set up yet.", { status: 503 });
      const state = b64u(crypto.getRandomValues(new Uint8Array(16)));
      const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      g.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: origin + "/auth/callback", response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
      // where to come back to afterwards (only pages on this site)
      const next = url.searchParams.get("next") || "/";
      const h = new Headers({ location: g.toString() });
      h.append("set-cookie", setCookie("kb_state", state, 600));
      h.append("set-cookie", setCookie("kb_next", /^\/[A-Za-z0-9/_-]*$/.test(next) ? next : "/", 600));
      return new Response(null, { status: 302, headers: h });
    }
    if (path === "/auth/callback") {
      const back = (q) => Response.redirect(origin + "/" + q, 302);
      const code = url.searchParams.get("code"), state = url.searchParams.get("state");
      if (!code || !state || state !== cookie(req, "kb_state")) return back("?signin=failed");
      const tok = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: origin + "/auth/callback", grant_type: "authorization_code" }),
      }).then((r) => r.json()).catch(() => ({}));
      if (!tok.access_token) return back("?signin=failed");
      const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: "Bearer " + tok.access_token } }).then((r) => r.json()).catch(() => ({}));
      if (!info.email || !info.email_verified) return back("?signin=failed");
      const session = await sign(env, { n: String(info.name || info.email.split("@")[0]).slice(0, 80), e: String(info.email).toLowerCase(), p: String(info.picture || "").slice(0, 400), exp: Date.now() + 30 * 86400000 });
      const next = /^\/[A-Za-z0-9/_-]*$/.test(cookie(req, "kb_next")) ? cookie(req, "kb_next") : "/";
      const h = new Headers({ location: origin + next + (next.includes("?") ? "&" : "?") + "signin=ok" });
      h.append("set-cookie", setCookie("kb_next", "", 0));
      h.append("set-cookie", setCookie("kb_session", session, 30 * 86400));
      h.append("set-cookie", setCookie("kb_state", "", 0));
      return new Response(null, { status: 302, headers: h });
    }
    if (path === "/auth/me") {
      const s = await read(env, cookie(req, "kb_session")).catch(() => null);
      return json({ user: s ? { name: s.n, email: s.e, picture: s.p } : null, enabled: !!env.GOOGLE_CLIENT_ID });
    }
    if (path === "/auth/logout") {
      if (req.method !== "POST") return new Response("Use POST", { status: 405 });
      return json({ ok: true }, 200, { "set-cookie": setCookie("kb_session", "", 0) });
    }
    // Checkout needs a Google sign-in (browsing and the cart don't). Once sign-in is set up.
    if ((path === "/billing" || path === "/billing.html") && env.GOOGLE_CLIENT_ID) {
      const s = await read(env, cookie(req, "kb_session")).catch(() => null);
      if (!s) return Response.redirect(origin + "/signin?next=/billing", 302);
    }
    return env.ASSETS.fetch(req);
  },
};
