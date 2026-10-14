import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const geometry = require("../.test-out/lib/magnifier.js");

// Execute the production component/effects with modeled hooks and DOM geometry.
// This checks gesture lifecycle, not native browser layout or pointer handling.
function mount({ portrait = false, safeArea = {} } = {}) {
  const slots = [],
    effects = [],
    listeners = new Map();
  let cursor = 0,
    dirty = false,
    tree,
    anchorReads = 0;
  const view = {
    width: portrait ? 390 : 844,
    height: portrait ? 844 : 390,
    offsetLeft: 0,
    offsetTop: 0,
  };
  let anchorBounds = portrait
    ? { left: 358, top: 300, width: 18, height: 100 }
    : { left: 650, top: 14, width: 100, height: 18 };
  const anchor = {
    getBoundingClientRect() {
      anchorReads++;
      return { ...anchorBounds };
    },
  };
  const makeNode = () => ({
    attributes: [],
    tagName: "DIV",
    style: { setProperty() {} },
    querySelectorAll: () => [],
    setAttribute() {},
    cloneNode: makeNode,
  });
  const surface = {
    ...makeNode(),
    getBoundingClientRect: () =>
      portrait
        ? { left: 150, top: 100, width: 100, height: 300 }
        : { left: 100, top: 140, width: 300, height: 100 },
  };
  const scene = {
    firstElementChild: null,
    replaceChildren(...children) {
      this.firstElementChild = children[0] ?? null;
    },
  };
  const events = (prefix) => ({
    addEventListener(name, callback) {
      listeners.set(`${prefix}:${name}`, callback);
    },
    removeEventListener(name) {
      listeners.delete(`${prefix}:${name}`);
    },
  });
  Object.assign(view, events("viewport"));
  const react = {
    useRef(value) {
      const index = cursor++;
      return (slots[index] ??= { current: value });
    },
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [
        slots[index],
        (next) => {
          const value = typeof next === "function" ? next(slots[index]) : next;
          if (!Object.is(value, slots[index])) {
            slots[index] = value;
            dirty = true;
          }
        },
      ];
    },
    useLayoutEffect(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (
        !previous ||
        dependencies.some(
          (value, i) => !Object.is(value, previous.dependencies[i]),
        )
      ) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: callback() };
        });
      }
    },
  };
  const jsx = (type, props = {}) => {
    if (props.ref) props.ref.current = scene;
    return { type, props };
  };
  const exports = {};
  const Observer = class {
    observe() {}
    disconnect() {}
  };
  vm.runInNewContext(
    readFileSync(".test-out/components/matchstick/TouchMagnifier.js", "utf8"),
    {
      exports,
      require: (id) => {
        if (id === "react") return react;
        if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
        if (id === "react-dom") return { createPortal: (node) => node };
        if (id === "../../lib/magnifier") return geometry;
        if (id === "./MatchstickArt") return { MatchstickArt() {} };
        throw new Error(`Unexpected module: ${id}`);
      },
      window: {
        ...events("window"),
        visualViewport: view,
        getComputedStyle: () => ({
          length: 0,
          width: "300px",
          height: "100px",
          boxSizing: "border-box",
          getPropertyValue: (name) =>
            `${safeArea[name.replace("--magnifier-safe-", "")] ?? 0}px`,
        }),
      },
      document: { documentElement: {}, body: {} },
      MutationObserver: Observer,
      ResizeObserver: Observer,
      requestAnimationFrame: () => 1,
      cancelAnimationFrame() {},
    },
  );
  let props = {
    surface,
    anchor,
    point: { x: 180, y: 210 },
    rotatedClockwise: portrait,
    stick: { x: 180, y: 210, orientation: "horizontal" },
  };
  const render = () => {
    let remaining = 10;
    do {
      assert.ok(remaining--, "effects must settle");
      dirty = false;
      cursor = 0;
      tree = exports.TouchMagnifier(props);
      while (effects.length) effects.shift()();
    } while (dirty);
    return tree;
  };
  render();
  return {
    get placement() {
      return { ...tree.props.style };
    },
    get anchorReads() {
      return anchorReads;
    },
    get matrix() {
      return scene.firstElementChild.style.transform
        .slice("matrix(".length, -1)
        .split(",")
        .map(Number);
    },
    get stick() {
      return { ...tree.props.children[1].props.style };
    },
    move(point) {
      props = { ...props, point, stick: { ...props.stick, ...point } };
      render();
    },
    snap(point) {
      props = { ...props, stick: { ...props.stick, ...point, snapped: true } };
      render();
    },
    reflowTitle(bounds) {
      anchorBounds = bounds;
      render();
    },
    resize(width, height) {
      Object.assign(view, { width, height });
      listeners.get("viewport:resize")();
      render();
    },
    pan(left, top) {
      Object.assign(view, { offsetLeft: left, offsetTop: top });
      listeners.get("viewport:scroll")();
      render();
    },
    unmount() {
      for (const slot of slots) slot?.cleanup?.();
      assert.equal(listeners.size, 0);
      assert.equal(scene.firstElementChild, null);
    },
  };
}

