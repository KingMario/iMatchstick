import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { posix } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const matchstick = require("../.test-out/lib/matchstick.js");
const compiled = new Map();
// Executed component-handler tests, NOT native-browser, CSS/layout, or device
// coverage. React hooks, DOM rectangles/capture, timers, and presentation children
// are modeled. MatchstickGame, MatchstickChar, MatchstickArt, drag, and legality
// are real code. SVG visibility is checked as rendered, not by matching source text.
function mount({ portrait = true, hand = "right", phone = true } = {}) {
  const state = [],
    effects = [],
    cache = new Map(),
    elements = new Map();
  const timers = new Map(),
    intervals = new Map();
  let cursor = 0,
    dirty = false,
    tree,
    timerId = 0,
    requests = 0;
  const events = () => {
    const listeners = new Map();
    return {
      addEventListener(name, fn) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(fn);
      },
      removeEventListener(name, fn) {
        listeners.get(name)?.delete(fn);
      },
      emit(name) {
        for (const fn of [...(listeners.get(name) ?? [])]) fn({});
      },
    };
  };
  const walk = (node) =>
    !node || typeof node !== "object"
      ? []
      : Array.isArray(node)
        ? node.flatMap(walk)
        : [node, ...walk(node.props?.children)];
  const nodes = () => walk(tree);
  const document = {
    ...events(),
    body: {},
    hidden: false,
    visibilityState: "visible",
    documentElement: {
      classList: { toggle() {}, remove() {} },
      style: { setProperty() {}, removeProperty() {} },
    },
    querySelectorAll() {
      return nodes()
        .filter(
          (n) =>
            n.props?.className?.includes("placeholder") && !n.props.disabled,
        )
        .map((n) => n.element);
    },
  };
  const viewport = {
    ...events(),
    width: phone ? (portrait ? 390 : 844) : 1200,
    height: phone ? (portrait ? 844 : 390) : 900,
  };
  const window = {
    ...events(),
    visualViewport: viewport,
    innerWidth: viewport.width,
    innerHeight: viewport.height,
    localStorage: {},
    location: {
      search: "?puzzle=7-5%3D3",
      href: "https://example.test/?puzzle=7-5%3D3",
    },
    history: { replaceState() {} },
    matchMedia: () => ({ matches: phone }),
    setTimeout(fn, ms) {
      const id = ++timerId;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval(fn) {
      const id = ++timerId;
      intervals.set(id, fn);
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
  };
  function jsx(type, props = {}, key) {
    if (typeof type === "function") return type(props);
    const node = { type, props, key };
    if (props["data-position"] !== undefined) {
      const id = `${props["data-position"]}:${props["data-segment"]}`;
      if (!elements.has(id))
        elements.set(id, {
          captures: new Set(),
          releases: 0,
          setPointerCapture(id) {
            this.captures.add(id);
          },
          hasPointerCapture(id) {
            return this.captures.has(id);
          },
          releasePointerCapture(id) {
            assert.ok(this.captures.has(id), "release only an owned capture");
            this.captures.delete(id);
            this.releases++;
            // Native release bubbles lostpointercapture. The owner must be
            // cleared before this callback so a successful move survives it.
            tree?.props.onLostPointerCapture?.({ pointerId: id });
          },
          getBoundingClientRect() {
            const vertical =
              this.props["data-screen-orientation"] === "vertical";
            const left =
              100 +
              this.props["data-position"] * 400 +
              (this.props["data-segment"] % 3) * 100;
            const top = 100 + Math.floor(this.props["data-segment"] / 3) * 120;
            const width = vertical ? 12 : 60,
              height = vertical ? 60 : 12;
            return {
              left,
              top,
              width,
              height,
              right: left + width,
              bottom: top + height,
            };
          },
        });
      node.element = elements.get(id);
      node.element.props = props;
      node.element.dataset = {
        position: String(props["data-position"]),
        segment: String(props["data-segment"]),
        screenOrientation: props["data-screen-orientation"],
      };
    }
    if (props.ref)
      props.ref.current = {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 2200,
          height: 600,
        }),
      };
    return node;
  }
  const memo = (factory, deps) => {
    const i = cursor++,
      old = state[i];
    if (!old || deps.some((d, j) => !Object.is(d, old.deps[j])))
      state[i] = { deps, value: factory() };
    return state[i].value;
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state))
        state[i] = typeof initial === "function" ? initial() : initial;
      return [
        state[i],
        (value) => {
          const next = typeof value === "function" ? value(state[i]) : value;
          if (!Object.is(next, state[i])) {
            state[i] = next;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (state[i] ??= { current: initial });
    },
    useMemo: memo,
    useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) {
      const i = cursor++,
        old = state[i];
      if (!old || deps.some((d, j) => !Object.is(d, old.deps[j]))) {
        state[i] = { deps, cleanup: old?.cleanup };
        effects.push(() => {
          state[i].cleanup?.();
          state[i].cleanup = fn();
        });
      }
    },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    if (!compiled.has(file))
      compiled.set(
        file,
        ts.transpileModule(
          readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
          {
            compilerOptions: {
              target: ts.ScriptTarget.ES2020,
              module: ts.ModuleKind.CommonJS,
              jsx: ts.JsxEmit.ReactJSX,
            },
          },
        ).outputText,
      );
    vm.runInNewContext(
      compiled.get(file),
      {
        exports,
        document,
        window,
        URL,
        URLSearchParams,
        navigator: { userAgent: phone ? "iPhone" : "desktop" },
        Audio: class {
          load() {}
        },
        require(name) {
          if (name === "react") return react;
          if (name === "react/jsx-runtime")
            return { jsx, jsxs: jsx, Fragment: "fragment" };
          if (name === "react-dom") return { createPortal: (child) => child };
          const resolved = name.startsWith("@/")
            ? name.slice(2)
            : posix.normalize(posix.join(posix.dirname(file), name));
          if (resolved === "lib/clientStorage")
            return {
              readJson: (key, fallback) =>
                key.endsWith("settings")
                  ? {
                      ...fallback,
                      language: "en",
                      dragHand: hand,
                      soundEnabled: false,
                    }
                  : fallback,
              writeJson() {},
            };
          if (resolved === "lib/academyStorage")
            return {
              emptyAcademyProgress: { welcomed: true, completedLessonIds: [] },
              loadAcademy: () => ({
                progress: { welcomed: true, completedLessonIds: [] },
                showWelcome: false,
              }),
              saveAcademy() {},
            };
          if (resolved === "lib/puzzleBook")
            return {
              normalizePuzzleDifficulty: (value) => value,
              pickPuzzleFromBook: () => {
                requests++;
                return Promise.resolve(
                  matchstick.createPuzzleFromExpression("7-5=3"),
                );
              },
            };
          if (resolved === "components/matchstick/usePwaUpdate")
            return { usePwaUpdate: () => ({ status: "idle" }) };
          if (resolved === "lib/drag") return load(`${resolved}.ts`);
          if (resolved.startsWith("lib/"))
            return require(`../.test-out/${resolved}.js`);
          if (resolved === "components/matchstick/copy")
            return require(`../.test-out/${resolved}.js`);
          if (
            resolved === "components/matchstick/MatchstickChar" ||
            resolved === "components/matchstick/MatchstickArt"
          )
            return load(`${resolved}.tsx`);
          if (resolved.startsWith("components/matchstick/")) {
            const name = posix.basename(resolved);
            return { [name]: (props) => jsx(name, props) };
          }
          throw new Error(`Unmodeled import: ${name}`);
        },
      },
      { filename: file },
    );
    return exports;
  }
  const { MatchstickGame } = load("components/MatchstickGame.tsx");
  function render() {
    let count = 0;
    do {
      assert.ok(count++ < 20, "hooks settle");
      dirty = false;
      cursor = 0;
      tree = MatchstickGame();
      for (const effect of effects.splice(0)) effect();
    } while (dirty);
  }
  render();
  const find = (predicate) => {
    const node = nodes().find(predicate);
    assert.ok(node, "expected rendered node");
    return node;
  };
  const byType = (type) => find((n) => n.type === type);
  const segment = (position, segment) =>
    find(
      (n) =>
        n.props?.["data-position"] === position &&
        n.props?.["data-segment"] === segment,
    );
  const center = (node) => {
    const r = node.element.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  function pointer(node, phase, point, pointerType = "touch", pointerId = 7) {
    assert.ok(!node.props.disabled, "gesture starts on an actionable segment");
    node.props[`onPointer${phase}`]({
      clientX: point.x,
      clientY: point.y,
      pointerType,
      pointerId,
      button: 0,
      currentTarget: node.element,
      preventDefault() {},
    });
    render();
  }
  const act = (fn) => {
    fn();
    render();
  };
  return {
    render,
    nodes,
    byType,
    segment,
    center,
    pointer,
    click: (node) => act(() => node.props.onClick()),
    phone,
    act,
    viewport,
    window,
    document,
    timers,
    lens: () => nodes().find((n) => n.type === "TouchMagnifier"),
    ghost: () =>
      nodes().find((n) =>
        n.props?.className?.split(" ").includes("drag-ghost"),
      ),
    root: () => tree,
    requests: () => requests,
    tick() {
      const callbacks = [...intervals.values()];
      assert.ok(callbacks.length);
      act(() => callbacks.forEach((fn) => fn()));
    },
    flushTimers() {
      act(() => {
        const all = [...timers.values()];
        timers.clear();
        all.forEach((t) => t.fn());
      });
    },
  };
}

