import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const academy = require("../.test-out/lib/academy.js");
const matchstick = require("../.test-out/lib/matchstick.js");
const {
  academyCopy,
} = require("../.test-out/components/matchstick/academyCopy.js");

// This deliberately tests the real React component handlers with a small hook/DOM
// model. It is NOT a browser, layout, accessibility, or native pointer-event test.
// Academy validation, MatchstickChar and SVG artwork rendering, and drag math
// are production code. The magnifier presentation remains modeled.
function mount(id, overrides = {}) {
  const lesson = academy.academyLessons.find((item) => item.id === id);
  assert.ok(lesson, id);
  let slots = [];
  let lessonSlots = [];
  let lessonKey = null;
  let renderedLesson = false;
  let cursor = 0;
  let tree;
  let pendingEffects = [];
  let mounted = true;
  const cleanups = [];
  const elements = new Map();
  const completed = [];
  let randomCalls = 0;
  const math = Object.create(Math);
  math.random = () => {
    randomCalls++;
    return overrides.random ? overrides.random() : 0.75;
  };
  let next = 0;
  let overview = 0;
  const windowListeners = new Map();
  const documentListeners = new Map();
  const eventTarget = (listeners) => ({
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) {
      listeners.get(name)?.delete(callback);
    },
  });
  const walk = (node) => {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(walk);
    return [node, ...walk(node.props?.children)];
  };
  const nodes = () => walk(tree);
  const placeholders = () =>
    nodes()
      .filter(
        (node) =>
          node.props?.className?.includes("match-segment") &&
          node.props.className.includes("placeholder") &&
          !node.props.disabled,
      )
      .map((node) => node.element);
  const document = {
    ...eventTarget(documentListeners),
    body: {},
    hidden: false,
    querySelectorAll: () => placeholders(),
    elementFromPoint(x, y) {
      return (
        placeholders().find((element) => {
          const r = element.getBoundingClientRect();
          return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        }) ?? null
      );
    },
  };
  function rectFor(props) {
    if (props["data-testid"] === "academy-reservoir")
      return {
        left: 600,
        top: 400,
        width: overrides.phonePortrait ? 80 : 180,
        height: overrides.phonePortrait ? 180 : 80,
      };
    const position = Number(props["data-position"] ?? 0);
    const segment = Number(props["data-segment"] ?? 0);
    const horizontal = props.className?.split(" ").includes("horizontal");
    // Widely spaced slots keep mock rectangles unambiguous; these are not CSS
    // geometry assertions. phonePortrait models screen-space quarter rotation.
    const vertical = overrides.phonePortrait ? horizontal : !horizontal;
    return {
      left: 100 + position * 400 + (segment % 3) * 100,
      top: 100 + Math.floor(segment / 3) * 100,
      width: vertical ? 12 : 60,
      height: vertical ? 60 : 12,
    };
  }
  function jsx(type, props = {}, key) {
    if (typeof type === "function") {
      if (overrides.overviewOnly && type.name === "AcademyLessonView")
        return { type: "lesson-proxy", props, key };
      if (overrides.fullFlow && type.name === "AcademyLessonView") {
        renderedLesson = true;
        if (lessonKey !== key) {
          lessonSlots = [];
          lessonKey = key;
        }
        const parentSlots = slots,
          parentCursor = cursor;
        slots = lessonSlots;
        cursor = 0;
        const child = type(props);
        slots = parentSlots;
        cursor = parentCursor;
        return child;
      }
      return type(props);
    }
    const node = { type, props, key };
    if (type === "button") {
      const identity =
        props["data-position"] !== undefined
          ? `segment:${props["data-position"]}:${props["data-segment"]}`
          : (props["data-testid"] ??
            `choice:${props["data-choice"] ?? key ?? props.children}`);
      if (!elements.has(identity)) {
        const captures = new Set();
        const element = {
          captures,
          focus() {},
          releases: 0,
          setPointerCapture: (pointerId) => captures.add(pointerId),
          hasPointerCapture: (pointerId) => captures.has(pointerId),
          releasePointerCapture(pointerId) {
            assert.ok(captures.has(pointerId), "release only an owned capture");
            captures.delete(pointerId);
            this.releases++;
            // Model bubbling lostpointercapture during release. clearDrag must
            // null its ref first so cleanup cannot cancel a successful move.
            tree?.props.onLostPointerCapture?.({ pointerId });
          },
          getBoundingClientRect() {
            const rect = rectFor(this.props);
            return {
              ...rect,
              right: rect.left + rect.width,
              bottom: rect.top + rect.height,
            };
          },
          querySelector(selector) {
            assert.equal(selector, ".matchstick-art");
            if (
              this.props["data-testid"] !== "academy-reservoir" ||
              !walk(this.props.children).some(
                (child) => child.props?.className === "matchstick-art",
              )
            )
              return null;
            // The artwork is much shorter than its surrounding button. Model
            // its screen-space rotation independently to catch button sizing.
            return {
              getBoundingClientRect() {
                const width = overrides.phonePortrait ? 12 : 74;
                const height = overrides.phonePortrait ? 74 : 12;
                return {
                  left: 620,
                  top: 410,
                  width,
                  height,
                  right: 620 + width,
                  bottom: 410 + height,
                };
              },
            };
          },
          closest(selector) {
            assert.equal(selector, ".match-segment.placeholder:not(:disabled)");
            return this.props.className?.includes("placeholder") &&
              !this.props.disabled
              ? this
              : null;
          },
        };
        elements.set(identity, element);
      }
      node.element = elements.get(identity);
      node.element.props = props;
      node.element.dataset = {
        position: String(props["data-position"]),
        segment: String(props["data-segment"]),
        screenOrientation: props["data-screen-orientation"],
      };
      if (props.ref) props.ref.current = node.element;
    }
    if (props.ref && !node.element) {
      const identity = `ref:${props.className ?? type}`;
      if (!elements.has(identity))
        elements.set(identity, {
          focus() {},
          scrollTo() {},
          getBoundingClientRect() {
            // The lesson title shares the board's physical quarter-turn.
            if (type === "h2")
              return overrides.phonePortrait
                ? { left: 330, top: 270, width: 40, height: 300 }
                : { left: 270, top: 20, width: 300, height: 40 };
            return { left: 0, top: 0, width: 2200, height: 600 };
          },
        });
      node.element = elements.get(identity);
      node.element.props = props;
      props.ref.current = node.element;
    }
    return node;
  }
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      const stateSlots = slots;
      return [
        stateSlots[index],
        (value) => {
          assert.ok(mounted, "no state updates after unmount");
          stateSlots[index] =
            typeof value === "function" ? value(stateSlots[index]) : value;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous[i]))) {
        slots[index] = deps;
        pendingEffects.push(effect);
      }
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    vm.runInNewContext(
      ts.transpileModule(
        readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
          },
        },
      ).outputText,
      {
        exports,
        Math: math,
        document,
        window: eventTarget(windowListeners),
        require(name) {
          if (name === "react") return react;
          if (name === "react/jsx-runtime")
            return { jsx, jsxs: jsx, Fragment: "fragment" };
          if (name === "react-dom") return { createPortal: (child) => child };
          if (name === "../../lib/academy") return academy;
          if (name === "../../lib/matchstick") return matchstick;
          if (name === "../../lib/matchstickAppearance")
            return load("lib/matchstickAppearance.ts");
          if (name === "../../lib/drag") return load("lib/drag.ts");
          if (
            name === "../../lib/matchstickSlots" ||
            name === "./matchstickSlots"
          )
            return load("lib/matchstickSlots.ts");
          if (name === "./academyCopy")
            return load("components/matchstick/academyCopy.ts");
          if (name === "./MatchstickChar")
            return load("components/matchstick/MatchstickChar.tsx");
          if (name === "./MatchstickArt")
            return load("components/matchstick/MatchstickArt.tsx");
          if (name === "./TouchMagnifier")
            return { TouchMagnifier: (props) => jsx("touch-magnifier", props) };
          if (name === "./SuccessConfetti")
            return { SuccessConfetti: () => jsx("confetti") };
          throw new Error(`Unexpected import: ${name}`);
        },
      },
      { filename: file },
    );
    return exports;
  }
  const { AcademyLessonView, Academy } = load(
    "components/matchstick/Academy.tsx",
  );
  function render() {
    cursor = 0;
    renderedLesson = false;
    tree = (
      overrides.overviewOnly || overrides.fullFlow ? Academy : AcademyLessonView
    )({
      lesson,
      index: academy.academyLessons.indexOf(lesson),
      language: "en",
      phonePortrait: false,
      dragHand: "right",
      completedLessonIds: [],
      onComplete: (value) => completed.push(value),
      onExit() {},
      onNext: () => next++,
      onOverview: () => overview++,
      ...overrides,
    });
    if (overrides.fullFlow && !renderedLesson) {
      lessonSlots = [];
      lessonKey = null;
    }
    const effects = pendingEffects;
    pendingEffects = [];
    for (const effect of effects) cleanups.push(effect());
  }
  render();
  const find = (predicate) => {
    const node = nodes().find(predicate);
    assert.ok(node, "Expected rendered node");
    return node;
  };
  const byId = (id) => find((node) => node.props?.["data-testid"] === id);
  const segment = (point) =>
    find(
      (node) =>
        node.type === "button" &&
        node.props["data-position"] === point.position &&
        node.props["data-segment"] === point.segment,
    );
  function click(node, detail = 0) {
    assert.ok(
      !node.props.disabled,
      "cannot activate a disabled rendered button",
    );
    tree.props.onClickCapture?.({ detail });
    node.props.onClick();
    render();
  }
  function pointer(node, kind, x, y, pointerId = 7, extras = {}) {
    const event = {
      clientX: x,
      clientY: y,
      pointerId,
      pointerType: "touch",
      button: 0,
      currentTarget: node.element,
      preventDefault() {},
      ...extras,
    };
    node.props[`onPointer${kind}`](event);
    render();
  }
  return {
    lesson,
    completed,
    randomCalls: () => randomCalls,
    nodes,
    byId,
    segment,
    click,
    pointer,
    next: () => next,
    overview: () => overview,
    status: () => {
      const children = find((node) => node.props?.role === "status").props
        .children;
      return Array.isArray(children)
        ? children.filter((child) => typeof child === "string").join("")
        : children;
    },
    lens: () => nodes().find((node) => node.type === "touch-magnifier"),
    success: () =>
      nodes().some((node) => node.props?.["data-testid"] === "academy-success"),
    ghost: () =>
      nodes().find((node) => node.props?.className?.includes("academy-ghost")),
    visibleSegments: () =>
      nodes()
        .filter(
          (node) =>
            node.type === "button" &&
            node.props.className?.split(" ").includes("visible"),
        )
        .map((node) => ({
          position: node.props["data-position"],
          segment: node.props["data-segment"],
        })),
    emit(name, detail = {}, onDocument = false) {
      if (onDocument && "hidden" in detail) document.hidden = detail.hidden;
      for (const callback of (onDocument
        ? documentListeners
        : windowListeners
      ).get(name) ?? [])
        callback(detail);
      render();
    },
    lostCapture(pointerId = 7) {
      tree.props.onLostPointerCapture({ pointerId });
      render();
    },
    unmount() {
      for (const cleanup of cleanups) cleanup?.();
      mounted = false;
    },
    listenerCount: () =>
      [...windowListeners.values(), ...documentListeners.values()].reduce(
        (n, set) => n + set.size,
        0,
      ),
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
  assert.equal(node.type, "button", "source button remains mounted");
  const artwork = matchArtwork(node);
  assert.equal(artwork.length, 1, "source keeps its SVG artwork");
  assert.equal(artwork[0].props.style?.visibility === "hidden", hidden);
  assert.notEqual(node.props.style?.visibility, "hidden", "only hide artwork");
  assert.notEqual(node.props.style?.display, "none", "keep the hit target");
  assert.notEqual(node.props.style?.opacity, 0, "keep button presentation");
}
function assertNoHiddenArtwork(h) {
  assert.ok(
    h
      .nodes()
      .filter((node) => node.type === "svg")
      .every((node) => node.props.style?.visibility !== "hidden"),
    "cleared gesture restores every remaining source artwork",
  );
}
function currentSource(h) {
  const { from } = academy.getAcademySolution(h.lesson);
  return from ? h.segment(from) : h.byId("academy-reservoir");
}
function assertPressedArtwork(h, original = currentSource(h)) {
  const current = currentSource(h);
  assertSourceArtwork(current, true);
  assert.equal(current.element, original.element, "capture owner is unchanged");
  assert.equal(current.props.disabled, false, "press keeps source actionable");
  assert.ok(current.element.captures.has(7), "source retains pointer capture");
  assert.equal(
    h
      .nodes()
      .filter(
        (node) =>
          node.type === "svg" && node.props.style?.visibility === "hidden",
      ).length,
    1,
    "only the primary source artwork is hidden",
  );
}