for (const portrait of [false, true]) {
  const orientation = portrait ? "portrait" : "landscape";
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  test(`title height survives caption reflow while logical horizontal position follows the finger (${orientation})`, () => {
    const lens = mount({ portrait });
    const initial = lens.placement;
    assert.deepEqual(initial, {
      left: portrait ? 262 : 120,
      top: portrait ? 150 : 8,
      width: 120,
      height: 120,
    });
    assert.equal(lens.anchorReads, 1);
    // Model caption expiry and status-text changes within the same persistent
    // header. Neither that reflow nor subsequent pointer renders may re-anchor
    // logical height, but horizontal pointer movement still moves the frame.
    lens.reflowTitle({ left: 10, top: 300, width: 40, height: 40 });
    assert.deepEqual(lens.placement, initial);
    for (const point of [
      { x: 250, y: 310 },
      { x: 2, y: 2 },
      { x: 1000, y: 1000 },
      { x: 350, y: 380 },
    ]) {
      lens.move(point);
      assert.deepEqual(lens.placement, {
        ...initial,
        left: portrait ? initial.left : clamp(point.x - 60, 8, 716),
        top: portrait ? clamp(point.y - 60, 8, 716) : initial.top,
      });
      assert.equal(lens.anchorReads, 1);
    }
    // A viewport change reclamps the held rectangle, never the reflowed header.
    lens.resize(300, 390);
    assert.deepEqual(lens.placement, {
      ...initial,
      left: 172,
      top: portrait ? 262 : 8,
    });
    assert.equal(lens.anchorReads, 1);
    lens.unmount();
  });

  test(`logical vertical motion changes sampled contents but keeps the lens frame fixed (${orientation})`, () => {
    const lens = mount({ portrait });
    const initial = lens.placement;
    const matrix = lens.matrix;
    const point = portrait ? { x: 280, y: 210 } : { x: 180, y: 310 };
    lens.move(point);
    assert.deepEqual(lens.placement, initial);
    assert.deepEqual(lens.matrix.slice(0, 4), matrix.slice(0, 4));
    assert.equal(lens.matrix[4] - matrix[4], (180 - point.x) * 1.6);
    assert.equal(lens.matrix[5] - matrix[5], (210 - point.y) * 1.6);
    assert.equal(lens.anchorReads, 1);
    lens.unmount();
  });

  test(`snapping only affects the carried stick; frame and sample use raw finger coordinates (${orientation})`, () => {
    const lens = mount({ portrait });
    const point = { x: 250, y: 310 };
    lens.move(point);
    const initial = lens.placement;
    const matrix = lens.matrix;
    assert.equal(lens.stick.left, 60);
    assert.equal(lens.stick.top, 60);
    lens.snap({ x: point.x + 10, y: point.y - 20 });
    assert.deepEqual(lens.placement, initial);
    assert.deepEqual(lens.matrix, matrix);
    assert.equal(lens.stick.left, 76);
    assert.equal(lens.stick.top, 28);
    lens.unmount();
  });

  test(`both lens axes stay within safe areas and the panned visual viewport (${orientation})`, () => {
    const safeArea = { top: 47, right: 19, bottom: 34, left: 21 };
    const lens = mount({ portrait, safeArea });
    lens.pan(30, 40);
    const width = portrait ? 390 : 844;
    const height = portrait ? 844 : 390;
    for (const point of [
      { x: -100, y: -100 },
      { x: 1000, y: 1000 },
    ]) {
      lens.move(point);
      const frame = lens.placement;
      assert.ok(frame.left >= 30 + safeArea.left + 8);
      assert.ok(frame.top >= 40 + safeArea.top + 8);
      assert.ok(frame.left + frame.width <= 30 + width - safeArea.right - 8);
      assert.ok(frame.top + frame.height <= 40 + height - safeArea.bottom - 8);
    }
    assert.equal(lens.anchorReads, 1);
    lens.unmount();
  });
}