function matchArtwork(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(matchArtwork);
  return [
    ...(node.type === "svg" && node.props.className === "matchstick-art"
      ? [node]
      : []),
    ...matchArtwork(node.props?.children),
  ];
}
function assertSourceArtwork(node, hidden) {
  assert.equal(node.type, "button", "source button stays mounted");
  const artwork = matchArtwork(node);
  assert.equal(artwork.length, 1, "source still owns its SVG artwork");
  assert.equal(artwork[0].props.style?.visibility === "hidden", hidden);
  assert.notEqual(node.props.style?.visibility, "hidden", "hide only the art");
  assert.notEqual(node.props.style?.display, "none", "keep the hit target");
  assert.notEqual(node.props.style?.opacity, 0, "keep the hit target visible");
}
function assertNoHiddenArtwork(game) {
  assert.ok(
    game
      .nodes()
      .filter((node) => node.type === "svg")
      .every((node) => node.props.style?.visibility !== "hidden"),
    "cleared gesture cannot leave stale hidden source artwork",
  );
}

function begin(game, from = [4, 3], pointerType = "touch") {
  const source = game.segment(...from);
  assertSourceArtwork(source, false);
  game.pointer(source, "Down", game.center(source), pointerType);
  const pressed = game.segment(...from);
  assertSourceArtwork(pressed, game.phone && pointerType === "touch");
  assert.equal(
    pressed.element,
    source.element,
    "touch keeps the capture owner",
  );
  assert.equal(pressed.props.disabled, false, "press does not lock the source");
  assert.equal(
    pressed.props.className,
    source.props.className,
    "press does not select or remove the match",
  );
  assert.ok(pressed.element.captures.has(7));
  assert.equal(
    game
      .nodes()
      .filter(
        (node) =>
          node.type === "svg" && node.props.style?.visibility === "hidden",
      ).length,
    game.phone && pointerType === "touch" ? 1 : 0,
    "only the pressed phone-touch source artwork is hidden",
  );
  assert.equal(
    Boolean(game.lens()),
    game.phone && pointerType === "touch",
    "phone touch reveals its lens on pointerdown before drag threshold",
  );
  assert.ok(!game.ghost(), "pointerdown never starts the conventional helper");
  return game.segment(...from);
}
function drag(game, from = [4, 3], to = [4, 5], pointerType = "touch") {
  const source = begin(game, from, pointerType),
    target = game.segment(...to),
    point = game.center(target);
  game.pointer(source, "Move", point, pointerType);
  assertSourceArtwork(
    game.segment(...from),
    game.phone && pointerType === "touch",
  );
  return { source: game.segment(...from), point, target };
}

