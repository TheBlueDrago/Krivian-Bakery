var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var enc = new TextEncoder();
var b64u = /* @__PURE__ */ __name((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64u");
var fromB64u = /* @__PURE__ */ __name((s) => atob(s.replace(/-/g, "+").replace(/_/g, "/")), "fromB64u");
var cookie = /* @__PURE__ */ __name((req, name) => ((req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)")) || [])[1] || "", "cookie");
var setCookie = /* @__PURE__ */ __name((name, value, seconds) => `${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`, "setCookie");
var json = /* @__PURE__ */ __name((data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } }), "json");
async function key(env) {
  return crypto.subtle.importKey("raw", enc.encode("krivian-session:" + env.GOOGLE_CLIENT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
__name(key, "key");
async function sign(env, data) {
  const body = b64u(enc.encode(JSON.stringify(data)));
  return body + "." + b64u(await crypto.subtle.sign("HMAC", await key(env), enc.encode(body)));
}
__name(sign, "sign");
async function read(env, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig || !env.GOOGLE_CLIENT_SECRET) return null;
  const raw = Uint8Array.from(fromB64u(sig), (c) => c.charCodeAt(0));
  if (!await crypto.subtle.verify("HMAC", await key(env), raw, enc.encode(body))) return null;
  const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(fromB64u(body), (c) => c.charCodeAt(0))));
  return data.exp > Date.now() ? data : null;
}
__name(read, "read");
var worker_default = {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname, origin = url.origin;
    if (path === "/auth/google") {
      if (!env.GOOGLE_CLIENT_ID) return new Response("Google sign-in isn't set up yet.", { status: 503 });
      const state = b64u(crypto.getRandomValues(new Uint8Array(16)));
      const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      g.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: origin + "/auth/callback", response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
      return new Response(null, { status: 302, headers: { location: g.toString(), "set-cookie": setCookie("kb_state", state, 600) } });
    }
    if (path === "/auth/callback") {
      const back = /* @__PURE__ */ __name((q) => Response.redirect(origin + "/" + q, 302), "back");
      const code = url.searchParams.get("code"), state = url.searchParams.get("state");
      if (!code || !state || state !== cookie(req, "kb_state")) return back("?signin=failed");
      const tok = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: origin + "/auth/callback", grant_type: "authorization_code" })
      }).then((r) => r.json()).catch(() => ({}));
      if (!tok.access_token) return back("?signin=failed");
      const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: "Bearer " + tok.access_token } }).then((r) => r.json()).catch(() => ({}));
      if (!info.email || !info.email_verified) return back("?signin=failed");
      const session = await sign(env, { n: String(info.name || info.email.split("@")[0]).slice(0, 80), e: String(info.email).toLowerCase(), p: String(info.picture || "").slice(0, 400), exp: Date.now() + 30 * 864e5 });
      const h = new Headers({ location: origin + "/?signin=ok" });
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
    return env.ASSETS.fetch(req);
  }
};

// ../Users/narra/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../Users/narra/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-NR6mcp/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../Users/narra/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-NR6mcp/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
