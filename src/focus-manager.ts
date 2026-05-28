import type {
  FocusState,
  RenderFormOptions,
  ScrollSnapshot,
} from "./types";

type TextSelectionControl = HTMLInputElement | HTMLTextAreaElement;

function isTextSelectionControl(
  element: Element | null,
): element is TextSelectionControl {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  );
}

export function attrSelectorValue(value: unknown): string {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function focusWithoutScrolling(element: Element | null): void {
  if (!(element instanceof HTMLElement)) return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export class FocusManager {
  private readonly form: HTMLFormElement;
  private readonly idleMs: number;
  private readonly now: () => number;
  private lastEditorInputAt = 0;
  private pendingSafeFormRender = false;
  private pendingSafeFormRenderTimer = 0;
  private pendingControlScrollState: ScrollSnapshot | null = null;

  constructor({
    form,
    idleMs,
    now,
  }: {
    form: HTMLFormElement;
    idleMs: number;
    now?: () => number;
  }) {
    this.form = form;
    this.idleMs = idleMs;
    this.now = now || Date.now;
  }

  markEditorInput(): void {
    this.lastEditorInputAt = this.now();
  }

  editorIsRecentlyActive(): boolean {
    return this.now() - this.lastEditorInputAt < this.idleMs;
  }

  activeEditorControl(): Element | null {
    const active = document.activeElement;
    if (!active || !this.form.contains(active)) return null;
    return active.closest("[data-field], [data-build-name], [data-cloud-email]");
  }

  captureScrollState(): ScrollSnapshot {
    return {
      formTop: this.form.scrollTop,
      windowX: window.scrollX,
      windowY: window.scrollY,
    };
  }

  restoreScrollState(snapshot: ScrollSnapshot | null): void {
    if (!snapshot) return;
    const restore = () => {
      this.form.scrollTop = snapshot.formTop;
      const lockPageScroll =
        getComputedStyle(document.body).overflow === "hidden";
      window.scrollTo(snapshot.windowX, lockPageScroll ? 0 : snapshot.windowY);
    };
    restore();
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
  }

  capturePendingOrCurrentScrollState(): ScrollSnapshot {
    return this.pendingControlScrollState || this.captureScrollState();
  }

  setPendingControlScrollState(snapshot = this.captureScrollState()): void {
    this.pendingControlScrollState = snapshot;
  }

  clearPendingControlScrollState(): void {
    this.pendingControlScrollState = null;
  }

  editorControlSelector(element: Element | null): string {
    if (!(element instanceof HTMLElement)) return "";
    if (element.dataset.field) {
      return `[data-field="${attrSelectorValue(element.dataset.field)}"]`;
    }
    if (element.matches("[data-build-name]")) return "[data-build-name]";
    if (element.matches("[data-cloud-email]")) return "[data-cloud-email]";
    return "";
  }

  captureFocusState(): FocusState | null {
    const element = this.activeEditorControl();
    const selector = this.editorControlSelector(element);
    if (!selector) return null;
    const focusState: FocusState = {
      selector,
      scrollState: this.captureScrollState(),
      selectionStart: null,
      selectionEnd: null,
    };
    if (
      isTextSelectionControl(element) &&
      typeof element.selectionStart === "number" &&
      typeof element.selectionEnd === "number"
    ) {
      focusState.selectionStart = element.selectionStart;
      focusState.selectionEnd = element.selectionEnd;
    }
    return focusState;
  }

  restoreFocusState(focusState: FocusState | null): void {
    if (!focusState) return;
    this.restoreScrollState(focusState.scrollState);
    requestAnimationFrame(() => {
      const element = this.form.querySelector(focusState.selector);
      if (!element) return;
      focusWithoutScrolling(element);
      if (
        isTextSelectionControl(element) &&
        focusState.selectionStart !== null
      ) {
        element.setSelectionRange(
          focusState.selectionStart,
          focusState.selectionEnd,
        );
      }
      this.restoreScrollState(focusState.scrollState);
    });
  }

  renderSafely(
    render: () => void,
    options: RenderFormOptions = {},
  ): boolean {
    if (
      options.deferWhenEditing &&
      this.activeEditorControl() &&
      this.editorIsRecentlyActive()
    ) {
      this.queueSafeFormRender(render);
      return false;
    }
    const focusState = this.captureFocusState();
    render();
    this.restoreFocusState(focusState);
    return true;
  }

  queueSafeFormRender(render: () => void): void {
    this.pendingSafeFormRender = true;
    window.clearTimeout(this.pendingSafeFormRenderTimer);
    this.pendingSafeFormRenderTimer = window.setTimeout(
      () => this.runPendingSafeFormRender(render),
      this.idleMs,
    );
  }

  runPendingSafeFormRender(render: () => void): void {
    if (!this.pendingSafeFormRender) return;
    if (this.activeEditorControl() && this.editorIsRecentlyActive()) {
      window.clearTimeout(this.pendingSafeFormRenderTimer);
      this.pendingSafeFormRenderTimer = window.setTimeout(
        () => this.runPendingSafeFormRender(render),
        this.idleMs,
      );
      return;
    }
    this.pendingSafeFormRender = false;
    this.renderSafely(render);
  }

  hasPendingSafeFormRender(): boolean {
    return this.pendingSafeFormRender;
  }

  scrollElementInForm(element: Element | null): void {
    if (!(element instanceof HTMLElement)) return;
    const formRect = this.form.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const targetTop =
      this.form.scrollTop +
      elementRect.top -
      formRect.top -
      this.form.clientHeight / 2 +
      elementRect.height / 2;
    this.form.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  }
}