for (const portrait of [false, true])
  for (const hand of ["left", "right"]) {
    const label = `${portrait ? "portrait" : "landscape"}/${hand}`;
    test(`main phone touch first motion snaps and successful release clears lens: ${label}`, () => {
      const g = mount({ portrait, hand });
      const { source, point, target } = drag(g);
      const lens = g.lens();
      assert.ok(lens);
      assert.ok(!g.ghost());
      assert.equal(lens.props.point.x, point.x);
      assert.equal(lens.props.point.y, point.y);
      assert.equal(lens.props.stick.x, point.x);
      assert.equal(lens.props.stick.y, point.y);
      assert.equal(lens.props.stick.snapped, true);
      assert.equal(
        lens.props.stick.orientation,
        target.props["data-screen-orientation"],
      );
      g.pointer(source, "Up", point);
      assertNoHiddenArtwork(g);
      assert.ok(!g.lens());
      assert.ok(!g.ghost());
      assert.ok(g.nodes().some((n) => n.props?.["aria-label"] === "7-5=2"));
      assert.equal(g.byType("GameControls").props.solved, true);
      assertSourceArtwork(g.segment(4, 5), false);
      assert.ok(
        !g
          .nodes()
          .some(
            (node) =>
              node.props?.["data-position"] === 4 &&
              node.props?.["data-segment"] === 3,
          ),
        "successful source disappears from the solved expression",
      );
    });
    test(`main phone touch orientation changes on first motion before wrong drop: ${label}`, () => {
      const g = mount({ portrait, hand });
      const { source, point, target } = drag(g, [0, 1], [1, 1]);
      assert.notEqual(
        source.props["data-screen-orientation"],
        target.props["data-screen-orientation"],
      );
      assert.equal(
        g.lens().props.stick.orientation,
        target.props["data-screen-orientation"],
      );
      assert.equal(g.lens().props.stick.snapped, true);
      g.pointer(source, "Up", point);
      assertNoHiddenArtwork(g);
      assert.ok(!g.lens());
      assert.equal(g.timers.size, 0, "touch has no return-animation timer");
      assert.equal(g.byType("GameControls").props.solved, false);
      assertSourceArtwork(g.segment(0, 1), false);
      assert.ok(g.nodes().some((n) => n.props?.["aria-label"] === "7-5=3"));
    });
    test(`main phone touch unsnapped coordinates have zero offset: ${label}`, () => {
      const g = mount({ portrait, hand }),
        source = begin(g),
        point = { x: 2500, y: 1500 };
      g.pointer(source, "Move", point);
      assert.equal(g.lens().props.stick.x, point.x);
      assert.equal(g.lens().props.stick.y, point.y);
      assert.equal(g.lens().props.stick.snapped, false);
      g.pointer(g.segment(4, 3), "Up", point);
      assertSourceArtwork(g.segment(4, 3), false);
      assertNoHiddenArtwork(g);
      assert.ok(!g.lens());
    });
  }

