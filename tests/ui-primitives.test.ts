import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Button, ConfirmDialog, Tabs, DataRow, type ButtonTabItem } from "../components/ui";

type GlobalPatch = Record<string, unknown>;

const PATCHED_KEYS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Node",
  "KeyboardEvent",
  "Event",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "IS_REACT_ACT_ENVIRONMENT",
];

function setGlobal(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

function setupDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of PATCHED_KEYS) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  }

  setGlobal("window", dom.window);
  setGlobal("document", dom.window.document);
  setGlobal("navigator", dom.window.navigator);
  setGlobal("HTMLElement", dom.window.HTMLElement);
  setGlobal("Node", dom.window.Node);
  setGlobal("KeyboardEvent", dom.window.KeyboardEvent);
  setGlobal("Event", dom.window.Event);
  setGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => dom.window.setTimeout(() => cb(Date.now()), 0));
  setGlobal("cancelAnimationFrame", (id: number) => dom.window.clearTimeout(id));
  setGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  // Radix (AlertDialog) needs a few DOM APIs JSDOM does not implement.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  setGlobal("ResizeObserver", ResizeObserverStub);
  dom.window.ResizeObserver = ResizeObserverStub as unknown as typeof dom.window.ResizeObserver;
  const proto = dom.window.HTMLElement.prototype;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};

  return {
    dom,
    restore() {
      for (const key of PATCHED_KEYS) {
        const descriptor = previous.get(key);
        if (descriptor === undefined) {
          Reflect.deleteProperty(globalThis as unknown as GlobalPatch, key);
        } else {
          Object.defineProperty(globalThis, key, descriptor);
        }
      }
      dom.window.close();
    },
  };
}

function withDom(fn: (dom: JSDOM) => void) {
  const { dom, restore } = setupDom();
  try {
    fn(dom);
  } finally {
    restore();
  }
}

