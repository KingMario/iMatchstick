import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function hook({
  candidate = "20261013.11",
  state = "activated",
  error,
  supported = true,
  ready = false,
} = {}) {
  const values = [];
  let reloads = 0;
  let activations = 0;
  const worker = { state };
  const effects = [];
  const exports = {};
  const helpers = {
    withTimeout: (p) => p,
    refreshWorker: async () => {
      if (error) throw error;
      return worker;
    },
    workerBuildId: async () => candidate,
    isNewerBuild: (a, b) => a > b,
    activateWorker: async () => {
      activations++;
      worker.state = "activated";
    },
  };
  const context = {
    exports,
    require: (name) =>
      name === "react"
        ? {
            useState: (initial) => {
              const index = values.length;
              values.push(initial);
              return [
                initial,
                (next) => {
                  values[index] = next;
                },
              ];
            },
            useRef: (current) => ({ current }),
            useCallback: (callback) => callback,
            useEffect: (callback) => effects.push(callback),
          }
        : helpers,
    process: { env: { NEXT_PUBLIC_BUILD_ID: "20261013.10" } },
    navigator: supported
      ? {
          serviceWorker: {
            register: async () =>
              ready
                ? state === "activated"
                  ? { active: worker }
                  : { waiting: worker }
                : {},
          },
        }
      : {},
    window: {
      location: { reload: () => reloads++ },
      addEventListener() {},
      removeEventListener() {},
    },
    document: {
      visibilityState: "visible",
      addEventListener() {},
      removeEventListener() {},
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../components/matchstick/usePwaUpdate.ts", import.meta.url),
        "utf8",
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    context,
  );
  const result = exports.usePwaUpdate();
  return {
    result,
    values,
    effects,
    reloads: () => reloads,
    activations: () => activations,
  };
}

test("newer active worker reloads without waiting/controllerchange", async () => {
  const h = hook();
  await h.result.apply();
  assert.equal(h.reloads(), 1);
  assert.equal(h.activations(), 0);
  assert.equal(h.values[1], false);
});
test("waiting worker activates once under duplicate update clicks", async () => {
  const h = hook({ state: "installed" });
  await Promise.all([h.result.apply(), h.result.apply()]);
  assert.equal(h.activations(), 1);
  assert.equal(h.reloads(), 1);
});
test("failed update resets pending state and permits retry", async () => {
  const h = hook({ error: new Error("offline") });
  await h.result.apply();
  assert.equal(h.values[0], "failed");
  assert.equal(h.values[1], false);
  await h.result.check();
  assert.equal(h.values[0], "failed");
  assert.equal(h.reloads(), 0);
});
test("already-current loaded HTML does not falsely reload for older worker", async () => {
  const h = hook({ candidate: "20261013.09" });
  await h.result.apply();
  assert.equal(h.values[0], "latest");
  assert.equal(h.reloads(), 0);
});
test("unsupported browser finishes check", async () => {
  const h = hook({ supported: false });
  await h.result.check();
  assert.equal(h.values[0], "unsupported");
});

test("already downloaded waiting update applies even if network update would fail", async () => {
  const h = hook({
    ready: true,
    state: "installed",
    error: new Error("offline"),
  });
  await h.result.apply();
  assert.equal(h.activations(), 1);
  assert.equal(h.reloads(), 1);
  assert.equal(h.values[1], false);
});
test("newer active worker can reload offline without network update", async () => {
  const h = hook({ ready: true, error: new Error("offline") });
  await h.result.apply();
  assert.equal(h.reloads(), 1);
});