for (const mode of ["active", "pending"])
  for (const interruption of [
    "cancel",
    "lost capture",
    "viewport",
    "blur",
    "hidden",
    "settings",
    "answers",
    "new puzzle",
    "academy",
    "timeout",
  ]) {
    test(`main touch ${mode} gesture clears on ${interruption}`, async () => {
      const g = mount();
      if (interruption === "timeout")
        g.act(() => g.byType("GameSettings").props.onTimerChange(true));
      const source = mode === "active" ? drag(g).source : begin(g);
      assert.ok(g.lens(), "both pending and active phone gestures show a lens");
      const actions = {
        cancel: () =>
          source.props.onPointerCancel({
            pointerId: 7,
            currentTarget: source.element,
          }),
        "lost capture": () =>
          g.root().props.onLostPointerCapture({ pointerId: 7 }),
        viewport: () => {
          g.viewport.width += 10;
          g.viewport.emit("resize");
        },
        blur: () => g.window.emit("blur"),
        hidden: () => {
          g.document.hidden = true;
          g.document.visibilityState = "hidden";
          g.document.emit("visibilitychange");
        },
        settings: () =>
          g
            .nodes()
            .find((n) => n.props?.className === "settings-button")
            .props.onClick(),
        answers: () => g.byType("GameControls").props.onToggleAnswers(),
        "new puzzle": () => g.byType("GameControls").props.onNewPuzzle(),
        academy: () => g.byType("GameSettings").props.onOpenAcademy(),
        timeout: () => {},
      };
      if (interruption === "timeout") for (let i = 0; i < 60; i++) g.tick();
      else g.act(actions[interruption]);
      assertNoHiddenArtwork(g);
      assert.ok(!g.lens());
      assert.ok(!g.ghost());
      assert.equal(
        source.element.captures.size,
        0,
        "interruption releases capture",
      );
      // Stale captured move/up callbacks must not recreate a cleared gesture.
      g.act(() =>
        source.props.onPointerMove({
          pointerId: 7,
          clientX: 2500,
          clientY: 1500,
        }),
      );
      g.act(() =>
        source.props.onPointerUp({
          pointerId: 7,
          clientX: 2500,
          clientY: 1500,
        }),
      );
      assert.ok(!g.lens());
      assert.ok(!g.ghost());
      if (interruption === "new puzzle") {
        assert.equal(g.requests(), 1);
        await Promise.resolve();
        g.render();
        assert.equal(g.byType("GameControls").props.isLoading, false);
      }
      if (interruption === "academy")
        g.act(() => g.byType("Academy").props.onExit());
      assertNoHiddenArtwork(g);
      assertSourceArtwork(g.segment(4, 3), false);
    });
  }