function clickSolution(h) {
  const { from, to } = academy.getAcademySolution(h.lesson);
  h.click(from ? h.segment(from) : h.byId("academy-reservoir"));
  h.click(to ? h.segment(to) : h.byId("academy-reservoir"));
}
function center(node) {
  const r = node.element.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}
function startDrag(h, source) {
  h.pointer(source, "Down", ...center(source));
  assertSourceArtwork(currentSource(h), false);
  h.pointer(source, "Move", 900, 900);
  assertSourceArtwork(currentSource(h), false);
  assert.ok(h.ghost(), "threshold crossing renders the real helper");
}

test("Academy recognition rejects a wrong choice, then completes and disables choices", () => {
  const h = mount("academy-1-1");
  const choice = (value) =>
    h.nodes().find((node) => node.props?.["data-choice"] === value);
  h.click(choice("4"));
  assert.equal(h.status(), academyCopy.en.feedback["incorrect-choice"]);
  assert.deepEqual(h.completed, []);
  assert.ok(!h.success());
  h.click(choice("1"));
  assert.ok(h.success());
  assert.deepEqual(h.completed, [h.lesson.id]);
  assert.ok(choice("4").props.disabled);
  assert.equal(choice("1").props["aria-pressed"], true);
});

for (const { id } of academy.academyLessons.filter(
  (lesson) => lesson.mode !== "recognition",
)) {
  test(`Academy ${id}: actual source/destination click handlers complete authored operation`, () => {
    const h = mount(id);
    clickSolution(h);
    assert.ok(h.success());
    assert.deepEqual(h.completed, [id]);
    assert.deepEqual(
      h.visibleSegments(),
      academy
        .getAcademyVisibleSegments(h.lesson.target)
        .filter((point) => h.lesson.target[point.position] !== "="),
    );
    assert.ok(
      h
        .nodes()
        .filter((node) => node.props?.className?.includes("match-segment"))
        .every((node) => node.props.disabled),
    );
  });
}

test("Academy invalid shapes are not offered as selectable sources or targets", () => {
  const h = mount("academy-3-1");
  assert.ok(h.segment({ position: 0, segment: 1 }).props.disabled);
  assert.ok(!h.success());
  assert.deepEqual(h.completed, []);
  assert.ok(
    h.segment({ position: 0, segment: 1 }).props.className.includes("visible"),
  );
  clickSolution(h);
  assert.ok(h.success());
});

