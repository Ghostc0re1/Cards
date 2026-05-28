import type { DomRefs } from "./types";

export interface CardBuilderEventHandlers {
  onCanvasClick(event: MouseEvent): void;
  onCanvasMouseMove(event: MouseEvent): void;
  onFormPointerDown(event: PointerEvent): void;
  onFormInput(event: Event): void;
  onFormChange(event: Event): void;
  onFormFocusOut(event: FocusEvent): void;
  onFormToggle(event: Event): void;
  onFormClick(event: MouseEvent): void;
  onSavedBuildsModalInput(event: Event): void;
  onSavedBuildsModalChange(event: Event): void;
  onSavedBuildsModalClick(event: MouseEvent): void;
  onCloseSavedBuildsClick(event: MouseEvent): void;
  onThemeClick(button: HTMLElement, event: MouseEvent): void;
  onPickerGridClick(event: MouseEvent): void;
  onClosePickerClick(event: MouseEvent): void;
  onPickerModalClick(event: MouseEvent): void;
  onClearSlotClick(event: MouseEvent): void;
  onSampleClick(event: MouseEvent): void;
  onResetClick(event: MouseEvent): void;
  onExportClick(event: MouseEvent): void;
  onCloseExportClick(event: MouseEvent): void;
  onExportModalClick(event: MouseEvent): void;
  onWindowKeydown(event: KeyboardEvent): void;
  onAuthEmailInput(event: Event): void;
  onAuthSignInClick(event: MouseEvent): void;
  onUsernameInput(event: Event): void;
  onUsernameSaveClick(event: MouseEvent): void;
  onUsernameSignOutClick(event: MouseEvent): void;
  onBuilderTabClick(event: MouseEvent): void;
  onSharedTabClick(event: MouseEvent): void;
}

export function eventTargetElement(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}

export function closestFromEvent<T extends Element>(
  event: Event,
  selector: string,
): T | null {
  return eventTargetElement(event)?.closest(selector) as T | null;
}

export function bindCardBuilderEvents(
  refs: DomRefs,
  handlers: CardBuilderEventHandlers,
): void {
  refs.canvas.addEventListener("click", handlers.onCanvasClick);
  refs.canvas.addEventListener("mousemove", handlers.onCanvasMouseMove);
  refs.form.addEventListener("pointerdown", handlers.onFormPointerDown, true);
  refs.form.addEventListener("input", handlers.onFormInput);
  refs.form.addEventListener("change", handlers.onFormChange);
  refs.form.addEventListener("focusout", handlers.onFormFocusOut);
  refs.form.addEventListener("toggle", handlers.onFormToggle, true);
  refs.form.addEventListener("click", handlers.onFormClick);
  refs.savedBuildsModal.addEventListener(
    "input",
    handlers.onSavedBuildsModalInput,
  );
  refs.savedBuildsModal.addEventListener(
    "change",
    handlers.onSavedBuildsModalChange,
  );
  refs.savedBuildsModal.addEventListener(
    "click",
    handlers.onSavedBuildsModalClick,
  );
  refs.closeSavedBuilds.addEventListener(
    "click",
    handlers.onCloseSavedBuildsClick,
  );

  document.querySelectorAll<HTMLElement>("[data-theme]").forEach((button) => {
    button.addEventListener("click", (event) =>
      handlers.onThemeClick(button, event),
    );
  });

  refs.pickerGrid.addEventListener("click", handlers.onPickerGridClick);
  refs.closePicker.addEventListener("click", handlers.onClosePickerClick);
  refs.pickerModal.addEventListener("click", handlers.onPickerModalClick);
  refs.clearSlot.addEventListener("click", handlers.onClearSlotClick);
  refs.sampleButton.addEventListener("click", handlers.onSampleClick);
  refs.resetButton.addEventListener("click", handlers.onResetClick);
  refs.exportButton.addEventListener("click", handlers.onExportClick);
  refs.closeExport.addEventListener("click", handlers.onCloseExportClick);
  refs.exportModal.addEventListener("click", handlers.onExportModalClick);
  window.addEventListener("keydown", handlers.onWindowKeydown);
  refs.authEmail.addEventListener("input", handlers.onAuthEmailInput);
  refs.authSignIn.addEventListener("click", handlers.onAuthSignInClick);
  refs.usernameInput.addEventListener("input", handlers.onUsernameInput);
  refs.usernameSave.addEventListener("click", handlers.onUsernameSaveClick);
  refs.usernameSignOut.addEventListener("click", handlers.onUsernameSignOutClick);
  refs.builderTab.addEventListener("click", handlers.onBuilderTabClick);
  refs.sharedTab.addEventListener("click", handlers.onSharedTabClick);
}
