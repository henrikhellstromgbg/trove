import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfirmDialog } from "../app/components/ui/confirm-dialog";
import { Tabs, type ButtonTabItem } from "../app/components/ui/tabs";
import { DataRow } from "../app/components/ui/data-list";

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

test("ConfirmDialog: confirmDisabled focuses Cancel, Escape calls onCancel, unmount restores prior focus", () => {
  withDom(() => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open dialog";
    document.body.appendChild(trigger);
    trigger.focus();
    assert.equal(document.activeElement, trigger);

    let cancelCalls = 0;
    const view = renderComponent(
      React.createElement(ConfirmDialog, {
        open: true,
        title: "Delete item",
        confirmDisabled: true,
        onConfirm: () => {},
        onCancel: () => {
          cancelCalls += 1;
        },
      }),
    );

    const cancelButton = buttonByText(view.container, "Cancel");
    assert.equal(document.activeElement, cancelButton, "Cancel should be focused when confirm is disabled");

    fireKeyDown(window, "Escape");
    assert.equal(cancelCalls, 1, "Escape should invoke onCancel");

    view.unmount();
    assert.equal(document.activeElement, trigger, "unmounting should restore the previously focused element");
  });
});

test("ConfirmDialog: destructive focuses Cancel", () => {
  withDom(() => {
    const view = renderComponent(
      React.createElement(ConfirmDialog, {
        open: true,
        title: "Delete forever",
        destructive: true,
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );

    const cancelButton = buttonByText(view.container, "Cancel");
    assert.equal(document.activeElement, cancelButton, "Cancel should be focused for destructive dialogs");

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
    for (const expected of ["focus-visible:outline-none", "focus-visible:ring-2", "focus-visible:ring-inset", "focus-visible:ring-ink-dim"]) {
      assert.ok(classList.includes(expected), `expected overlay button to include class "${expected}"`);
    }

    view.unmount();
  });
});
