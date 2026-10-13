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
// Academy validation, MatchstickChar rendering, and drag math are production code.
function mount(id, overrides = {}) {
  const lesson = academy.academyLessons.find((item) => item.id === id);
  assert.ok(lesson, id);
  const slots = [];
  let cursor = 0;
  let tree;
  let pendingEffects = [];
  let mounted = true;
  const cleanups = [];
  const elements = new Map();
  const completed = [];
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
    if (typeof type === "function") return type(props);
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
              !walk(this.props.children).some((child) => child.type === "art")
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
      };
      if (props.ref) props.ref.current = node.element;
    }
    return node;
  }
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (value) => {
          assert.ok(mounted, "no state updates after unmount");
          slots[index] =
            typeof value === "function" ? value(slots[index]) : value;
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
        document,
        window: eventTarget(windowListeners),
        require(name) {
          if (name === "react") return react;
          if (name === "react/jsx-runtime")
            return { jsx, jsxs: jsx, Fragment: "fragment" };
          if (name === "react-dom") return { createPortal: (child) => child };
          if (name === "../../lib/academy") return academy;
          if (name === "../../lib/matchstick") return matchstick;
          if (name === "../../lib/drag") return load("lib/drag.ts");
          if (name === "./academyCopy")
            return load("components/matchstick/academyCopy.ts");
          if (name === "./MatchstickChar")
            return load("components/matchstick/MatchstickChar.tsx");
          if (name === "./MatchstickArt")
            return { MatchstickArt: (props) => jsx("art", props) };
          if (name === "./SuccessConfetti")
            return { SuccessConfetti: () => jsx("confetti") };
          throw new Error(`Unexpected import: ${name}`);
        },
      },
      { filename: file },
    );
    return exports;
  }
  const { AcademyLessonView } = load("components/matchstick/Academy.tsx");
  function render() {
    cursor = 0;
    tree = AcademyLessonView({
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
    tree.props.onClickCapture({ detail });
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
    nodes,
    byId,
    segment,
    click,
    pointer,
    next: () => next,
    overview: () => overview,
    status: () => find((node) => node.props?.role === "status").props.children,
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
  h.pointer(source, "Move", 900, 900);
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

test("Academy invalid shape keeps the starting board, explains failure, and permits retry", () => {
  const h = mount("academy-3-1");
  h.click(h.segment({ position: 0, segment: 1 }));
  h.click(h.segment({ position: 0, segment: 0 }));
  assert.ok(!h.success());
  assert.deepEqual(h.completed, []);
  assert.match(h.status(), /shape|digit|sign/i);
  assert.ok(
    h.segment({ position: 0, segment: 1 }).props.className.includes("visible"),
  );
  clickSolution(h);
  assert.ok(h.success());
});

test("Academy reset, undo, hint, demonstration, next, and overview use real callbacks", () => {
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
  h.click(h.byId("academy-undo"));
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

test("Academy forbidden card movement explains restriction and never completes the equation", () => {
  const h = mount("academy-6-1"); // Only final 2 is editable; try first 2.
  h.click(h.segment({ position: 0, segment: 5 }));
  h.click(h.segment({ position: 0, segment: 3 }));
  assert.equal(h.status(), academyCopy.en.feedback["not-allowed"]);
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
  h.click(guidanceButton(academyCopy.en.hints[0]));
  const target = h.segment(academy.getAcademySolution(h.lesson).to);
  assert.ok(
    target.props.disabled,
    "outlined target still requires source selection",
  );
  h.click(guidanceButton(academyCopy.en.hints[1]));
  assert.ok(
    h.nodes().some((node) => node.props?.className === "academy-hint-card"),
  );
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