for (const portrait of [false, true])
  for (const hand of ["left", "right"]) {
    test(`main mouse retains offset/spinning helper and animated return: ${portrait}/${hand}`, () => {
      const g = mount({ portrait, hand }),
        source = begin(g, [4, 3], "mouse"),
        point = { x: 2500, y: 1500 };
      g.pointer(source, "Move", point, "mouse");
      assert.ok(!g.lens());
      assertSourceArtwork(g.segment(4, 3), false);
      const ghost = g.ghost();
      assert.ok(ghost);
      const rect = source.element.getBoundingClientRect();
      const metrics = require("../.test-out/lib/drag.js").getDragHelperMetrics(
        rect,
        source.props["data-screen-orientation"],
        portrait,
        hand,
      );
      assert.equal(ghost.props.style.left, point.x + metrics.offsetX);
      assert.equal(ghost.props.style.top, point.y + metrics.offsetY);
      assert.ok(
        !ghost.props.className.includes("snapped"),
        "unsnapped ghost retains CSS spin hook",
      );
      assert.equal(ghost.props.children.props.viewBox, "0 0 240 68");
      g.pointer(g.segment(4, 3), "Cancel", point, "mouse");
      assert.ok(g.ghost().props.className.includes("returning"));
      assert.ok([...g.timers.values()].some((timer) => timer.ms === 180));
      g.flushTimers();
      assert.ok(!g.ghost());
    });
  }

test("desktop touch retains conventional helper rather than phone lens", () => {
  const g = mount({ phone: false }),
    source = begin(g);
  g.pointer(source, "Move", { x: 2500, y: 1500 });
  assert.ok(!g.lens());
  assert.ok(g.ghost());
  assertSourceArtwork(g.segment(4, 3), false);
});

for (const portrait of [false, true]) {
  test(`main touch below-threshold release cannot resurrect a drag: ${portrait}`, () => {
    const g = mount({ portrait });
    const source = begin(g),
      point = g.center(source);
    g.pointer(source, "Move", { x: point.x + 3, y: point.y + 3 });
    assert.ok(g.lens(), "small motion keeps the touch-press lens visible");
    assert.equal(g.lens().props.point.x, point.x + 3);
    assert.equal(g.lens().props.point.y, point.y + 3);
    assert.equal(g.lens().props.stick.snapped, false);
    assert.ok(!g.ghost());
    assert.ok(!g.segment(4, 3).props.className.split(" ").includes("selected"));
    assert.ok(g.nodes().some((n) => n.props?.["aria-label"] === "7-5=3"));
    g.pointer(g.segment(4, 3), "Up", point);
    assertSourceArtwork(g.segment(4, 3), false);
    assertNoHiddenArtwork(g);
    assert.equal(source.element.captures.size, 0);
    g.pointer(g.segment(4, 3), "Move", { x: 2500, y: 1500 });
    assert.ok(!g.lens());
    assert.ok(!g.ghost());
    g.click(g.segment(4, 3));
    assert.ok(g.segment(4, 3).props.className.split(" ").includes("selected"));
    g.click(g.segment(4, 5));
    assert.equal(g.byType("GameControls").props.solved, true);
  });
  test(`main mouse offset target preview and release agree: ${portrait}`, () => {
    const g = mount({ portrait });
    const source = begin(g, [4, 3], "mouse");
    const target = g.segment(4, 5),
      targetPoint = g.center(target);
    const metrics = require("../.test-out/lib/drag.js").getDragHelperMetrics(
      source.element.getBoundingClientRect(),
      source.props["data-screen-orientation"],
      portrait,
      "right",
    );
    const pointerPoint = {
      x: targetPoint.x - metrics.offsetX,
      y: targetPoint.y - metrics.offsetY,
    };
    g.pointer(source, "Move", pointerPoint, "mouse");
    assert.ok(!g.lens());
    assert.ok(g.ghost().props.className.includes("snapped"));
    assert.equal(g.ghost().props.style.left, targetPoint.x);
    assert.equal(g.ghost().props.style.top, targetPoint.y);
    assert.equal(
      g.ghost().props.children.props.viewBox,
      target.props["data-screen-orientation"] === "vertical"
        ? "0 0 68 240"
        : "0 0 240 68",
    );
    g.pointer(g.segment(4, 3), "Up", pointerPoint, "mouse");
    assert.ok(!g.ghost());
    assert.equal(g.byType("GameControls").props.solved, true);
  });
}

