import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { trapFocus } from "../app/focus-trap";

test("trapFocus wraps Tab and Shift+Tab inside the container", () => {
  const dom = new JSDOM('<div id="dialog" tabindex="-1"><button>first</button><button>last</button></div>');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: dom.window.document,
  });

  try {
    const container = dom.window.document.querySelector<HTMLElement>("#dialog")!;
    const [first, last] = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    for (const button of [first, last]) {
      Object.defineProperty(button, "offsetParent", { configurable: true, value: container });
    }

    last.focus();
    const tab = new dom.window.KeyboardEvent("keydown", {
      key: "Tab",
      cancelable: true,
    });
    trapFocus(tab as unknown as KeyboardEvent, container);
    assert.equal(dom.window.document.activeElement, first);
    assert.equal(tab.defaultPrevented, true);

    first.focus();
    const shiftTab = new dom.window.KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      cancelable: true,
    });
    trapFocus(shiftTab as unknown as KeyboardEvent, container);
    assert.equal(dom.window.document.activeElement, last);
    assert.equal(shiftTab.defaultPrevented, true);
  } finally {
    if (previousDocument) {
      Object.defineProperty(globalThis, "document", previousDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
    dom.window.close();
  }
});