test("Academy restart, hint, demonstration, next, and overview use real callbacks", () => {
  const h = mount("academy-3-4");
  assert.ok(
    !h.nodes().some((node) => node.props?.className === "academy-hint-card"),
  );
  h.click(h.byId("academy-hint"));
  assert.ok(
    h.nodes().some((node) => node.props?.className === "academy-hint-card"),
  );
  const demo = h
    .nodes()
    .find(
      (node) =>
        node.type === "button" &&
        /show.*move/i.test(String(node.props.children)),
    );
  assert.ok(demo);
  h.click(demo);
  assert.ok(
    h
      .nodes()
      .some((node) => node.props?.className?.includes("academy-hint-source")),
  );
  clickSolution(h);
  h.click(h.byId("academy-next"));
  assert.equal(h.next(), 1);
  h.click(h.byId("academy-reset"));
  assert.ok(!h.success());
  assert.ok(
    h
      .segment(academy.getAcademySolution(h.lesson).from)
      .props.className.includes("visible"),
  );
  h.click(h.segment(academy.getAcademySolution(h.lesson).from));
  h.click(h.byId("academy-reset"));
  assert.ok(
    !h
      .segment(academy.getAcademySolution(h.lesson).from)
      .props.className.split(" ")
      .includes("selected"),
  );
  h.click(h.byId("academy-overview"));
  assert.equal(h.overview(), 1);
});

for (const phonePortrait of [false, true]) {
  test(`Academy 0→6 drag snaps and rotates helper in ${phonePortrait ? "rotated" : "normal"} screen geometry`, () => {
    const h = mount("academy-3-4", { phonePortrait });
    const solution = academy.getAcademySolution(h.lesson);
    const source = h.segment(solution.from);
    startDrag(h, source);
    const sourceOrientation = phonePortrait ? "horizontal" : "vertical";
    assert.ok(h.ghost().props.className.endsWith(sourceOrientation));
    const target = h.segment(solution.to);
    h.pointer(source, "Move", ...center(target));
    assert.ok(
      h
        .ghost()
        .props.className.endsWith(phonePortrait ? "vertical" : "horizontal"),
    );
    const [x, y] = center(target);
    assert.equal(h.ghost().props.style.left, x);
    assert.equal(h.ghost().props.style.top, y);
    h.pointer(source, "Up", x, y);
    assert.ok(h.success());
    assert.ok(!h.ghost());
    assert.equal(source.element.captures.size, 0);
    assert.equal(source.element.releases, 1);
    assert.deepEqual(h.completed, [h.lesson.id]);
  });
}

for (const id of ["academy-2-1", "academy-2-2", "academy-4-1", "academy-5-1"]) {
  test(`Academy ${id}: drag through actual matchbox/card handlers`, () => {
    const h = mount(id);
    const { from, to } = academy.getAcademySolution(h.lesson);
    const source = from ? h.segment(from) : h.byId("academy-reservoir");
    startDrag(h, source);
    const target = to ? h.segment(to) : h.byId("academy-reservoir");
    h.pointer(source, "Move", ...center(target));
    h.pointer(source, "Up", ...center(target));
    assert.ok(h.success());
    assert.equal(source.element.captures.size, 0);
  });
}

for (const interruption of [
  "pointercancel",
  "lostcapture",
  "blur",
  "resize",
  "orientationchange",
  "visibilitychange",
  "Escape",
]) {
  test(`Academy ${interruption} clears helper/capture and keyboard activation still solves`, () => {
    const h = mount("academy-3-4");
    const source = h.segment(academy.getAcademySolution(h.lesson).from);
    startDrag(h, source);
    if (interruption === "pointercancel") h.pointer(source, "Cancel", 900, 900);
    else if (interruption === "lostcapture") h.lostCapture();
    else if (interruption === "visibilitychange")
      h.emit(interruption, { hidden: true }, true);
    else if (interruption === "Escape") h.emit("keydown", { key: "Escape" });
    else h.emit(interruption);
    assert.ok(!h.ghost());
    assert.equal(source.element.captures.size, 0);
    assert.deepEqual(h.completed, []);
    clickSolution(h); // detail=0: keyboard click must not be swallowed.
    assert.ok(h.success());
  });
}

test("Academy unmount removes lifecycle listeners and releases the captured pointer", () => {
  const h = mount("academy-3-4");
  const source = h.segment(academy.getAcademySolution(h.lesson).from);
  startDrag(h, source);
  assert.equal(h.listenerCount(), 5);
  h.unmount();
  assert.equal(h.listenerCount(), 0);
  assert.equal(source.element.captures.size, 0);
  assert.equal(source.element.releases, 1);
});

test("Academy pointer IDs, movement threshold, cancelled drop and synthetic click suppression", () => {
  const h = mount("academy-3-4");
  const solution = academy.getAcademySolution(h.lesson);
  const source = h.segment(solution.from);
  const [x, y] = center(source);
  h.pointer(source, "Down", x, y);
  h.pointer(source, "Move", x + 1, y + 1);
  assert.ok(!h.ghost());
  h.pointer(source, "Move", 900, 900, 99);
  h.pointer(source, "Up", 900, 900, 99);
  assert.ok(source.element.captures.has(7));
  h.pointer(source, "Move", 900, 900);
  h.pointer(source, "Up", 900, 900);
  assert.ok(!h.ghost());
  assert.equal(h.status(), academyCopy.en.cancelled);
  h.click(h.segment(solution.from), 1); // native pointer click after drag
  assert.ok(
    !h.segment(solution.from).props.className.split(" ").includes("selected"),
  );
  clickSolution(h);
  assert.ok(h.success());
});

test("Academy valid but wrong target explains mismatch without committing the wrong card", () => {
  const h = mount("academy-2-3"); // 5 + lower-left = 6; upper-right instead makes 9.
  h.click(h.byId("academy-reservoir"));
  h.click(h.segment({ position: 0, segment: 2 }));
  assert.equal(h.status(), academyCopy.en.feedback["wrong-target"]);
  assert.deepEqual(
    h.visibleSegments(),
    academy.getAcademyVisibleSegments(h.lesson.initial),
  );
  assert.deepEqual(h.completed, []);
  clickSolution(h);
  assert.ok(h.success());
});

test("Academy forbidden equation sources remain locked without completing the equation", () => {
  const h = mount("academy-6-1"); // Only final 2 is editable; try first 2.
  assert.ok(h.segment({ position: 0, segment: 5 }).props.disabled);
  assert.ok(
    !h
      .nodes()
      .some(
        (node) =>
          node.props?.["data-position"] === 0 &&
          node.props?.className?.includes("placeholder") &&
          !node.props.disabled,
      ),
  );
  assert.deepEqual(h.completed, []);
  clickSolution(h);
  assert.ok(h.success());
});

test("Academy hint levels reveal guidance without completing or moving a stick", () => {
  const h = mount("academy-3-4");
  const guidanceButton = (text) =>
    h
      .nodes()
      .find((node) => node.type === "button" && node.props.children === text);
  h.click(h.byId("academy-hint"));
  h.click(guidanceButton(academyCopy.en.hints[0]));
  const target = h.segment(academy.getAcademySolution(h.lesson).to);
  assert.ok(
    target.props.disabled,
    "outlined target still requires source selection",
  );
  h.click(h.byId("academy-hint"));
  h.click(guidanceButton(academyCopy.en.hints[1]));
  assert.ok(
    !h
      .nodes()
      .some((node) => node.props?.["data-testid"] === "academy-assistance"),
  );
  assert.equal(h.status(), h.lesson.hint.en);
  h.click(h.byId("academy-hint"));
  h.click(guidanceButton(academyCopy.en.hints[2]));
  assert.ok(
    !h.nodes().some((node) => node.props?.className === "academy-hint-card"),
  );
  assert.deepEqual(h.completed, []);
  assert.deepEqual(
    h.visibleSegments(),
    academy.getAcademyVisibleSegments(h.lesson.initial),
  );
});

