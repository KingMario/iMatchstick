import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const geometry = require("../.test-out/lib/magnifier.js");

// Execute the production component/effects with modeled hooks and DOM geometry.
// This checks gesture lifecycle, not native browser layout or pointer handling.
function mount({ portrait = false } = {}) {
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
    getBoundingClientRect: () => ({
      left: 100,
      top: 140,
      width: 300,
      height: 100,
    }),
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
          getPropertyValue: () => "0px",
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
    move(point) {
      props = { ...props, point, stick: { ...props.stick, ...point } };
      render();
    },
    reflowTitle(bounds) {
      anchorBounds = bounds;
    },
    resize(width, height) {
      Object.assign(view, { width, height });
      listeners.get("viewport:resize")();
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
  test(`one title-area position survives caption reflow and finger movement (${portrait ? "portrait" : "landscape"})`, () => {
    const lens = mount({ portrait });
    const initial = lens.placement;
    assert.equal(lens.anchorReads, 1);
    // Model caption expiry and status-text changes within the same persistent
    // header. Neither that reflow nor subsequent pointer renders may re-anchor.
    lens.reflowTitle({ left: 10, top: 300, width: 40, height: 40 });
    for (const point of [
      { x: 2, y: 2 },
      { x: 350, y: 380 },
    ]) {
      lens.move(point);
      assert.deepEqual(lens.placement, initial);
      assert.equal(lens.anchorReads, 1);
    }
    // A viewport change reclamps the held rectangle, never the reflowed header.
    lens.resize(300, 390);
    assert.ok(lens.placement.left + lens.placement.width <= 292);
    assert.ok(lens.placement.top + lens.placement.height <= 382);
    assert.equal(lens.anchorReads, 1);
    lens.unmount();
  });
}