for (const portrait of [false, true])
  for (const hand of ["left", "right"]) {
    test(`main touch press magnifies immediately, then ordinary two-tap solving works: ${portrait}/${hand}`, () => {
      const g = mount({ portrait, hand });
      const source = g.segment(4, 3);
      const centerPoint = g.center(source);
      const point = { x: centerPoint.x + 2, y: centerPoint.y + 2 };
      g.pointer(source, "Down", point);
      assertSourceArtwork(g.segment(4, 3), true);
      assert.equal(g.segment(4, 3).element, source.element);
      assert.equal(g.segment(4, 3).props.disabled, false);
      const lens = g.lens();
      assert.ok(lens, "no pointermove is needed to render the lens");
      assert.equal(lens.props.point.x, point.x);
      assert.equal(lens.props.point.y, point.y);
      assert.equal(lens.props.stick.x, point.x);
      assert.equal(lens.props.stick.y, point.y);
      assert.equal(lens.props.stick.snapped, false);
      assert.equal(
        lens.props.stick.orientation,
        source.props["data-screen-orientation"],
      );
      assert.ok(!g.ghost());
      assert.ok(
        !g.segment(4, 3).props.className.split(" ").includes("selected"),
      );
      assert.ok(g.nodes().some((n) => n.props?.["aria-label"] === "7-5=3"));
      assert.equal(g.byType("GameControls").props.solved, false);
      assert.ok(source.element.captures.has(7));

      g.pointer(g.segment(4, 3), "Up", point);
      assertSourceArtwork(g.segment(4, 3), false);
      assertNoHiddenArtwork(g);
      assert.ok(!g.lens());
      assert.ok(!g.ghost());
      assert.equal(source.element.captures.size, 0);
      g.click(g.segment(4, 3)); // Native click generated after the touch release.
      assert.ok(
        g.segment(4, 3).props.className.split(" ").includes("selected"),
      );
      assert.equal(g.byType("GameControls").props.solved, false);

      const target = g.segment(4, 5);
      g.pointer(target, "Down", g.center(target));
      assert.ok(
        !g.lens(),
        "an empty destination is not a new draggable source",
      );
      g.pointer(g.segment(4, 5), "Up", g.center(target));
      g.click(g.segment(4, 5));
      assert.equal(g.byType("GameControls").props.solved, true);
      assert.ok(g.nodes().some((n) => n.props?.["aria-label"] === "7-5=2"));
      assert.ok(!g.lens());
    });
  }