test("Academy reservoir cancellation permits immediate keyboard source selection", () => {
  const h = mount("academy-2-1");
  const source = h.byId("academy-reservoir");
  startDrag(h, source);
  h.pointer(source, "Cancel", 900, 900);
  assert.equal(source.element.captures.size, 0);
  clickSolution(h);
  assert.ok(h.success());
});

test("Academy reset during drag releases capture and restores the untouched board", () => {
  const h = mount("academy-3-4");
  const source = h.segment(academy.getAcademySolution(h.lesson).from);
  startDrag(h, source);
  h.click(h.byId("academy-reset"));
  assert.equal(source.element.captures.size, 0);
  assert.ok(!h.ghost());
  assert.deepEqual(
    h.visibleSegments(),
    academy.getAcademyVisibleSegments(h.lesson.initial),
  );
  assert.deepEqual(h.completed, []);
  clickSolution(h);
  assert.ok(h.success());
});

for (const phonePortrait of [false, true]) {
  for (const dragHand of ["left", "right"]) {
    test(`Academy matchbox drag sizes and offsets from 74px artwork (${phonePortrait ? "rotated" : "normal"}, ${dragHand} hand)`, () => {
      const h = mount("academy-2-1", { phonePortrait, dragHand });
      const source = h.byId("academy-reservoir");
      const buttonRect = source.element.getBoundingClientRect();
      assert.equal(phonePortrait ? buttonRect.height : buttonRect.width, 180);
      startDrag(h, source); // Moves to 900,900, away from every snap rectangle.
      const style = h.ghost().props.style;
      // A 74px source produces a 30px helper unit, not the button's 72px.
      assert.equal(style.width, phonePortrait ? 22.5 : 75);
      assert.equal(style.height, phonePortrait ? 75 : 22.5);
      const horizontalOffset = dragHand === "left" ? 62.53 : -62.53;
      const expectedX = 900 + (phonePortrait ? 14.43 : horizontalOffset);
      const expectedY = 900 + (phonePortrait ? horizontalOffset : -14.43);
      assert.ok(Math.abs(style.left - expectedX) < 1e-9);
      assert.ok(Math.abs(style.top - expectedY) < 1e-9);
      h.pointer(source, "Cancel", 900, 900);
      assert.equal(source.element.captures.size, 0);
    });
  }
}

for (const language of ["en", "zh"]) {
  test(`Academy compact six-to-four navigation keeps every lesson unlocked (${language})`, () => {
    const h = mount("academy-1-1", { overviewOnly: true, language });
    const chapters = () =>
      h
        .nodes()
        .filter((node) => node.props?.["data-testid"] === "academy-chapter");
    const lessons = () =>
      h.nodes().filter((node) => node.props?.["data-lesson-id"]);
    assert.equal(chapters().length, 6);
    assert.equal(lessons().length, 0);
    for (const chapter of academy.academyChapters) {
      h.click(
        chapters().find((node) => node.props["data-chapter-id"] === chapter.id),
      );
      assert.equal(chapters().length, 0);
      assert.equal(lessons().length, 4);
      for (const lesson of academy.academyLessons.filter(
        (item) => item.chapterId === chapter.id,
      )) {
        h.click(
          lessons().find((node) => node.props["data-lesson-id"] === lesson.id),
        );
        const view = h.nodes().find((node) => node.type === "lesson-proxy");
        assert.equal(view.props.lesson.id, lesson.id);
        h.click({ props: { onClick: view.props.onOverview } });
        assert.equal(lessons().length, 4);
      }
      h.click(h.byId("academy-chapters-back"));
      assert.equal(chapters().length, 6);
    }
    assert.deepEqual(h.completed, []);
  });
}

test("Academy chapter boundary next and final skip navigate without inventing progress", () => {
  const h = mount("academy-1-1", { overviewOnly: true });
  const enter = (chapter, id) => {
    h.click(
      h.nodes().find((node) => node.props?.["data-chapter-id"] === chapter),
    );
    h.click(h.nodes().find((node) => node.props?.["data-lesson-id"] === id));
  };
  const next = () =>
    h.click({
      props: {
        onClick: h.nodes().find((node) => node.type === "lesson-proxy").props
          .onNext,
      },
    });
  enter(3, "academy-3-4");
  next();
  assert.equal(
    h.nodes().find((node) => node.type === "lesson-proxy").props.lesson.id,
    "academy-4-1",
  );
  h.click({
    props: {
      onClick: h.nodes().find((node) => node.type === "lesson-proxy").props
        .onOverview,
    },
  });
  assert.ok(
    h
      .nodes()
      .filter((node) => node.props?.["data-lesson-id"])
      .every((node) => node.props["data-lesson-id"].startsWith("academy-4-")),
  );
  h.click(h.byId("academy-chapters-back"));
  enter(6, "academy-6-4");
  next();
  assert.equal(
    h.nodes().filter((node) => node.props?.["data-lesson-id"]).length,
    4,
  );
  assert.deepEqual(h.completed, []);
});

test("Academy opening assistance cancels a captured drag and restores practice safely", () => {
  const h = mount("academy-3-4");
  const source = h.segment(academy.getAcademySolution(h.lesson).from);
  startDrag(h, source);
  h.click(h.byId("academy-hint"));
  assert.equal(source.element.captures.size, 0);
  assert.ok(!h.ghost());
  assert.ok(h.byId("academy-assistance"));
  assert.ok(
    !h.nodes().some((node) => node.props?.["data-testid"] === "academy-board"),
  );
  h.click(h.byId("academy-hint-close"));
  assert.ok(h.byId("academy-board"));
  assert.deepEqual(h.completed, []);
  clickSolution(h);
  assert.ok(h.success());
});

for (const phonePortrait of [false, true]) {
  for (const lesson of academy.academyLessons.filter(
    (item) =>
      item.mode !== "recognition" && academy.getAcademySolution(item)?.to,
  )) {
    test(`Academy ${lesson.id} snaps the ghost before release using target orientation (${phonePortrait ? "rotated" : "normal"})`, () => {
      const h = mount(lesson.id, { phonePortrait });
      const { from, to } = academy.getAcademySolution(lesson);
      const source = from ? h.segment(from) : h.byId("academy-reservoir");
      h.pointer(source, "Down", ...center(source));
      assert.ok(
        !h.ghost(),
        "pending pointer does not show a ghost before threshold",
      );
      const target = h.segment(to);
      const horizontal = target.props.className
        .split(" ")
        .includes("horizontal");
      const expected = phonePortrait
        ? horizontal
          ? "vertical"
          : "horizontal"
        : horizontal
          ? "horizontal"
          : "vertical";
      assert.equal(target.element.dataset.screenOrientation, expected);
      // A distorted target box must not change its semantic screen orientation.
      // This reproduces the operator-box failure without assuming correct CSS.
      const originalRect = target.element.getBoundingClientRect();
      target.element.getBoundingClientRect = () => ({
        ...originalRect,
        width: 40,
        height: 40,
        right: originalRect.left + 40,
        bottom: originalRect.top + 40,
      });
      const [x, y] = center(target);
      h.pointer(source, "Move", x, y);
      assert.ok(
        h.ghost().props.className.endsWith(expected),
        "hover orientation is correct BEFORE release",
      );
      assert.equal(h.ghost().props.style.left, x);
      assert.equal(h.ghost().props.style.top, y);
      assert.ok(!h.success());
      assert.deepEqual(h.completed, []);
      h.pointer(source, "Up", x, y);
      assert.ok(h.success());
      assert.ok(!h.ghost());
    });
  }
}

