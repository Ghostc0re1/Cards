import { assetName } from "./card-catalog";
import {
  editableHeaderLabels,
  readOnlyHeaderLabels,
} from "./card-layout";
import { equipmentSetKeys, equipmentSetPresets } from "./state-model";
import type { BuildFormViewModel, BuildState, SharedBuildGroup } from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sectionKey(title: string): string {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getByPath(state: BuildState, path: string): unknown {
  return path.split(".").reduce<unknown>((cursor, part) => {
    if (cursor == null) return undefined;
    return (cursor as Record<string, unknown>)[part];
  }, state);
}

function fieldHtml(
  state: BuildState,
  label: string,
  path: string,
  options: { multiline?: boolean; rows?: number } = {},
): string {
  const value = getByPath(state, path) ?? "";
  const rows = options.rows || 3;
  const input = options.multiline
    ? `<textarea data-field="${path}" rows="${rows}">${escapeHtml(value)}</textarea>`
    : `<input data-field="${path}" value="${escapeHtml(value)}">`;
  return `<div class="field"><label>${escapeHtml(label)}</label>${input}</div>`;
}

function selectFieldHtml(
  state: BuildState,
  label: string,
  path: string,
  choices: Array<{ value: string; label: string }>,
  placeholder = "Choose",
): string {
  const value = getByPath(state, path) ?? "";
  const options = [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...choices.map(
      (choice) =>
        `<option value="${escapeHtml(choice.value)}" ${choice.value === value ? "selected" : ""}>${escapeHtml(choice.label)}</option>`,
    ),
  ].join("");
  return `
    <div class="field">
      <label>${escapeHtml(label)}</label>
      <select data-field="${escapeHtml(path)}">${options}</select>
    </div>
  `;
}

function equipmentSetFieldHtml(state: BuildState): string {
  return selectFieldHtml(
    state,
    "Equipment set",
    "equipmentSet",
    equipmentSetKeys.map((key) => ({
      value: key,
      label: `${equipmentSetPresets[key].name} - ${equipmentSetPresets[key].label}`,
    })),
    "Choose equipment set",
  );
}

function readOnlyFieldHtml(state: BuildState, label: string, path: string): string {
  return `
    <div class="readonly-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(getByPath(state, path) || "")}</strong>
    </div>
  `;
}

function tagFieldsHtml(state: BuildState): string {
  return `
    <div class="tag-grid">
      ${Array.from({ length: 4 }, (_, index) => fieldHtml(state, `Tag ${index + 1}`, `tags.${index}`)).join("")}
    </div>
  `;
}

function colorFieldHtml(label: string, key: string, value: string): string {
  return `
    <label class="color-field">
      <span>${escapeHtml(label)}</span>
      <input type="color" data-field="colors.${key}" value="${escapeHtml(value)}">
    </label>
  `;
}

function colorControlsHtml(colors: Record<string, string>): string {
  return `
    <div class="color-grid">
      ${colorFieldHtml("Title", "title", colors.title)}
      ${colorFieldHtml("Tags", "tags", colors.muted)}
      ${colorFieldHtml("Body text", "body", colors.body)}
      ${colorFieldHtml("Banner text", "banner", colors.ribbonText)}
      ${colorFieldHtml("Primary star", "marker", colors.marker)}
    </div>
    <button type="button" class="clear-button" data-reset-colors>Use theme defaults</button>
  `;
}

function buildControlsHtml(model: BuildFormViewModel): string {
  const active = model.activeBuild;
  const publishedAt = active?.sharedAt ? Date.parse(active.sharedAt) : 0;
  const updatedAt = active?.updatedAt ? Date.parse(active.updatedAt) : 0;
  const hasUnpublishedChanges =
    Boolean(active?.sharedAt) &&
    Number.isFinite(publishedAt) &&
    Number.isFinite(updatedAt) &&
    updatedAt > publishedAt;
  const publishButtonLabel = active?.sharedAt
    ? "Publish changes"
    : "Publish build";
  const options = model.buildLibrary.builds
    .map(
      (build) =>
        `<option value="${escapeHtml(build.id)}" ${build.id === active?.id ? "selected" : ""}>${escapeHtml(build.name)}</option>`,
    )
    .join("");
  const magicLinkDisabled =
    !model.cloudConfigured ||
    model.magicLinkInFlight ||
    model.magicLinkRemaining > 0;
  return `
    <div class="build-controls">
      <div class="field">
        <label>Load build</label>
        <select class="build-select" data-build-select>${options}</select>
      </div>
      <div class="field">
        <label>Build name</label>
        <input data-build-name value="${escapeHtml(model.previewing ? model.previewLabel : active?.name || "")}" ${model.previewing ? "disabled" : ""}>
      </div>
      <div class="build-actions">
        <button type="button" class="action-button" data-build-new>New</button>
        <button type="button" class="action-button" data-build-save ${model.previewing ? "disabled" : ""}>Save</button>
        <button type="button" class="action-button" data-build-save-as>Save As</button>
        <button type="button" class="action-button" data-build-load>Load</button>
        <button type="button" class="action-button" data-build-duplicate ${model.previewing ? "disabled" : ""}>Duplicate</button>
        <button type="button" class="danger-button" data-build-delete ${model.previewing ? "disabled" : ""}>Delete</button>
      </div>
      <div class="build-actions">
        ${
          !active?.sharedAt || hasUnpublishedChanges
            ? `<button type="button" class="action-button" data-publish-build ${model.previewing ? "disabled" : ""}>${escapeHtml(publishButtonLabel)}</button>`
            : ""
        }
        ${
          active?.sharedAt
            ? `<button type="button" class="clear-button" data-unpublish-build ${model.previewing ? "disabled" : ""}>Unpublish</button>`
            : ""
        }
      </div>
      ${
        active?.sharedAt && !model.previewing
          ? `<p class="cloud-help">${escapeHtml(hasUnpublishedChanges ? "Unpublished changes since last publish." : `Published as @${model.profileUsername}.`)}</p>`
          : ""
      }
      <div class="cloud-controls">
        <div class="cloud-status ${escapeHtml(model.cloudStatus.state)}" data-cloud-status>${escapeHtml(model.cloudStatus.message)}</div>
        ${
          model.profileUsername
            ? `<div class="cloud-user">Signed in as <strong>@${escapeHtml(model.profileUsername)}</strong></div>
               <div class="cloud-actions">
                 <button type="button" class="action-button" data-cloud-sync>Sync now</button>
                 <button type="button" class="clear-button" data-cloud-sign-out>Sign out</button>
               </div>`
            : `<div class="field">
                 <label>Email for cloud sync</label>
                 <input type="email" data-cloud-email placeholder="you@example.com" value="${escapeHtml(model.magicLinkEmail)}" ${model.cloudConfigured ? "" : "disabled"}>
               </div>
               <button type="button" class="action-button" data-cloud-sign-in ${magicLinkDisabled ? "disabled" : ""}>${escapeHtml(model.magicLinkButtonText)}</button>`
        }
        ${model.cloudConfigured ? "" : `<p class="cloud-help">Add Supabase values in src/supabase-config.ts to enable cloud sync.</p>`}
        <div class="cloud-actions">
          <button type="button" class="clear-button" data-export-json>Export build JSON</button>
          <button type="button" class="clear-button" data-import-json>Import build JSON</button>
          <input type="file" accept="application/json,.json" data-import-json-file hidden>
        </div>
      </div>
    </div>
  `;
}

function sharedPreviewActionsHtml(model: BuildFormViewModel): string {
  const preview = model.sharedPreview;
  if (!preview) {
    return `<p class="cloud-help">Select a shared build to preview it without editing.</p>`;
  }
  const isOwner = preview.ownerId === model.currentUserId;
  return `
    <div class="shared-preview-actions">
      <div>
        <span class="eyebrow">Read-only preview</span>
        <h3>${escapeHtml(preview.name)}</h3>
        <p class="cloud-help">Viewing shared build by @${escapeHtml(preview.username)}. Save As to keep an editable copy.</p>
      </div>
      <div class="build-actions">
        <button type="button" class="action-button" data-shared-save-as>Save As</button>
        ${
          isOwner
            ? `<button type="button" class="action-button" data-shared-edit-original="${escapeHtml(preview.id)}">Edit original</button>
               <button type="button" class="clear-button" data-shared-unpublish="${escapeHtml(preview.id)}">Unpublish</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function sharedBuildsHtml(model: BuildFormViewModel): string {
  const groups = model.sharedBuildGroups;
  if (!groups.length) return `<p class="cloud-help">No shared builds yet.</p>`;
  return groups
    .map(
      (group) => `
        <div class="shared-hero-group">
          <h3>${escapeHtml(group.heroName)}</h3>
          <div class="shared-build-table">
            ${group.builds
              .map(
                (build) => {
                  const isOwner = build.ownerId === model.currentUserId;
                  const isSelected = build.id === model.sharedPreview?.id;
                  return `
                    <div class="shared-build-row ${isSelected ? "selected" : ""}">
                      <button type="button" class="shared-build-button" data-shared-build-id="${escapeHtml(build.id)}">
                        <span>${escapeHtml(build.name)}</span>
                        <strong>@${escapeHtml(build.username)}</strong>
                        <small>Shared ${escapeHtml(new Date(build.sharedAt).toLocaleDateString())}</small>
                      </button>
                      <div class="shared-row-actions">
                        <button type="button" class="clear-button" data-shared-save-as-id="${escapeHtml(build.id)}">Save As</button>
                        ${
                          isOwner
                            ? `<button type="button" class="clear-button" data-shared-edit-original="${escapeHtml(build.id)}">Edit original</button>
                               <button type="button" class="clear-button" data-shared-unpublish="${escapeHtml(build.id)}">Unpublish</button>`
                            : ""
                        }
                      </div>
                    </div>
                  `;
                },
              )
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");
}

function sharedLibraryHtml(model: BuildFormViewModel): string {
  return `
    <div class="shared-library">
      <div class="cloud-controls">
        <div class="cloud-status ${escapeHtml(model.cloudStatus.state)}" data-cloud-status>${escapeHtml(model.cloudStatus.message)}</div>
        <div class="cloud-user">Signed in as <strong>@${escapeHtml(model.profileUsername)}</strong></div>
        <div class="cloud-actions">
          <button type="button" class="action-button" data-cloud-sync>Sync now</button>
          <button type="button" class="clear-button" data-cloud-sign-out>Sign out</button>
        </div>
      </div>
      ${sharedPreviewActionsHtml(model)}
      ${sharedBuildsHtml(model)}
    </div>
  `;
}

function slotEditorHtml(
  state: BuildState,
  title: string,
  kind: "skill" | "device",
  assetPath: string,
  fieldsHtml: string,
  markedPath = "",
): string {
  const selected = getByPath(state, assetPath) as string;
  const checkbox = markedPath
    ? `<label class="toggle-field"><span>Primary</span><input type="checkbox" data-field="${markedPath}" ${getByPath(state, markedPath) ? "checked" : ""}><span class="toggle-track" aria-hidden="true"></span></label>`
    : "";
  return `
    <div class="slot-editor">
      <div class="slot-tools">
        <span class="slot-label">${escapeHtml(title)}</span>
        <button type="button" class="pick-button" data-pick-kind="${kind}" data-pick-path="${assetPath}">${escapeHtml(assetName(selected))}</button>
        <button type="button" class="clear-button" data-clear-path="${assetPath}">Clear</button>
      </div>
      <div class="slot-fields">
        ${fieldsHtml}
        ${checkbox}
      </div>
    </div>
  `;
}

function sectionHtml(
  title: string,
  body: string,
  open: boolean,
  sectionOpenState: Record<string, boolean>,
): string {
  const key = sectionKey(title);
  const isOpen = Object.hasOwn(sectionOpenState, key)
    ? sectionOpenState[key]
    : open;
  return `
    <details class="form-section" data-section="${escapeHtml(key)}" ${isOpen ? "open" : ""}>
      <summary>${escapeHtml(title)}</summary>
      <div class="section-body">${body}</div>
    </details>
  `;
}

export function renderFormHtml(model: BuildFormViewModel): string {
  const state = model.state;
  if (model.activeView === "shared") {
    return sectionHtml(
      "Shared builds",
      sharedLibraryHtml(model),
      true,
      model.formSectionOpenState,
    );
  }

  const identity = [
    fieldHtml(state, "Character name", "title"),
    tagFieldsHtml(state),
    fieldHtml(state, "Match-up notes", "notes", { multiline: true, rows: 5 }),
  ].join("");

  const readOnlyHeaders = readOnlyHeaderLabels
    .map(([label, path]) => readOnlyFieldHtml(state, label, path))
    .join("");
  const editableHeaders = editableHeaderLabels
    .map(([label, path]) => fieldHtml(state, label, path))
    .join("");
  const headers = `${readOnlyHeaders}${editableHeaders}`;

  const main = state.mainSkills
    .map((_, index) =>
      slotEditorHtml(
        state,
        `Main skill ${index + 1}`,
        "skill",
        `mainSkills.${index}.assetId`,
        fieldHtml(state, "Label", `mainSkills.${index}.label`),
        `mainSkills.${index}.marked`,
      ),
    )
    .join("");

  const situational = state.situationalSkills
    .map((_, index) =>
      slotEditorHtml(
        state,
        `Situational skill ${index + 1}`,
        "skill",
        `situationalSkills.${index}.assetId`,
        fieldHtml(state, "Label", `situationalSkills.${index}.label`),
        `situationalSkills.${index}.marked`,
      ),
    )
    .join("");

  const devices = state.devices
    .map((_, index) =>
      slotEditorHtml(
        state,
        `Device ${index + 1}`,
        "device",
        `devices.${index}.assetId`,
        `${fieldHtml(state, "Label", `devices.${index}.label`)}${fieldHtml(state, "Role", `devices.${index}.role`)}`,
      ),
    )
    .join("");

  const explanations = state.skillRows
    .map((_, index) =>
      slotEditorHtml(
        state,
        `Skill note ${index + 1}`,
        "skill",
        `skillRows.${index}.assetId`,
        `${fieldHtml(state, "Skill name", `skillRows.${index}.title`)}${fieldHtml(state, "Why", `skillRows.${index}.body`, { multiline: true, rows: 2 })}`,
      ),
    )
    .join("");

  const upgrades = state.upgrades
    .map((_, index) => {
      if (index === 1) {
        return [
          fieldHtml(state, "Upgrade Title 2", "upgrades.1.title"),
          fieldHtml(state, "Upgrade Usable", "upgrades.1.usable"),
          fieldHtml(state, "Upgrade Viable", "upgrades.1.viable"),
          fieldHtml(state, "Upgrade Note 2", "upgrades.1.body", {
            multiline: true,
            rows: 3,
          }),
        ].join("");
      }
      return `${fieldHtml(state, `Upgrade title ${index + 1}`, `upgrades.${index}.title`)}${fieldHtml(state, `Upgrade note ${index + 1}`, `upgrades.${index}.body`, { multiline: true, rows: 4 })}`;
    })
    .join("");

  const sections = model.formSectionOpenState;
  return [
    sectionHtml("Builds", buildControlsHtml(model), true, sections),
    sectionHtml("Character and notes", identity, true, sections),
    sectionHtml("Section text", headers, false, sections),
    sectionHtml("Font colors", colorControlsHtml(model.activeColors), false, sections),
    sectionHtml("Main skills", main, false, sections),
    sectionHtml("Situational skills", situational, false, sections),
    sectionHtml("Equipment", equipmentSetFieldHtml(state), false, sections),
    sectionHtml("Magic devices", devices, false, sections),
    sectionHtml("Skills I use, and why", explanations, true, sections),
    sectionHtml("How I upgraded", upgrades, false, sections),
  ].join("");
}
