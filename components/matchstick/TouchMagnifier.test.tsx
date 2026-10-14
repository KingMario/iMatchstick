import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { copyMagnifierSurface, TouchMagnifier } from "./TouchMagnifier";

/** Lightweight DOM doubles exercise copying without starting a browser. */
class DecorativeNode {
  tagName: string;
  attributes: { name: string; value: string }[];
  children: DecorativeNode[];
  styles = new Map<string, string>();
  style: Record<string, unknown> & {
    setProperty: (name: string, value: string) => void;
  };
  constructor(
    tagName: string,
    attrs: Record<string, string>,
    children: DecorativeNode[] = [],
  ) {
    this.tagName = tagName;
    this.attributes = Object.entries(attrs).map(([name, value]) => ({
      name,
      value,
    }));
    this.children = children;
    this.style = {
      setProperty: (name, value) => {
        this.styles.set(name, value);
      },
    };
  }
  cloneNode(): DecorativeNode {
    return new DecorativeNode(
      this.tagName,
      Object.fromEntries(
        this.attributes.map(({ name, value }) => [name, value]),
      ),
      this.children.map((child) => child.cloneNode()),
    );
  }
  querySelectorAll(): DecorativeNode[] {
    return this.children.flatMap((child) => [
      child,
      ...child.querySelectorAll(),
    ]);
  }
  removeAttribute(name: string) {
    this.attributes = this.attributes.filter(
      (attribute) => attribute.name !== name,
    );
  }
  setAttribute(name: string, value: string) {
    this.removeAttribute(name);
    this.attributes.push({ name, value });
  }
  hasAttribute(name: string) {
    return this.attributes.some((attribute) => attribute.name === name);
  }
}

test("surface snapshot retains actual computed geometry but cannot become a snap target or control", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values: Record<string, string> = {
    width: "72px",
    height: "20.4px",
    "background-image": 'url("/matchsticks/empty_h.png")',
    opacity: "0.25",
    transform: "matrix(1, 0, 0, 1, -36, 0)",
  };
  const properties = Object.keys(values);
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      getComputedStyle: () => ({
        ...properties,
        length: properties.length,
        getPropertyValue: (name: string) => values[name],
      }),
    },
  });
  try {
    const button = new DecorativeNode(
      "BUTTON",
      {
        id: "original",
        class: "match-segment placeholder selected",
        "data-position": "2",
        "data-segment": "6",
        "aria-label": "Stick",
        onclick: "handler()",
        type: "button",
      },
      [new DecorativeNode("svg", { viewBox: "0 0 240 68" })],
    );
    const source = new DecorativeNode(
      "DIV",
      { id: "board", class: "equation" },
      [button],
    );
    const copy = copyMagnifierSurface(
      source as unknown as HTMLElement,
    ) as unknown as DecorativeNode;
    assert.ok(copy.hasAttribute("inert"));
    assert.ok(copy.hasAttribute("aria-hidden"));
    assert.equal(copy.style.transform, "none");
    const copiedButton = copy.children[0];
    for (const attribute of [
      "id",
      "class",
      "data-position",
      "data-segment",
      "onclick",
      "aria-label",
    ])
      assert.equal(copiedButton.hasAttribute(attribute), false);
    assert.ok(copiedButton.hasAttribute("disabled"));
    assert.deepEqual(
      copiedButton.styles.get("background-image"),
      values["background-image"],
    );
    assert.equal(copiedButton.styles.get("width"), "72px");
    assert.equal(copiedButton.styles.get("opacity"), "0.25");
    assert.equal(copiedButton.styles.get("transform"), values.transform);
    assert.equal(copiedButton.styles.get("pointer-events"), "none");
    assert.equal(copiedButton.styles.get("animation"), "none");
    assert.ok(copiedButton.children[0].hasAttribute("viewBox"));
    assert.ok(button.hasAttribute("class"), "live board stays unchanged");
    assert.equal(button.hasAttribute("disabled"), false);
  } finally {
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("magnifier has no server-rendered interactive copy or document dependency", () => {
  assert.equal(
    renderToStaticMarkup(
      <TouchMagnifier
        surface={null}
        anchor={null}
        point={{ x: 0, y: 0 }}
        rotatedClockwise
        stick={{ x: 0, y: 0, orientation: "horizontal" }}
      />,
    ),
    "",
  );
});

test("magnifier scene preserves hidden source art instead of duplicating the carried stick", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const art = new DecorativeNode("svg", { class: "matchstick-art" });
  const button = new DecorativeNode(
    "BUTTON",
    { class: "match-segment visible" },
    [art],
  );
  const source = new DecorativeNode("DIV", { class: "equation" }, [button]);
  let sourceHidden = true;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      getComputedStyle: (original: DecorativeNode) => ({
        0: "visibility",
        length: 1,
        getPropertyValue: () =>
          original === art && sourceHidden ? "hidden" : "visible",
      }),
    },
  });
  try {
    const snapshot = () =>
      copyMagnifierSurface(
        source as unknown as HTMLElement,
      ) as unknown as DecorativeNode;
    const held = snapshot();
    assert.equal(held.children[0].styles.get("visibility"), "visible");
    assert.equal(
      held.children[0].children[0].styles.get("visibility"),
      "hidden",
    );
    assert.equal(
      button.hasAttribute("disabled"),
      false,
      "live source keeps pointer capture",
    );
    sourceHidden = false;
    const restored = snapshot();
    assert.equal(
      restored.children[0].children[0].styles.get("visibility"),
      "visible",
    );
  } finally {
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