for (const lesson of academy.academyLessons.filter(
  (item) => item.mode !== "recognition",
)) {
  test(`Academy ${lesson.id} exposes exactly legal sources and selected-source outlines`, () => {
    const legal = (from, to) =>
      ["success", "wrong-target"].includes(
        academy.validateAcademyMove(lesson, { from, to }).reason,
      );
    const empty = academy.getAcademyEmptySegments(lesson.initial);
    const occupied = academy
      .getAcademyVisibleSegments(lesson.initial)
      .filter((point) => lesson.initial[point.position] !== "=");
    const initial = mount(lesson.id);
    for (const from of occupied) {
      const allowed =
        lesson.permitted.operation === "remove"
          ? legal(from, null)
          : empty.some((to) => legal(from, to));
      assert.equal(
        !initial.segment(from).props.disabled,
        allowed,
        `source ${JSON.stringify(from)}`,
      );
    }
    const sources =
      lesson.permitted.operation === "add"
        ? [null]
        : occupied.filter((from) =>
            lesson.permitted.operation === "remove"
              ? legal(from, null)
              : empty.some((to) => legal(from, to)),
          );
    for (const from of sources) {
      const h = mount(lesson.id);
      h.click(from ? h.segment(from) : h.byId("academy-reservoir"));
      const actual = h
        .nodes()
        .filter(
          (node) =>
            node.type === "button" &&
            node.props.className?.split(" ").includes("placeholder"),
        )
        .map((node) => ({
          position: node.props["data-position"],
          segment: node.props["data-segment"],
        }));
      const expected = empty.filter((to) => legal(from, to));
      assert.deepEqual(
        actual,
        expected,
        `drop set for ${JSON.stringify(from)}`,
      );
      for (const to of actual)
        assert.ok(!h.segment(to).props.disabled, "offered target is usable");
      assert.ok(
        !actual.some((point) => lesson.initial[point.position] === "="),
        "equals is locked",
      );
      assert.deepEqual(h.completed, []);
    }
  });
}

for (const phonePortrait of [false, true])
  for (const dragHand of ["left", "right"])
    for (const id of ["academy-5-2", "academy-2-1", "academy-2-2"]) {
      test(`Academy ${id} phone lens receives the stable rendered lesson-title anchor: ${phonePortrait}/${dragHand}`, () => {
        const h = mount(id, { isPhone: true, phonePortrait, dragHand });
        const title = h.nodes().find((node) => node.type === "h2");
        assert.ok(
          title?.element,
          "the visible lesson title owns a measurable DOM ref",
        );
        assert.deepEqual(
          title.element.getBoundingClientRect(),
          phonePortrait
            ? { left: 330, top: 270, width: 40, height: 300 }
            : { left: 270, top: 20, width: 300, height: 40 },
        );
        const source = currentSource(h);
        const [x, y] = center(source);
        h.pointer(source, "Down", x, y);
        assert.equal(h.lens().props.anchor, title.element);
        assert.notEqual(h.lens().props.anchor, source.element);
        assert.notEqual(h.lens().props.anchor, h.lens().props.surface);
        assert.deepEqual({ ...h.lens().props.point }, { x, y });
        for (const point of [
          { x: 2, y: 2 },
          { x: 2500, y: 1500 },
        ]) {
          h.pointer(currentSource(h), "Move", point.x, point.y);
          assert.equal(
            h.lens().props.anchor,
            title.element,
            "source or destination motion cannot replace the lesson-title anchor",
          );
          assert.deepEqual({ ...h.lens().props.point }, point);
          assert.equal(h.lens().props.stick.x, point.x);
          assert.equal(h.lens().props.stick.y, point.y);
          assert.equal(h.lens().props.stick.snapped, false);
          assertPressedArtwork(h, source);
        }
        h.pointer(currentSource(h), "Cancel", 2500, 1500);
        assert.ok(!h.lens());
        assertNoHiddenArtwork(h);
        assert.deepEqual(h.completed, []);
      });
    }

for (const phonePortrait of [false, true]) {
  for (const dragHand of ["left", "right"]) {
    test(`Academy phone touch drops under the finger with a magnifier (${phonePortrait ? "rotated" : "normal"}, ${dragHand})`, () => {
      const h = mount("academy-5-2", {
        isPhone: true,
        phonePortrait,
        dragHand,
      });
      const { from, to } = academy.getAcademySolution(h.lesson);
      const source = h.segment(from);
      h.pointer(source, "Down", ...center(source));
      assert.ok(!h.ghost());
      assert.ok(h.lens(), "phone touch renders its lens on pointerdown");
      assertPressedArtwork(h, source);
      assert.deepEqual(
        h.visibleSegments(),
        academy
          .getAcademyVisibleSegments(h.lesson.initial)
          .filter((point) => h.lesson.initial[point.position] !== "="),
      );
      assert.equal(h.lens().props.stick.snapped, false);
      const target = h.segment(to);
      const [x, y] = center(target);
      h.pointer(source, "Move", x, y);
      const lens = h.nodes().find((node) => node.type === "touch-magnifier");
      assert.ok(lens);
      assert.equal(lens.props.point.x, x);
      assert.equal(lens.props.point.y, y);
      assert.equal(lens.props.stick.x, x);
      assert.equal(lens.props.stick.y, y);
      assert.equal(
        lens.props.stick.orientation,
        phonePortrait ? "horizontal" : "vertical",
      );
      assert.equal(lens.props.stick.snapped, true);
      assert.ok(!h.ghost(), "phone touch never shows the old offset helper");
      assertPressedArtwork(h, source);
      h.pointer(source, "Up", x, y);
      assert.ok(h.success());
      assert.ok(!h.nodes().some((node) => node.type === "touch-magnifier"));
      assert.equal(source.element.captures.size, 0);
    });
  }
}

for (const id of ["academy-5-2", "academy-2-1"])
  for (const mode of ["pending", "active"])
    for (const interruption of [
      "pointercancel",
      "lostcapture",
      "blur",
      "resize",
      "orientationchange",
      "visibilitychange",
      "Escape",
      "help",
      "reset",
    ]) {
      test(`Academy ${id} ${mode} phone magnifier clears on ${interruption}`, () => {
        const h = mount(id, { isPhone: true });
        const { from } = academy.getAcademySolution(h.lesson);
        const source = from ? h.segment(from) : h.byId("academy-reservoir");
        const initial = h.visibleSegments();
        h.pointer(source, "Down", ...center(source));
        if (mode === "active") h.pointer(source, "Move", 900, 900);
        assert.ok(
          h.lens(),
          "pending and active phone gestures both show a lens",
        );
        assert.ok(!h.ghost());
        assertPressedArtwork(h, source);
        assert.deepEqual(h.visibleSegments(), initial);
        if (interruption === "pointercancel")
          h.pointer(source, "Cancel", 900, 900);
        else if (interruption === "lostcapture") h.lostCapture();
        else if (interruption === "visibilitychange")
          h.emit(interruption, { hidden: true }, true);
        else if (interruption === "Escape")
          h.emit("keydown", { key: "Escape" });
        else if (interruption === "help") h.click(h.byId("academy-hint"));
        else if (interruption === "reset") h.click(h.byId("academy-reset"));
        else h.emit(interruption);
        assert.ok(!h.lens());
        assertNoHiddenArtwork(h);
        assert.equal(source.element.captures.size, 0);
        assert.deepEqual(h.completed, []);
        // Stale captured handlers cannot restore an interrupted pending lens.
        h.pointer(source, "Move", 900, 900);
        h.pointer(source, "Up", 900, 900);
        assert.ok(!h.lens());
        assert.ok(!h.ghost());
        if (interruption === "help") h.click(h.byId("academy-hint-close"));
        assertSourceArtwork(currentSource(h), false);
        assertNoHiddenArtwork(h);
        assert.deepEqual(h.visibleSegments(), initial);
        clickSolution(h);
        assert.ok(h.success());
      });
    }

