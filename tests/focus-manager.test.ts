import { afterEach, describe, expect, it, vi } from "vitest";
import { attrSelectorValue, FocusManager } from "../src/focus-manager";

function fakeForm() {
  return {
    scrollTop: 0,
    clientHeight: 500,
    contains: () => false,
  } as unknown as HTMLFormElement;
}

describe("focus-manager", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("escapes values for attribute selectors", () => {
    expect(attrSelectorValue('field\\"name')).toBe('field\\\\\\"name');
  });

  it("builds stable selectors for editor controls", () => {
    class FakeHTMLElement {
      dataset: Record<string, string> = { field: 'upgrades.1.body"quoted' };
      buildName = false;
      cloudEmail = false;
      matches = (selector: string) =>
        (selector === "[data-build-name]" && this.buildName) ||
        (selector === "[data-cloud-email]" && this.cloudEmail);
    }
    vi.stubGlobal("HTMLElement", FakeHTMLElement);
    const manager = new FocusManager({ form: fakeForm(), idleMs: 100 });
    const buildName = new FakeHTMLElement();
    buildName.dataset = {};
    buildName.buildName = true;
    const cloudEmail = new FakeHTMLElement();
    cloudEmail.dataset = {};
    cloudEmail.cloudEmail = true;

    expect(
      manager.editorControlSelector(
        new FakeHTMLElement() as unknown as HTMLElement,
      ),
    ).toBe('[data-field="upgrades.1.body\\"quoted"]');
    expect(
      manager.editorControlSelector(buildName as unknown as HTMLElement),
    ).toBe("[data-build-name]");
    expect(
      manager.editorControlSelector(cloudEmail as unknown as HTMLElement),
    ).toBe("[data-cloud-email]");
  });

  it("defers form rendering while an editor is active and recently edited", () => {
    vi.useFakeTimers();
    vi.stubGlobal("HTMLElement", class FakeHTMLElement {});
    let now = 1000;
    const active = {
      closest: () => active,
    };
    const form = {
      contains: (element: unknown) => element === active,
      scrollTop: 0,
      clientHeight: 500,
    } as unknown as HTMLFormElement;
    const documentLike: { activeElement: unknown } = { activeElement: active };
    vi.stubGlobal("document", documentLike);
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    const manager = new FocusManager({
      form,
      idleMs: 100,
      now: () => now,
    });
    let renderCount = 0;

    manager.markEditorInput();
    expect(
      manager.renderSafely(() => {
        renderCount += 1;
      }, { deferWhenEditing: true }),
    ).toBe(false);
    expect(renderCount).toBe(0);

    documentLike.activeElement = null;
    now = 1200;
    manager.runPendingSafeFormRender(() => {
      renderCount += 1;
    });

    expect(renderCount).toBe(1);
  });

  it("restores focus, selection, and scroll snapshots", () => {
    const scrollCalls: unknown[] = [];
    class FakeHTMLElement {
      focused = false;
      dataset = {};
      matches = () => false;
      focus = () => {
        this.focused = true;
      };
    }
    class FakeInput extends FakeHTMLElement {
      selectionStart: number | null = 1;
      selectionEnd: number | null = 3;
      setSelectionRange = (start: number, end: number | null) => {
        this.selectionStart = start;
        this.selectionEnd = end;
      };
    }
    const input = new FakeInput();
    const form = {
      scrollTop: 7,
      clientHeight: 500,
      contains: (element: unknown) => element === input,
      querySelector: () => input,
    } as unknown as HTMLFormElement;

    vi.stubGlobal("HTMLElement", FakeHTMLElement);
    vi.stubGlobal("HTMLInputElement", FakeInput);
    vi.stubGlobal("HTMLTextAreaElement", class FakeTextArea extends FakeInput {});
    vi.stubGlobal("document", {
      activeElement: input,
      body: {},
    });
    vi.stubGlobal("window", {
      scrollX: 11,
      scrollY: 13,
      scrollTo: (...args: unknown[]) => scrollCalls.push(args),
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    vi.stubGlobal("getComputedStyle", () => ({ overflow: "auto" }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const manager = new FocusManager({ form, idleMs: 100 });
    const focusState = {
      selector: "[data-field=\"title\"]",
      scrollState: manager.captureScrollState(),
      selectionStart: 2,
      selectionEnd: 4,
    };

    manager.restoreFocusState(focusState);

    expect(input.focused).toBe(true);
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(4);
    expect(form.scrollTop).toBe(7);
    expect(scrollCalls).toContainEqual([11, 13]);
  });
});
