import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
const scope = "https://example.com/imatchstick/";
const currentCache = "imatchstick-pwa-__BUILD_ID__";

function createWorker({ network = async () => new Response("network") } = {}) {
  const listeners = new Map();
  const stores = new Map();
  const fetches = [];
  const precacheRequests = [];
  const lifecycle = { skipWaitingCalls: 0, claimCalls: 0 };
  const keyFor = (request) =>
    new URL(typeof request === "string" ? request : request.url, scope).href;
  const storeFor = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const caches = {
    async open(name) {
      const store = storeFor(name);
      return {
        async addAll(requests) {
          precacheRequests.push(...requests);
        },
        async match(request) {
          return store.get(keyFor(request))?.clone();
        },
        async put(request, response) {
          store.set(keyFor(request), response.clone());
        },
      };
    },
    async match(request) {
      for (const store of stores.values()) {
        const response = store.get(keyFor(request));
        if (response) return response.clone();
      }
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
  // Browser Request resolves relative URLs against the worker's own URL.
  class WorkerRequest extends Request {
    constructor(input, options) {
      super(typeof input === "string" ? new URL(input, scope) : input, options);
    }
  }
  const self = {
    location: new URL("sw.js", scope),
    registration: { scope },
    clients: {
      claim: async () => {
        lifecycle.claimCalls += 1;
      },
    },
    skipWaiting: async () => {
      lifecycle.skipWaitingCalls += 1;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };
  vm.runInNewContext(source, {
    self,
    caches,
    URL,
    Request: WorkerRequest,
    Response,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (request, options) => {
      fetches.push({ request, options });
      return network(request, options);
    },
  });
  const pending = [];
  return {
    stores,
    fetches,
    precacheRequests,
    lifecycle,
    seed(path, body, name = currentCache) {
      storeFor(name).set(keyFor(path), new Response(body));
    },
    async dispatch(type, data = {}) {
      let response;
      let intercepted = false;
      let lifetimePromises = 0;
      listeners.get(type)({
        ...data,
        waitUntil(promise) {
          lifetimePromises += 1;
          pending.push(Promise.resolve(promise));
        },
        respondWith(promise) {
          intercepted = true;
          response = Promise.resolve(promise);
        },
      });
      try {
        const result = await response;
        // Flush both event lifetime promises and asynchronous cache writes.
        while (pending.length) await Promise.all(pending.splice(0));
        await new Promise((resolve) => setImmediate(resolve));
        return { intercepted, response: result, lifetimePromises };
      } catch (error) {
        while (pending.length) await Promise.allSettled(pending.splice(0));
        throw error;
      }
    },
  };
}

function request(path = "./", { navigation = false, method = "GET" } = {}) {
  const result = new Request(new URL(path, scope), { method });
  if (navigation) Object.defineProperty(result, "mode", { value: "navigate" });
  return result;
}

function cacheMode({ request: input, options }) {
  return options?.cache ?? input.cache;
}

test("installation bypasses the HTTP cache for every shell resource", async () => {
  const worker = createWorker();
  await worker.dispatch("install");
  assert.ok(worker.precacheRequests.length > 0);
  for (const entry of worker.precacheRequests) {
    assert.ok(entry instanceof Request, "precache resources must be Requests");
    assert.equal(entry.cache, "no-store", entry.url);
    assert.ok(
      entry.url.startsWith(scope),
      "precache must respect subpath scope",
    );
  }
});

test("online navigation bypasses stale shell and HTTP cache, then refreshes cache", async () => {
  const worker = createWorker({
    network: async () => new Response("fresh shell"),
  });
  worker.seed("./", "stale shell");
  const result = await worker.dispatch("fetch", {
    request: request("./", { navigation: true }),
  });
  assert.equal(await result.response.text(), "fresh shell");
  assert.equal(worker.fetches.length, 1);
  assert.equal(cacheMode(worker.fetches[0]), "no-store");
  assert.equal(
    await worker.stores.get(currentCache).get(scope).clone().text(),
    "fresh shell",
  );
});

test("offline navigation falls back to its cached URL", async () => {
  const worker = createWorker({
    network: async () => {
      throw new TypeError("offline");
    },
  });
  worker.seed("./", "home shell");
  worker.seed("./?puzzle=42", "puzzle shell");
  const result = await worker.dispatch("fetch", {
    request: request("./?puzzle=42", { navigation: true }),
  });
  assert.equal(await result.response.text(), "puzzle shell");
  assert.equal(
    worker.fetches.length,
    1,
    "navigation must attempt the network first",
  );
});

test("offline uncached navigation uses the in-scope shell fallback", async () => {
  const worker = createWorker({
    network: async () => {
      throw new TypeError("offline");
    },
  });
  worker.seed("./", "offline shell");
  const result = await worker.dispatch("fetch", {
    request: request("./?puzzle=99", { navigation: true }),
  });
  assert.equal(await result.response.text(), "offline shell");
});

test("a failed JavaScript request never receives HTML shell fallback", async () => {
  const worker = createWorker({
    network: async () => {
      throw new TypeError("offline");
    },
  });
  worker.seed("./", "<!doctype html><title>App</title>");
  const result = await worker
    .dispatch("fetch", { request: request("./_next/static/chunks/missing.js") })
    .catch((error) => {
      assert.equal(error.message, "offline");
      return null;
    });
  if (result) {
    assert.ok(
      result.response instanceof Response,
      "respondWith must resolve to a Response or reject",
    );
    assert.notEqual(
      await result.response.text(),
      "<!doctype html><title>App</title>",
    );
    assert.ok(
      !result.response.ok,
      "failed asset requests must remain failures",
    );
  }
});

test("cached immutable assets remain available without network", async () => {
  const worker = createWorker({
    network: async () => {
      throw new TypeError("offline");
    },
  });
  worker.seed("./_next/static/chunks/content-hash.js", "export default 42;");
  const result = await worker.dispatch("fetch", {
    request: request("./_next/static/chunks/content-hash.js"),
  });
  assert.equal(await result.response.text(), "export default 42;");
  assert.equal(worker.fetches.length, 0);
});

test("successful asset downloads are cached for subsequent offline use", async () => {
  const worker = createWorker({
    network: async () => new Response("asset contents"),
  });
  const asset = request("./_next/static/chunks/new-hash.js");
  const first = await worker.dispatch("fetch", { request: asset });
  assert.equal(await first.response.text(), "asset contents");
  const second = await worker.dispatch("fetch", { request: asset });
  assert.equal(await second.response.text(), "asset contents");
  assert.equal(worker.fetches.length, 1);
});

test("version checks, cross-origin requests and POSTs bypass the worker", async () => {
  const worker = createWorker();
  for (const input of [
    request("./version.json?t=123"),
    request("https://other.example/asset.js"),
    request("./submit", { method: "POST" }),
  ]) {
    const result = await worker.dispatch("fetch", { request: input });
    assert.equal(result.intercepted, false, input.url);
  }
  assert.equal(worker.fetches.length, 0);
});

test("activation deletes only old app caches and preserves unrelated caches", async () => {
  const worker = createWorker();
  worker.seed("./", "new");
  worker.seed("./", "old", "imatchstick-pwa-old-build");
  worker.seed("./", "unrelated", "another-app-cache");
  await worker.dispatch("activate");
  assert.ok(worker.stores.has(currentCache));
  assert.ok(worker.stores.has("another-app-cache"));
  assert.ok(!worker.stores.has("imatchstick-pwa-old-build"));
});

test("legacy ACTIVATE_UPDATE waits for activation and install does not activate automatically", async () => {
  const worker = createWorker();
  await worker.dispatch("install");
  assert.equal(
    worker.lifecycle.skipWaitingCalls,
    0,
    "installation must preserve the user's update choice",
  );
  const message = await worker.dispatch("message", {
    data: { type: "ACTIVATE_UPDATE" },
    ports: [],
  });
  assert.equal(worker.lifecycle.skipWaitingCalls, 1);
  assert.equal(
    message.lifetimePromises,
    1,
    "activation promise must extend the legacy message event lifetime",
  );
  await worker.dispatch("activate");
  assert.equal(
    worker.lifecycle.claimCalls,
    1,
    "new worker must take over the legacy controlled tab",
  );
});

test("first legacy-client reload after activation fetches fresh HTML despite stale shell", async () => {
  const worker = createWorker({
    network: async () => new Response("<html>new-build</html>"),
  });
  worker.seed("./", "<html>old-build</html>", "imatchstick-pwa-legacy-build");
  // Also model a shell stored under the new cache name from stale HTTP precaching.
  worker.seed("./", "<html>old-build</html>");
  await worker.dispatch("message", {
    data: { type: "ACTIVATE_UPDATE" },
    ports: [],
  });
  await worker.dispatch("activate");
  const result = await worker.dispatch("fetch", {
    request: request("./", { navigation: true }),
  });
  assert.equal(await result.response.text(), "<html>new-build</html>");
  assert.equal(worker.fetches.length, 1);
  assert.equal(cacheMode(worker.fetches[0]), "no-store");
  assert.ok(!worker.stores.has("imatchstick-pwa-legacy-build"));
  assert.equal(
    await worker.stores.get(currentCache).get(scope).clone().text(),
    "<html>new-build</html>",
  );
});