for (const id of ["academy-5-2", "academy-2-1", "academy-2-2"])
  for (const phonePortrait of [false, true])
    for (const belowThreshold of [false, true]) {
      test(`Academy ${id} touch press preserves two-tap solving (${phonePortrait}, small motion: ${belowThreshold})`, () => {
        const h = mount(id, { isPhone: true, phonePortrait });
        const { from, to } = academy.getAcademySolution(h.lesson);
        const source = () =>
          from ? h.segment(from) : h.byId("academy-reservoir");
        const initial = h.visibleSegments();
        const [x, y] = center(source());
        h.pointer(source(), "Down", x, y);
        assertPressedArtwork(h, source());
        assert.ok(h.lens(), "lens appears before any movement");
        assert.equal(h.lens().props.point.x, x);
        assert.equal(h.lens().props.point.y, y);
        assert.equal(h.lens().props.stick.x, x);
        assert.equal(h.lens().props.stick.y, y);
        assert.equal(h.lens().props.stick.snapped, false);
        assert.equal(
          h.lens().props.stick.orientation,
          from
            ? source().props["data-screen-orientation"]
            : phonePortrait
              ? "vertical"
              : "horizontal",
        );
        assert.ok(!source().props.className.split(" ").includes("selected"));
        assert.deepEqual(h.visibleSegments(), initial);
        assert.deepEqual(h.completed, []);
        assert.ok(!h.ghost());
        if (belowThreshold) {
          h.pointer(source(), "Move", x + 2, y + 2);
          assertPressedArtwork(h, source());
          assert.equal(h.lens().props.point.x, x + 2);
          assert.equal(h.lens().props.point.y, y + 2);
          assert.equal(h.lens().props.stick.snapped, false);
          assert.ok(!source().props.className.split(" ").includes("selected"));
          assert.deepEqual(h.visibleSegments(), initial);
          assert.deepEqual(h.completed, []);
        }
        h.pointer(source(), "Up", x, y);
        assertSourceArtwork(source(), false);
        assertNoHiddenArtwork(h);
        assert.ok(!h.lens());
        assert.equal(source().element.captures.size, 0);
        assert.deepEqual(h.visibleSegments(), initial);
        h.click(source(), 1); // The pointer's normal native click is still allowed.
        assert.ok(source().props.className.split(" ").includes("selected"));
        assert.ok(!h.success());

        const target = () => (to ? h.segment(to) : h.byId("academy-reservoir"));
        h.pointer(target(), "Down", ...center(target()));
        assert.ok(
          !h.lens(),
          "a destination tap does not create a draggable source",
        );
        h.pointer(target(), "Up", ...center(target()));
        h.click(target(), 1);
        assert.ok(h.success());
        assert.deepEqual(h.completed, [id]);
        assert.ok(!h.lens());
      });
    }

for (const id of ["academy-5-2", "academy-2-1"])
  for (const mode of ["pending", "active"]) {
    test(`Academy ${id} ${mode} phone touch ignores secondary pointer phases`, () => {
      const h = mount(id, { isPhone: true });
      const { from, to } = academy.getAcademySolution(h.lesson);
      const source = from ? h.segment(from) : h.byId("academy-reservoir");
      const initial = h.visibleSegments();
      h.pointer(source, "Down", ...center(source));
      if (mode === "active") h.pointer(source, "Move", 900, 900);
      const point = { ...h.lens().props.point };
      const stick = { ...h.lens().props.stick };
      for (const phase of ["Down", "Move", "Up", "Cancel"]) {
        h.pointer(source, phase, 1000, 1200, 99);
        assertPressedArtwork(h, source);
        assert.ok(h.lens(), `secondary ${phase} must not dismiss the lens`);
        assert.deepEqual({ ...h.lens().props.point }, point);
        assert.deepEqual({ ...h.lens().props.stick }, stick);
        assert.ok(source.element.captures.has(7));
        assert.ok(!source.element.captures.has(99));
        assert.deepEqual(h.visibleSegments(), initial);
        assert.deepEqual(h.completed, []);
      }
      h.lostCapture(99);
      assert.ok(h.lens(), "secondary lostcapture must not dismiss the lens");
      assertPressedArtwork(h, source);
      assert.deepEqual({ ...h.lens().props.point }, point);
      const target = h.segment(to);
      h.pointer(source, "Move", ...center(target));
      h.pointer(source, "Up", ...center(target));
      assert.ok(h.success(), "the original pointer still owns the move");
      assertSourceArtwork(h.segment(to), false);
      assertNoHiddenArtwork(h);
      assert.ok(!h.lens());
      assert.equal(source.element.captures.size, 0);
    });

    test(`Academy ${id} ${mode} phone touch release outside does not commit`, () => {
      const h = mount(id, { isPhone: true });
      const { from } = academy.getAcademySolution(h.lesson);
      const source = from ? h.segment(from) : h.byId("academy-reservoir");
      const initial = h.visibleSegments();
      h.pointer(source, "Down", ...center(source));
      if (mode === "active") h.pointer(source, "Move", 900, 900);
      h.pointer(source, "Up", -1000, -1000);
      assertSourceArtwork(currentSource(h), false);
      assertNoHiddenArtwork(h);
      assert.ok(!h.lens());
      assert.ok(!h.ghost());
      assert.equal(source.element.captures.size, 0);
      assert.deepEqual(h.visibleSegments(), initial);
      assert.deepEqual(h.completed, []);
      clickSolution(h);
      assert.ok(h.success());
    });

    test(`Academy ${id} ${mode} touch unmount releases the press capture`, () => {
      const h = mount(id, { isPhone: true });
      const { from } = academy.getAcademySolution(h.lesson);
      const source = from ? h.segment(from) : h.byId("academy-reservoir");
      h.pointer(source, "Down", ...center(source));
      if (mode === "active") h.pointer(source, "Move", 900, 900);
      assert.ok(h.lens());
      h.unmount();
      assert.equal(source.element.captures.size, 0);
      assert.equal(h.listenerCount(), 0);
    });
  }

test("Academy phone mouse press has no lens and keeps the threshold helper", () => {
  const h = mount("academy-5-2", { isPhone: true });
  const source = h.segment(academy.getAcademySolution(h.lesson).from);
  const [x, y] = center(source);
  const mouse = { pointerType: "mouse" };
  h.pointer(source, "Down", x, y, 7, mouse);
  assertSourceArtwork(currentSource(h), false);
  assert.ok(!h.lens());
  assert.ok(!h.ghost());
  h.pointer(source, "Move", x + 2, y + 2, 7, mouse);
  assert.ok(!h.lens());
  assert.ok(!h.ghost());
  h.pointer(source, "Move", 900, 900, 7, mouse);
  assertSourceArtwork(currentSource(h), false);
  assert.ok(!h.lens());
  assert.ok(h.ghost());
  h.pointer(source, "Cancel", 900, 900, 7, mouse);
  assert.ok(!h.ghost());
});

