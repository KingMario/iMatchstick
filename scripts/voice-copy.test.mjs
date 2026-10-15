import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const source = ts.transpileModule(
  readFileSync(
    new URL("../components/matchstick/VoiceDiagnostics.tsx", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
// Executed React-handler model, not a substitute for native Safari/layout QA.
function mount(writeText, language = "en") {
  const state = [],
    cleanups = [],
    timers = new Map();
  let cursor = 0,
    timerId = 0,
    tree;
  const props = {
    language,
    enabled: true,
    entries: [
      {
        sequence: 1,
        attempt: 2,
        elapsedMs: 123,
        event: "result",
        disposition: "received",
        resultCount: 1,
      },
    ],
    onClear() {
      props.entries = [];
    },
    onEnabledChange(value) {
      props.enabled = value;
      props.entries = [];
    },
  };
  const hooks = {
    useState(initial) {
      const id = cursor++;
      if (!(id in state)) state[id] = initial;
      return [
        state[id],
        (value) => {
          state[id] = value;
        },
      ];
    },
    useRef(initial) {
      const id = cursor++;
      return (state[id] ??= { current: initial });
    },
    useEffect(fn) {
      const id = cursor++;
      if (!(id in state)) {
        state[id] = true;
        cleanups.push(fn());
      }
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    navigator: { clipboard: writeText ? { writeText } : undefined },
    setTimeout(fn) {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    require(name) {
      if (name === "react") return hooks;
      if (name === "./usePwaUpdate")
        return { buildId: "test-build", buildSha: "abcdef0" };
      if (name.includes("lib/voiceDiagnostics"))
        return require("../.test-out/lib/voiceDiagnostics.js");
      return require(name);
    },
  });
  const walk = (node) =>
    !node || typeof node !== "object"
      ? []
      : Array.isArray(node)
        ? node.flatMap(walk)
        : [node, ...walk(node.props?.children)];
  const render = () => {
    cursor = 0;
    tree = exports.VoiceDiagnostics(props);
    return walk(tree);
  };
  const by = (type, label) =>
    render().find(
      (n) => n.type === type && (!label || n.props.children === label),
    );
  return {
    props,
    timers,
    by,
    render,
    copy: () =>
      render()
        .find((n) => n.type === "button")
        .props.onClick(),
    clear: () =>
      by(
        "button",
        language === "en" ? "Clear events" : "清空事件",
      ).props.onClick(),
    disable: () => by("input").props.onChange({ target: { checked: false } }),
    unmount: () => cleanups.forEach((fn) => fn?.()),
    timeout() {
      for (const [id, fn] of timers) {
        timers.delete(id);
        fn();
      }
    },
  };
}
for (const language of ["en", "zh"]) {
  test(`voice copy success and repeat in ${language}`, async () => {
    const values = [];
    const g = mount((value) => {
      values.push(value);
      return Promise.resolve();
    }, language);
    await g.copy();
    assert.ok(
      g.by("p", language === "en" ? "Voice events copied" : "已拷贝语音事件"),
    );
    assert.match(values[0], /Build: test-build/);
    assert.match(values[0], /attempt=2 · \+123ms/);
    await g.copy();
    assert.equal(values.length, 2);
    assert.equal(g.timers.size, 0);
    g.clear();
    assert.equal(
      g.render().find((n) => n.type === "button").props.disabled,
      true,
    );
  });
}
for (const mode of ["missing", "rejected", "throws"]) {
  test(`voice copy ${mode} provides complete selectable fallback and clears on disable`, async () => {
    const g = mount(
      mode === "missing"
        ? undefined
        : () => {
            if (mode === "throws") throw Error("blocked");
            return Promise.reject(Error("blocked"));
          },
    );
    await g.copy();
    const textarea = g.by("textarea");
    assert.match(textarea.props.value, /event=result/);
    assert.equal(textarea.props.readOnly, true);
    let selected = false,
      range;
    textarea.props.onFocus({
      currentTarget: {
        value: textarea.props.value,
        select() {
          selected = true;
        },
        setSelectionRange(...args) {
          range = args;
        },
      },
    });
    assert.equal(selected, true);
    assert.deepEqual(range, [0, textarea.props.value.length]);
    assert.equal(g.timers.size, 0);
    g.disable();
    assert.equal(g.by("textarea"), undefined);
  });
}
for (const action of ["clear", "disable", "unmount", "timeout"]) {
  test(`pending copy ${action} ignores late resolution and cleans timer`, async () => {
    let resolve,
      calls = 0;
    const g = mount(() => {
      calls++;
      return new Promise((done) => {
        resolve = done;
      });
    });
    const pending = g.copy();
    await g.copy();
    assert.equal(calls, 1);
    assert.equal(g.timers.size, 1);
    g[action]();
    resolve();
    await pending;
    assert.equal(g.timers.size, 0);
    assert.equal(g.by("p", "Voice events copied"), undefined);
    if (action === "timeout") {
      assert.match(g.by("textarea").props.value, /event=result/);
      assert.equal(
        g.by("button", "Copy all voice events").props.disabled,
        false,
      );
    }
  });
}