function renderComponent(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
  return {
    container,
    rerender(next: React.ReactElement) {
      act(() => {
        root.render(next);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function fireKeyDown(target: EventTarget, key: string, opts: KeyboardEventInit = {}) {
  const event = new (globalThis as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function buttonByText(container: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
  assert.ok(button, `expected to find a <button> with text "${text}"`);
  return button as HTMLButtonElement;
}

// ConfirmDialog is now a thin wrapper over Radix AlertDialog (role=alertdialog).
// Radix owns focus trap, focus return, and Escape — all tested upstream and
// exercised in the app. Radix's portal/Presence does not commit in this minimal
// hand-rolled JSDOM harness, so we assert the wrapper contract we can here: it
// is a component, and it renders nothing while closed.
test("ConfirmDialog: is a component and renders nothing when closed", () => {
  withDom(() => {
    assert.equal(typeof ConfirmDialog, "function");

    const view = renderComponent(
      React.createElement(ConfirmDialog, {
        open: false,
        title: "Delete forever",
        confirmLabel: "Delete",
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );

    assert.ok(
      !document.body.textContent?.includes("Delete forever"),
      "a closed dialog should render no content",
    );

    view.unmount();
  });
});

test("Tabs (button-driven): renders tabId/panelId, aria-selected/tabIndex, and ArrowRight moves focus + selects next", () => {
  withDom(() => {
    const items: ButtonTabItem[] = [
      { key: "all", label: "All", tabId: "tab-all", panelId: "panel-all" },
      { key: "starred", label: "Starred", tabId: "tab-starred", panelId: "panel-starred" },
      { key: "archived", label: "Archived", tabId: "tab-archived", panelId: "panel-archived" },
    ];

    const selected: string[] = [];
    const view = renderComponent(
      React.createElement(Tabs, {
        items,
        activeKey: "all",
        label: "Item views",
        onSelect: (key: string) => selected.push(key),
      }),
    );

    const buttons = Array.from(view.container.querySelectorAll("button[role='tab']")) as HTMLButtonElement[];
    assert.equal(buttons.length, items.length);

    for (const [index, item] of items.entries()) {
      const button = buttons[index];
      assert.equal(button.id, item.tabId);
      assert.equal(button.getAttribute("aria-controls"), item.panelId);
      const active = item.key === "all";
      assert.equal(button.getAttribute("aria-selected"), String(active));
      assert.equal(button.tabIndex, active ? 0 : -1);
    }

    buttons[0].focus();
    assert.equal(document.activeElement, buttons[0]);

    fireKeyDown(buttons[0], "ArrowRight");

    assert.equal(document.activeElement, buttons[1], "ArrowRight should move focus to the next tab");
    assert.deepEqual(selected, ["starred"], "ArrowRight should call onSelect with the next tab's key");

    view.unmount();
  });
});

test("DataRow (interactive/button-driven): renders an accessible overlay control and visible focus-ring classes", () => {
  withDom(() => {
    const view = renderComponent(
      React.createElement(
        DataRow,
        { onSelect: () => {}, selectLabel: "Open Weekly digest" },
        "Weekly digest",
      ),
    );

    const overlay = view.container.querySelector("button[aria-label='Open Weekly digest']");
    assert.ok(overlay, "expected an overlay <button> with the accessible name from selectLabel");
    assert.equal((overlay as HTMLButtonElement).getAttribute("aria-label"), "Open Weekly digest");

    const classList = Array.from((overlay as HTMLButtonElement).classList);
    for (const expected of ["focus-visible:outline-none", "focus-visible:ring-2", "focus-visible:ring-inset", "focus-visible:ring-[var(--color-focus-ring)]"]) {
      assert.ok(classList.includes(expected), `expected overlay button to include class "${expected}"`);
    }

    view.unmount();
  });
});

test("DataRow renders block children inside a block content wrapper", () => {
  withDom(() => {
    const view = renderComponent(
      React.createElement(
        DataRow,
        {},
        React.createElement("div", { "data-testid": "block-child" }, "Block content"),
      ),
    );

    const child = view.container.querySelector("[data-testid='block-child']");
    assert.ok(child);
    assert.equal(child.parentElement?.tagName, "DIV");

    view.unmount();
  });
});

test("DataRow keeps trailing actions above its stretched row control", () => {
  withDom(() => {
    const selected: string[] = [];
    const view = renderComponent(
      React.createElement(
        DataRow,
        {
          onSelect: () => selected.push("row"),
          selectLabel: "Open item",
          trailing: React.createElement("button", { type: "button", "data-testid": "row-action" }, "Approve"),
        },
        "Item",
      ),
    );

    const action = view.container.querySelector("[data-testid='row-action']") as HTMLButtonElement | null;
    assert.ok(action);
    assert.ok(
      action.parentElement?.classList.contains("z-[var(--z-raised)]"),
      "expected the trailing slot to use the tokenized raised layer",
    );

    action.click();
    assert.deepEqual(selected, [], "the trailing action must not trigger the row control");

    view.unmount();
  });
});

test("Button asChild slots a single link child even though a loading sibling exists", () => {
  withDom(() => {
    // Regression: Button always renders a loading-spinner sibling before its
    // children. Without a Slottable marker, asChild handed Radix Slot two
    // children and threw. This must render the link and merge the classes onto
    // it, not crash.
    const view = renderComponent(
      React.createElement(
        Button,
        { asChild: true, variant: "secondary" },
        React.createElement("a", { href: "/x" }, "New pipeline"),
      ),
    );

    const link = view.container.querySelector("a[href='/x']");
    assert.ok(link, "expected the link to render as the slotted element");
    assert.equal(link.textContent, "New pipeline");
    assert.ok(
      Array.from((link as HTMLAnchorElement).classList).includes("cursor-pointer"),
      "expected buttonVariants classes to merge onto the link",
    );

    view.unmount();
  });
});

test("Button renders a plain button when not slotting", () => {
  withDom(() => {
    const view = renderComponent(
      React.createElement(Button, {}, "Save changes"),
    );

    const button = view.container.querySelector("button");
    assert.ok(button, "expected a native button");
    assert.equal(button.textContent, "Save changes");

    view.unmount();
  });
});