for (const id of ["academy-5-2", "academy-2-1", "academy-2-2"]) {
  test(`Academy ${id} repeat touch tap deselects exactly once after the press lens closes`, () => {
    const h = mount(id, { isPhone: true });
    const { from } = academy.getAcademySolution(h.lesson);
    const source = () => (from ? h.segment(from) : h.byId("academy-reservoir"));
    h.click(source());
    assert.ok(source().props.className.split(" ").includes("selected"));
    h.pointer(source(), "Down", ...center(source()));
    assertPressedArtwork(h, source());
    assert.ok(h.lens());
    assert.ok(
      source().props.className.split(" ").includes("selected"),
      "press preserves prior selection",
    );
    h.pointer(source(), "Up", ...center(source()));
    assertSourceArtwork(source(), false);
    assertNoHiddenArtwork(h);
    assert.ok(!h.lens());
    assert.ok(
      source().props.className.split(" ").includes("selected"),
      "release is not a synthetic selection change",
    );
    h.click(source(), 1);
    assert.ok(
      !source().props.className.split(" ").includes("selected"),
      "normal click toggles selection exactly once",
    );
    assert.deepEqual(h.completed, []);
    clickSolution(h);
    assert.ok(h.success());
  });

  test(`Academy ${id} release over its legal destination without motion never commits`, () => {
    const h = mount(id, { isPhone: true });
    const { from, to } = academy.getAcademySolution(h.lesson);
    const initial = h.visibleSegments();
    const source = from ? h.segment(from) : h.byId("academy-reservoir");
    h.pointer(source, "Down", ...center(source));
    const target = to ? h.segment(to) : h.byId("academy-reservoir");
    h.pointer(source, "Up", ...center(target));
    assertSourceArtwork(currentSource(h), false);
    assertNoHiddenArtwork(h);
    assert.ok(!h.lens());
    assert.equal(source.element.captures.size, 0);
    assert.deepEqual(h.visibleSegments(), initial);
    assert.deepEqual(h.completed, []);
    assert.ok(!h.success());
  });
}

