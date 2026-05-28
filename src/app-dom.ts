import type { DomRefs } from "./types";

function requiredElement<T extends Element>(
  root: Document,
  id: string,
  expected: { new (): T },
): T {
  const element = root.getElementById(id);
  if (!(element instanceof expected)) {
    throw new Error(`Missing required element #${id}`);
  }
  return element;
}

export function collectDomRefs(root: Document): DomRefs {
  const canvas = requiredElement(root, "cardCanvas", HTMLCanvasElement);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to initialize card canvas.");

  return {
    appShell: requiredElement(root, "appShell", HTMLDivElement),
    authGate: requiredElement(root, "authGate", HTMLElement),
    authEmail: requiredElement(root, "authEmail", HTMLInputElement),
    authSignIn: requiredElement(root, "authSignIn", HTMLButtonElement),
    authStatus: requiredElement(root, "authStatus", HTMLElement),
    usernameGate: requiredElement(root, "usernameGate", HTMLElement),
    usernameInput: requiredElement(root, "usernameInput", HTMLInputElement),
    usernameSave: requiredElement(root, "usernameSave", HTMLButtonElement),
    usernameSignOut: requiredElement(root, "usernameSignOut", HTMLButtonElement),
    usernameStatus: requiredElement(root, "usernameStatus", HTMLElement),
    canvas,
    ctx: context,
    form: requiredElement(root, "editorForm", HTMLFormElement),
    savedBuildsModal: requiredElement(root, "savedBuildsModal", HTMLDivElement),
    savedBuildsSearch: requiredElement(root, "savedBuildsSearch", HTMLInputElement),
    savedBuildsSort: requiredElement(root, "savedBuildsSort", HTMLSelectElement),
    savedBuildsSummary: requiredElement(root, "savedBuildsSummary", HTMLElement),
    savedBuildsList: requiredElement(root, "savedBuildsList", HTMLDivElement),
    closeSavedBuilds: requiredElement(root, "closeSavedBuilds", HTMLButtonElement),
    pickerModal: requiredElement(root, "pickerModal", HTMLDivElement),
    pickerGrid: requiredElement(root, "pickerGrid", HTMLDivElement),
    pickerTitle: requiredElement(root, "pickerTitle", HTMLElement),
    closePicker: requiredElement(root, "closePicker", HTMLButtonElement),
    clearSlot: requiredElement(root, "clearSlot", HTMLButtonElement),
    builderTab: requiredElement(root, "builderTab", HTMLButtonElement),
    sharedTab: requiredElement(root, "sharedTab", HTMLButtonElement),
    exportButton: requiredElement(root, "exportButton", HTMLButtonElement),
    resetButton: requiredElement(root, "resetButton", HTMLButtonElement),
    sampleButton: requiredElement(root, "sampleButton", HTMLButtonElement),
    saveStatus: requiredElement(root, "saveStatus", HTMLElement),
    previewTitle: requiredElement(root, "previewTitle", HTMLElement),
    exportModal: requiredElement(root, "exportModal", HTMLDivElement),
    closeExport: requiredElement(root, "closeExport", HTMLButtonElement),
    exportPreview: requiredElement(root, "exportPreview", HTMLImageElement),
    downloadExport: requiredElement(root, "downloadExport", HTMLAnchorElement),
    openExport: requiredElement(root, "openExport", HTMLAnchorElement),
  };
}
