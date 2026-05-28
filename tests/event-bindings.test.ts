import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindCardBuilderEvents,
  closestFromEvent,
  eventTargetElement,
} from "../src/event-bindings";
import type { DomRefs } from "../src/types";

describe("event-bindings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("narrows event targets to elements", () => {
    class FakeElement {}
    const target = new FakeElement();
    vi.stubGlobal("Element", FakeElement);

    expect(eventTargetElement({ target } as unknown as Event)).toBe(target);
    expect(eventTargetElement({ target: {} } as unknown as Event)).toBeNull();
  });

  it("finds closest matching elements from event targets", () => {
    const closestMatch = { dataset: { field: "title" } };
    class FakeElement {
      closest = (selector: string) =>
        selector === "[data-field]" ? closestMatch : null;
    }
    vi.stubGlobal("Element", FakeElement);

    expect(
      closestFromEvent<HTMLElement>(
        { target: new FakeElement() } as unknown as Event,
        "[data-field]",
      ),
    ).toBe(closestMatch);
  });

  it("registers typed event handlers on DOM refs and theme buttons", () => {
    const listeners: Array<{ event: string; capture?: boolean }> = [];
    const target = {
      addEventListener: (event: string, _handler: unknown, capture?: boolean) =>
        listeners.push({ event, capture }),
    };
    const themeButton = {
      addEventListener: (event: string) => listeners.push({ event }),
    };
    vi.stubGlobal("document", {
      querySelectorAll: () => [themeButton],
    });
    vi.stubGlobal("window", {
      addEventListener: (event: string) => listeners.push({ event }),
    });
    const refs = {
      canvas: target,
      form: target,
      savedBuildsModal: target,
      closeSavedBuilds: target,
      pickerGrid: target,
      closePicker: target,
      pickerModal: target,
      clearSlot: target,
      sampleButton: target,
      resetButton: target,
      exportButton: target,
      closeExport: target,
      exportModal: target,
      authEmail: target,
      authSignIn: target,
      usernameInput: target,
      usernameSave: target,
      usernameSignOut: target,
      builderTab: target,
      sharedTab: target,
    } as unknown as DomRefs;
    const handler = () => {};

    bindCardBuilderEvents(refs, {
      onCanvasClick: handler,
      onCanvasMouseMove: handler,
      onFormPointerDown: handler,
      onFormInput: handler,
      onFormChange: handler,
      onFormFocusOut: handler,
      onFormToggle: handler,
      onFormClick: handler,
      onSavedBuildsModalInput: handler,
      onSavedBuildsModalChange: handler,
      onSavedBuildsModalClick: handler,
      onCloseSavedBuildsClick: handler,
      onThemeClick: handler,
      onPickerGridClick: handler,
      onClosePickerClick: handler,
      onPickerModalClick: handler,
      onClearSlotClick: handler,
      onSampleClick: handler,
      onResetClick: handler,
      onExportClick: handler,
      onCloseExportClick: handler,
      onExportModalClick: handler,
      onWindowKeydown: handler,
      onAuthEmailInput: handler,
      onAuthSignInClick: handler,
      onUsernameInput: handler,
      onUsernameSaveClick: handler,
      onUsernameSignOutClick: handler,
      onBuilderTabClick: handler,
      onSharedTabClick: handler,
    });

    expect(listeners).toEqual(
      expect.arrayContaining([
        { event: "click", capture: undefined },
        { event: "pointerdown", capture: true },
        { event: "toggle", capture: true },
        { event: "keydown" },
      ]),
    );
  });
});