for (const language of ["en", "zh"]) {
  test(`Academy full 24-lesson handler journey persists completion and reopens (${language})`, () => {
    const {
      emptyAcademyProgress,
      loadAcademy,
      saveAcademy,
    } = require("../.test-out/lib/academyStorage.js");
    const values = new Map([
      [
        "imatchstick-pwa-stats",
        JSON.stringify({ solved: 12, streak: 3, bypassed: 4 }),
      ],
    ]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    let progress = { ...emptyAcademyProgress(), welcomed: true };
    const props = {
      fullFlow: true,
      language,
      completedLessonIds: progress.completedLessonIds,
      onComplete(id) {
        progress = {
          ...progress,
          completedLessonIds: [
            ...new Set([...progress.completedLessonIds, id]),
          ],
        };
        props.completedLessonIds = progress.completedLessonIds;
        saveAcademy(storage, progress);
      },
    };
    const h = mount("academy-1-1", props);
    h.click(h.nodes().find((node) => node.props?.["data-chapter-id"] === 1));
    h.click(
      h
        .nodes()
        .find((node) => node.props?.["data-lesson-id"] === "academy-1-1"),
    );
    for (const lesson of academy.academyLessons) {
      h.click(h.byId("academy-hint"));
      assert.ok(h.byId("academy-assistance"));
      h.click(h.byId("academy-hint-close"));
      const solve = () => {
        if (lesson.mode === "recognition")
          h.click(
            h
              .nodes()
              .find((node) => node.props?.["data-choice"] === lesson.target[0]),
          );
        else {
          const { from, to } = academy.getAcademySolution(lesson);
          h.click(from ? h.segment(from) : h.byId("academy-reservoir"));
          h.click(to ? h.segment(to) : h.byId("academy-reservoir"));
        }
      };
      if (lesson.mode === "recognition") {
        h.click(
          h
            .nodes()
            .find(
              (node) =>
                node.props?.["data-choice"] ===
                lesson.choices.find((choice) => choice !== lesson.target[0]),
            ),
        );
        assert.ok(!h.success());
      }
      solve();
      assert.ok(h.success(), lesson.id);
      h.click(h.byId("academy-reset"));
      assert.ok(!h.success());
      solve();
      assert.equal(
        progress.completedLessonIds.filter((id) => id === lesson.id).length,
        1,
      );
      h.click(h.byId("academy-next"));
    }
    h.click(h.byId("academy-chapters-back"));
    const intro = h
      .nodes()
      .find((node) => node.props?.className === "academy-intro");
    assert.equal(
      intro.props.children,
      `${academyCopy[language].allDone} ${academyCopy[language].allDoneNote}`,
    );
    assert.equal(
      h.nodes().find((node) => node.props?.role === "progressbar").props[
        "aria-valuenow"
      ],
      24,
    );
    h.unmount();
    const loaded = loadAcademy(
      storage,
      academy.academyLessons.map((lesson) => lesson.id),
    );
    assert.equal(loaded.showWelcome, false);
    assert.equal(loaded.progress.completedLessonIds.length, 24);
    const reopened = mount("academy-1-1", {
      overviewOnly: true,
      language,
      completedLessonIds: loaded.progress.completedLessonIds,
    });
    assert.equal(
      reopened.nodes().find((node) => node.props?.className === "academy-intro")
        .props.children,
      `${academyCopy[language].allDone} ${academyCopy[language].allDoneNote}`,
    );
    assert.equal(
      values.get("imatchstick-pwa-stats"),
      JSON.stringify({ solved: 12, streak: 3, bypassed: 4 }),
    );
  });
}

for (const id of ["academy-2-1", "academy-2-2", "academy-3-4"])
  for (const phonePortrait of [false, true]) {
    test(`Academy ${id} phone source artwork transfers only on a valid drop (${phonePortrait})`, () => {
      const h = mount(id, { isPhone: true, phonePortrait });
      const { from, to } = academy.getAcademySolution(h.lesson);
      const source = currentSource(h);
      const initial = h.visibleSegments();
      assertSourceArtwork(source, false);
      h.pointer(source, "Down", ...center(source));
      assertPressedArtwork(h, source);
      assert.equal(currentSource(h).props.className, source.props.className);
      assert.deepEqual(
        h.visibleSegments(),
        initial,
        "press is presentation-only",
      );
      const target = to ? h.segment(to) : h.byId("academy-reservoir");
      h.pointer(source, "Move", ...center(target));
      assertPressedArtwork(h, source);
      assert.ok(h.lens(), "carried-match presentation remains available");
      assert.deepEqual(
        h.visibleSegments(),
        initial,
        "drag cannot commit early",
      );
      h.pointer(source, "Up", ...center(target));
      assert.ok(h.success());
      assertNoHiddenArtwork(h);
      assertSourceArtwork(
        to ? h.segment(to) : h.byId("academy-reservoir"),
        false,
      );
      if (!from)
        assert.equal(
          matchArtwork(h.byId("academy-reservoir")).length,
          0,
          "used reservoir match is removed only after success",
        );
      assert.equal(source.element.captures.size, 0);
      assert.ok(!h.lens());
      assert.deepEqual(h.completed, [id]);
      h.click(h.byId("academy-reset"));
      assertSourceArtwork(currentSource(h), false);
      assertNoHiddenArtwork(h);
      assert.deepEqual(h.visibleSegments(), initial);
    });
  }

test("Academy wrong-but-valid phone drop restores the add-reservoir artwork", () => {
  const h = mount("academy-2-3", { isPhone: true });
  const source = currentSource(h);
  const initial = h.visibleSegments();
  h.pointer(source, "Down", ...center(source));
  assertPressedArtwork(h, source);
  const wrongTarget = h.segment({ position: 0, segment: 2 });
  h.pointer(source, "Move", ...center(wrongTarget));
  assertPressedArtwork(h, source);
  assert.ok(h.lens().props.stick.snapped);
  h.pointer(source, "Up", ...center(wrongTarget));
  assert.equal(h.status(), academyCopy.en.feedback["wrong-target"]);
  assertSourceArtwork(currentSource(h), false);
  assertNoHiddenArtwork(h);
  assert.deepEqual(h.visibleSegments(), initial);
  assert.deepEqual(h.completed, []);
  assert.equal(source.element.captures.size, 0);
});

test("Academy locked sources and solved destinations never hide their artwork", () => {
  const h = mount("academy-6-1", { isPhone: true });
  const locked = h.segment({ position: 0, segment: 5 });
  assert.ok(locked.props.disabled);
  h.pointer(locked, "Down", ...center(locked));
  assertSourceArtwork(h.segment({ position: 0, segment: 5 }), false);
  assertNoHiddenArtwork(h);
  assert.ok(!h.lens());
  assert.equal(locked.element.captures.size, 0);
  clickSolution(h);
  const { to } = academy.getAcademySolution(h.lesson);
  const solved = h.segment(to);
  assert.ok(solved.props.disabled);
  h.pointer(solved, "Down", ...center(solved));
  assertSourceArtwork(h.segment(to), false);
  assertNoHiddenArtwork(h);
  assert.ok(!h.lens());
  assert.equal(solved.element.captures.size, 0);
});

function previewReversed(h) {
  if (h.lens()) return h.lens().props.stick.reversed;
  const artwork = matchArtwork(h.ghost());
  assert.equal(artwork.length, 1, "helper carries one matchstick");
  return artwork[0].props["data-reversed"];
}
function placedReversed(h, to) {
  const artwork = matchArtwork(
    to ? h.segment(to) : h.byId("academy-reservoir"),
  );
  assert.equal(artwork.length, 1, "placed matchstick artwork exists");
  return artwork[0].props["data-reversed"];
}

for (const phonePortrait of [false, true]) {
  for (const isPhone of [false, true]) {
    for (const id of ["academy-2-1", "academy-2-2", "academy-3-1"]) {
      test(`Academy ${id} retains same-axis head without randomness (${phonePortrait}, ${isPhone})`, () => {
        const h = mount(id, { phonePortrait, isPhone });
        const { from, to } = academy.getAcademySolution(h.lesson);
        const source = currentSource(h);
        const destination = to ? h.segment(to) : h.byId("academy-reservoir");
        const logicalHorizontal =
          !from || source.props.className.split(" ").includes("horizontal");
        h.pointer(source, "Down", ...center(source));
        h.pointer(source, "Move", ...center(destination));
        assert.equal(previewReversed(h), phonePortrait && logicalHorizontal);
        assert.equal(h.randomCalls(), 0, "same-axis preview never rolls");
        h.pointer(source, "Up", ...center(destination));
        assert.ok(h.success());
        assert.equal(placedReversed(h, to), false);
        assert.equal(h.randomCalls(), 0, "same-axis drop never rolls");
      });
    }
    for (const id of [
      "academy-2-3",
      "academy-2-4",
      "academy-3-4",
      "academy-4-1",
    ]) {
      for (const random of [0.25, 0.75]) {
        test(`Academy ${id} quarter-turn preview, reentry, drop and replay retain one choice (${phonePortrait}, ${isPhone}, ${random})`, () => {
          const h = mount(id, { phonePortrait, isPhone, random: () => random });
          const { to } = academy.getAcademySolution(h.lesson);
          const source = currentSource(h);
          h.pointer(source, "Down", ...center(source));
          const destination = to ? h.segment(to) : h.byId("academy-reservoir");
          const logicalHorizontal =
            !to ||
            destination.props.className.split(" ").includes("horizontal");
          const expectedLogical = random < 0.5;
          const expectedScreen =
            expectedLogical !== (phonePortrait && logicalHorizontal);
          h.pointer(source, "Move", ...center(destination));
          assert.equal(previewReversed(h), expectedScreen);
          assert.equal(
            h.randomCalls(),
            1,
            "first axis-switch candidate chooses once",
          );
          h.pointer(source, "Move", ...center(destination));
          h.pointer(source, "Move", 1400, 900);
          assert.equal(
            previewReversed(h),
            expectedScreen,
            "free dragging keeps the preview head",
          );
          h.pointer(source, "Move", ...center(destination));
          assert.equal(
            previewReversed(h),
            expectedScreen,
            "candidate reentry keeps the choice",
          );
          assert.equal(h.randomCalls(), 1, "moves and reentry never reroll");
          h.pointer(source, "Up", ...center(destination));
          assert.ok(h.success());
          assert.equal(
            placedReversed(h, to),
            expectedLogical,
            "drop persists preview direction in board coordinates",
          );
          assert.equal(h.randomCalls(), 1, "drop never rerolls");
          h.click(h.byId("academy-reset"));
          assert.equal(
            placedReversed(h, academy.getAcademySolution(h.lesson).from),
            false,
            "replay restores initial head direction",
          );
          const replaySource = currentSource(h);
          h.pointer(replaySource, "Down", ...center(replaySource));
          const replayDestination = to
            ? h.segment(to)
            : h.byId("academy-reservoir");
          h.pointer(replaySource, "Move", ...center(replayDestination));
          assert.equal(h.randomCalls(), 2, "a new drag chooses independently");
          h.pointer(replaySource, "Cancel", ...center(replayDestination));
        });
      }
    }
  }
}

for (const id of [
  "academy-2-1",
  "academy-2-2",
  "academy-2-3",
  "academy-2-4",
  "academy-3-1",
  "academy-3-4",
]) {
  for (const phonePortrait of [false, true]) {
    test(`Academy ${id} click placement uses logical axes and saves the head (${phonePortrait})`, () => {
      const h = mount(id, { phonePortrait, random: () => 0.25 });
      const { to } = academy.getAcademySolution(h.lesson);
      const changesAxis = [
        "academy-2-3",
        "academy-2-4",
        "academy-3-4",
      ].includes(id);
      clickSolution(h);
      assert.ok(h.success());
      assert.equal(placedReversed(h, to), changesAxis);
      assert.equal(h.randomCalls(), changesAxis ? 1 : 0);
    });
  }
}

test("Academy caches separate axis-switch candidates and commits the previewed target", () => {
  const choices = [0.25, 0.75];
  const h = mount("academy-2-3", {
    isPhone: true,
    random: () => choices.shift(),
  });
  const source = currentSource(h);
  h.pointer(source, "Down", ...center(source));
  const wrong = h.segment({ position: 0, segment: 2 });
  const right = h.segment(academy.getAcademySolution(h.lesson).to);
  h.pointer(source, "Move", ...center(wrong));
  assert.equal(previewReversed(h), true);
  h.pointer(source, "Move", ...center(right));
  assert.equal(previewReversed(h), false);
  h.pointer(source, "Move", ...center(wrong));
  assert.equal(previewReversed(h), true);
  h.pointer(source, "Move", ...center(right));
  assert.equal(previewReversed(h), false);
  assert.equal(h.randomCalls(), 2);
  h.pointer(source, "Up", ...center(right));
  assert.ok(h.success());
  assert.equal(
    placedReversed(h, academy.getAcademySolution(h.lesson).to),
    false,
  );
  assert.equal(h.randomCalls(), 2);
});