for (const mode of ["pending", "active"]) {
  test(`main ${mode} phone touch ignores every secondary pointer phase`, () => {
    const g = mount();
    const source = mode === "active" ? drag(g).source : begin(g);
    const point = { ...g.lens().props.point };
    const stick = { ...g.lens().props.stick };
    const secondary = g.segment(0, 1);
    const foreignPoint = { x: 2500, y: 1500 };
    for (const phase of ["Down", "Move", "Up", "Cancel"]) {
      g.pointer(secondary, phase, foreignPoint, "touch", 99);
      assertSourceArtwork(g.segment(4, 3), true);
      assertSourceArtwork(g.segment(0, 1), false);
      assert.ok(
        g.lens(),
        `${phase} from another pointer cannot dismiss the lens`,
      );
      assert.deepEqual({ ...g.lens().props.point }, point);
      assert.deepEqual({ ...g.lens().props.stick }, stick);
      assert.ok(source.element.captures.has(7));
      assert.ok(!secondary.element.captures.has(99));
      assert.equal(g.byType("GameControls").props.solved, false);
    }
    g.act(() => g.root().props.onLostPointerCapture({ pointerId: 99 }));
    assert.ok(g.lens(), "foreign lostcapture cannot dismiss the primary lens");
    assertSourceArtwork(g.segment(4, 3), true);
    assertSourceArtwork(g.segment(0, 1), false);
    assert.deepEqual({ ...g.lens().props.point }, point);
    const target = g.segment(4, 5);
    g.pointer(g.segment(4, 3), "Move", g.center(target));
    g.pointer(g.segment(4, 3), "Up", g.center(target));
    assert.equal(g.byType("GameControls").props.solved, true);
    assert.ok(!g.lens());
    assert.equal(source.element.captures.size, 0);
  });

  test(`main ${mode} phone touch release outside clears without moving a match`, () => {
    const g = mount();
    const source = mode === "active" ? drag(g).source : begin(g);
    g.pointer(source, "Up", { x: -1000, y: -1000 });
    assertSourceArtwork(g.segment(4, 3), false);
    assertNoHiddenArtwork(g);
    assert.ok(!g.lens());
    assert.ok(!g.ghost());
    assert.equal(source.element.captures.size, 0);
    assert.equal(g.byType("GameControls").props.solved, false);
    assert.ok(g.nodes().some((n) => n.props?.["aria-label"] === "7-5=3"));
    assert.equal(g.timers.size, 0);
  });
}

test("main touch press released over a legal target without moving never commits", () => {
  const g = mount();
  const source = begin(g);
  const target = g.segment(4, 5);
  g.pointer(source, "Up", g.center(target));
  assertSourceArtwork(g.segment(4, 3), false);
  assertNoHiddenArtwork(g);
  assert.ok(!g.lens());
  assert.equal(source.element.captures.size, 0);
  assert.equal(g.byType("GameControls").props.solved, false);
  assert.ok(g.nodes().some((n) => n.props?.["aria-label"] === "7-5=3"));
  assert.ok(!g.segment(4, 3).props.className.split(" ").includes("selected"));
});

test("main desktop mouse press and small movement retain ordinary tap selection", () => {
  const g = mount({ phone: false });
  const source = begin(g, [4, 3], "mouse");
  const point = g.center(source);
  g.pointer(source, "Move", { x: point.x + 2, y: point.y + 2 }, "mouse");
  assert.ok(!g.lens());
  assert.ok(!g.ghost());
  assert.ok(!g.segment(4, 3).props.className.split(" ").includes("selected"));
  g.pointer(g.segment(4, 3), "Up", point, "mouse");
  assert.equal(source.element.captures.size, 0);
  g.click(g.segment(4, 3));
  assert.ok(g.segment(4, 3).props.className.split(" ").includes("selected"));
  g.click(g.segment(4, 5));
  assert.equal(g.byType("GameControls").props.solved, true);
});

test("main locked and nonmovable source handlers cannot hide artwork", () => {
  const g = mount();
  const locked = g
    .nodes()
    .find(
      (node) =>
        node.type === "button" &&
        node.props.disabled &&
        node.props.className?.split(" ").includes("visible"),
    );
  assert.ok(locked, "puzzle has a nonmovable occupied match");
  const press = (node) =>
    g.act(() =>
      node.props.onPointerDown({
        pointerId: 7,
        pointerType: "touch",
        button: 0,
        currentTarget: node.element,
        clientX: g.center(node).x,
        clientY: g.center(node).y,
        preventDefault() {},
      }),
    );
  press(locked); // Call the guard even though a native disabled button cannot fire.
  assertNoHiddenArtwork(g);
  assert.ok(!g.lens());
  assert.equal(locked.element.captures.size, 0);
  const { source, point } = drag(g);
  g.pointer(source, "Up", point);
  const solved = g.segment(4, 5);
  assert.ok(solved.props.disabled, "solved board is interaction-locked");
  press(solved);
  assertSourceArtwork(g.segment(4, 5), false);
  assertNoHiddenArtwork(g);
  assert.ok(!g.lens());
  assert.equal(solved.element.captures.size, 0);
});
