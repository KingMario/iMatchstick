import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { copy } from "./copy";
import { GameSettings } from "./GameSettings";
import { InstallShortcut } from "./InstallShortcut";
import { StatsBar } from "./StatsBar";

type Props = ComponentProps<typeof GameSettings>;
type Element = ReactElement<Record<string, unknown>>;
const noop = () => {};
function props(overrides: Partial<Props> = {}): Props {
  return {
    open: true,
    text: copy.en,
    language: "en",
    timerEnabled: true,
    soundEnabled: false,
    isPhone: true,
    dragHand: "left",
    stats: { solved: 3, streak: 2, bypassed: 1 },
    feedback: "",
    update: {
      status: "latest",
      applying: false,
      check: async () => {},
      apply: async () => {},
    },
    onClose: noop,
    onLanguageChange: noop,
    onTimerChange: noop,
    onSoundChange: noop,
    onDragHandChange: noop,
    onShare: noop,
    onClearStats: noop,
    ...overrides,
  };
}
function elements(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as ReactNode)];
  });
}
function find(
  nodes: Element[],
  predicate: (node: Element) => boolean,
): Element {
  const result = nodes.find(predicate);
  assert.ok(result, "Expected settings element was not found");
  return result;
}

describe("grouped settings", () => {
  for (const language of ["zh", "en"] as const) {
    for (const isPhone of [false, true]) {
      it(`renders localized default-closed groups and common controls: ${language}, phone=${isPhone}`, () => {
        const input = props({ language, text: copy[language], isPhone });
        const tree = GameSettings(input);
        assert.equal(tree.props.title, input.text.settingsTitle);
        const nodes = elements(tree.props.children);
        const groups = nodes.filter((node) => node.type === "details");
        assert.equal(groups.length, 3);
        assert.deepEqual(
          groups.map(
            (group) =>
              find(
                elements(group.props.children as ReactNode),
                (node) => node.type === "summary",
              ).props.children,
          ),
          [
            input.text.instructions,
            input.text.statistics,
            input.text.aboutVersion,
          ],
        );
        for (const group of groups) assert.equal(group.props.open, undefined);
        const common = find(
          nodes,
          (node) => node.props.className === "settings-common",
        );
        const controls = elements(common.props.children as ReactNode);
        assert.equal(
          controls.filter((node) => node.type === "input").length,
          2,
        );
        assert.equal(
          controls.filter((node) => node.type === "select").length,
          isPhone ? 1 : 0,
        );
        const statistics = elements(groups[1].props.children as ReactNode);
        const stats = find(statistics, (node) => node.type === StatsBar);
        assert.equal(stats.props.stats, input.stats);
        assert.equal(stats.props.onClearStats, input.onClearStats);
        const about = elements(groups[2].props.children as ReactNode);
        assert.ok(about.some((node) => node.type === InstallShortcut));
        assert.ok(about.some((node) => node.type === "footer"));
        assert.ok(about.some((node) => node.props.onClick === input.onShare));
        const html = renderToStaticMarkup(tree);
        assert.equal((html.match(/<details\b/g) ?? []).length, 3);
        assert.doesNotMatch(html, /<details[^>]*\sopen(?:[\s=>])/);
        assert.match(html, /Copyright Mario Studio 2026-2027/);
      });
    }
  }

  it("keeps available-update notice and apply action outside collapsed groups", () => {
    const input = props({
      update: {
        status: "available",
        applying: false,
        check: async () => {},
        apply: async () => {},
      },
    });
    const tree = GameSettings(input);
    const children = Children.toArray(tree.props.children).filter(
      isValidElement,
    ) as Element[];
    const notice = find(
      children,
      (node) => node.props.className === "settings-update",
    );
    assert.equal(notice.props.role, "status");
    assert.ok(
      children.indexOf(notice) <
        children.findIndex((node) => node.type === "details"),
    );
    assert.equal(
      find(elements(notice), (node) => node.type === "button").props.children,
      input.text.updateReload,
    );
    for (const status of [
      "idle",
      "checking",
      "latest",
      "failed",
      "unsupported",
    ] as const) {
      assert.ok(
        !elements(
          GameSettings(props({ update: { ...input.update, status } })).props
            .children,
        ).some((node) => node.props.className === "settings-update"),
      );
    }
    const applying = elements(
      GameSettings(props({ update: { ...input.update, applying: true } })).props
        .children,
    );
    const applyingNotice = find(
      applying,
      (node) => node.props.className === "settings-update",
    );
    const apply = find(
      elements(applyingNotice),
      (node) => node.type === "button",
    );
    assert.equal(apply.props.disabled, true);
    assert.equal(apply.props.children, input.text.updateApplying);
  });

  it("only checks or applies updates when their buttons are activated", () => {
    let checks = 0;
    let applications = 0;
    const update: Props["update"] = {
      status: "latest",
      applying: false,
      check: async () => {
        checks += 1;
      },
      apply: async () => {
        applications += 1;
      },
    };
    renderToStaticMarkup(GameSettings(props({ update })));
    const available = GameSettings(
      props({ update: { ...update, status: "available" } }),
    );
    renderToStaticMarkup(available);
    assert.deepEqual([checks, applications], [0, 0]);
    const nodes = elements(available.props.children);
    const check = find(
      nodes,
      (node) =>
        node.type === "button" && node.props.children === copy.en.checkUpdate,
    );
    (check.props.onClick as () => void)();
    assert.deepEqual([checks, applications], [1, 0]);
    const apply = find(
      nodes,
      (node) =>
        node.type === "button" && node.props.children === copy.en.updateReload,
    );
    (apply.props.onClick as () => void)();
    assert.deepEqual([checks, applications], [1, 1]);
  });

  it("retains common-control callbacks and values", () => {
    const changes: unknown[] = [];
    const input = props({
      onLanguageChange: (value) => changes.push(value),
      onTimerChange: (value) => changes.push(value),
      onSoundChange: (value) => changes.push(value),
      onDragHandChange: (value) => changes.push(value),
    });
    const common = find(
      elements(GameSettings(input).props.children),
      (node) => node.props.className === "settings-common",
    );
    const nodes = elements(common);
    const language = nodes.filter((node) => node.type === "button");
    (language[0].props.onClick as () => void)();
    (language[1].props.onClick as () => void)();
    const checkboxes = nodes.filter((node) => node.type === "input");
    assert.deepEqual(
      checkboxes.map((node) => node.props.checked),
      [true, false],
    );
    (
      checkboxes[0].props.onChange as (event: {
        target: { checked: boolean };
      }) => void
    )({ target: { checked: false } });
    (
      checkboxes[1].props.onChange as (event: {
        target: { checked: boolean };
      }) => void
    )({ target: { checked: true } });
    const hand = find(nodes, (node) => node.type === "select");
    assert.equal(hand.props.value, "left");
    (hand.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "right" },
    });
    assert.deepEqual(changes, ["zh", "en", false, true, "right"]);
  });
});
